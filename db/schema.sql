-- =====================================================================
-- AIR QUALITY INTELLIGENCE - Esquema de base de datos (SQLite)
-- Una "lote" es una porción de aire contaminado que ingresa a la cámara
-- de tratamiento. Cada lote tiene una medición de ENTRADA, mediciones
-- minuto a minuto durante el PROCESO y una medición de SALIDA.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- Catálogo de tecnologías de purificación
CREATE TABLE IF NOT EXISTS filtros (
  codigo         TEXT PRIMARY KEY,           -- HEPA, CARBON, ...
  nombre         TEXT NOT NULL,
  tecnologia     TEXT NOT NULL,
  objetivo       TEXT NOT NULL,              -- contaminantes que remueve
  cadr_m3h       REAL NOT NULL,              -- caudal de aire limpio (m3/h)
  vida_util_h    REAL NOT NULL,              -- horas antes de reemplazo
  horas_uso      REAL NOT NULL DEFAULT 0,
  ultimo_cambio  TEXT
);

-- Ingreso de aire contaminado (Módulo 1)
CREATE TABLE IF NOT EXISTS lotes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_ingreso   TEXT NOT NULL,             -- ISO 8601
  escenario       TEXT NOT NULL,             -- origen del aire
  ubicacion       TEXT NOT NULL,
  volumen_m3      REAL NOT NULL,
  fuente_datos    TEXT NOT NULL DEFAULT 'sensor_simulado', -- o 'manual'
  nivel_entrada   INTEGER NOT NULL,          -- 1..6 (escala ICA)
  ica_pm25        INTEGER NOT NULL
);

-- Mediciones de sensores (entrada, proceso, salida)
CREATE TABLE IF NOT EXISTS mediciones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id     INTEGER NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  proceso_id  INTEGER REFERENCES procesos(id) ON DELETE CASCADE,
  etapa       TEXT NOT NULL CHECK (etapa IN ('entrada','proceso','salida')),
  minuto      INTEGER NOT NULL DEFAULT 0,
  fecha_hora  TEXT NOT NULL,
  pm25        REAL NOT NULL,                 -- µg/m3
  pm10        REAL NOT NULL,                 -- µg/m3
  co2         REAL NOT NULL,                 -- ppm
  co          REAL NOT NULL,                 -- ppm
  tvoc        REAL NOT NULL,                 -- mg/m3
  nivel       INTEGER NOT NULL               -- 1..6 (peor contaminante)
);
CREATE INDEX IF NOT EXISTS ix_med_lote ON mediciones(lote_id, etapa);
CREATE INDEX IF NOT EXISTS ix_med_proc ON mediciones(proceso_id, minuto);

-- Proceso de descontaminación (Módulos 2 y 3)
CREATE TABLE IF NOT EXISTS procesos (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id              INTEGER NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  filtros              TEXT NOT NULL,        -- códigos separados por coma
  inicio               TEXT NOT NULL,
  fin                  TEXT,
  duracion_programada  INTEGER NOT NULL,     -- minutos
  duracion_real_min    INTEGER,
  auto_stop            INTEGER NOT NULL DEFAULT 1,
  estado               TEXT NOT NULL CHECK (estado IN ('en_curso','finalizado','cancelado')),
  minuto_actual        INTEGER NOT NULL DEFAULT 0,
  estado_json          TEXT,                 -- concentración "real" del modelo
  tiempo_predicho_min  REAL,                 -- predicción al iniciar
  red_pm25             REAL, red_pm10 REAL, red_co2 REAL, red_co REAL, red_tvoc REAL,
  eficiencia_global    REAL,                 -- % promedio de reducción
  resultado            TEXT                  -- Óptimo / Aceptable / Insuficiente
);
CREATE INDEX IF NOT EXISTS ix_proc_lote ON procesos(lote_id);

-- Alertas (componente de inteligencia - reglas)
CREATE TABLE IF NOT EXISTS alertas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha        TEXT NOT NULL,
  lote_id      INTEGER REFERENCES lotes(id) ON DELETE CASCADE,
  proceso_id   INTEGER REFERENCES procesos(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL,   -- CONTAMINACION_ENTRADA, EFICIENCIA_BAJA, SALIDA_FUERA_NORMA, FILTRO_SATURADO
  contaminante TEXT,
  valor        REAL,
  umbral       REAL,
  severidad    TEXT NOT NULL CHECK (severidad IN ('media','alta','critica')),
  mensaje      TEXT NOT NULL,
  atendida     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_alertas_fecha ON alertas(fecha);

-- Vista analítica: antes vs. después por lote (fuente del dashboard / Power BI)
CREATE VIEW IF NOT EXISTS v_comparacion AS
SELECT l.id AS lote_id, l.fecha_ingreso, substr(l.fecha_ingreso,1,10) AS dia, l.escenario,
       p.id AS proceso_id, p.filtros, p.duracion_programada, p.duracion_real_min,
       p.tiempo_predicho_min, p.resultado, p.eficiencia_global,
       e.pm25 AS pm25_ini, s.pm25 AS pm25_fin, e.pm10 AS pm10_ini, s.pm10 AS pm10_fin,
       e.co2  AS co2_ini,  s.co2  AS co2_fin,  e.co   AS co_ini,   s.co   AS co_fin,
       e.tvoc AS tvoc_ini, s.tvoc AS tvoc_fin, e.nivel AS nivel_ini, s.nivel AS nivel_fin,
       p.red_pm25, p.red_pm10, p.red_co2, p.red_co, p.red_tvoc
FROM lotes l
JOIN mediciones e ON e.lote_id = l.id AND e.etapa = 'entrada'
LEFT JOIN procesos p ON p.lote_id = l.id AND p.estado = 'finalizado'
LEFT JOIN mediciones s ON s.proceso_id = p.id AND s.etapa = 'salida';
