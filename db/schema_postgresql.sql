-- =====================================================================
-- AIR QUALITY INTELLIGENCE - Esquema equivalente para PostgreSQL
-- (la aplicación usa SQLite embebido; este script permite migrar la
--  base a un servidor PostgreSQL / conectarla a Power BI).
-- =====================================================================
CREATE TABLE filtros (
  codigo        VARCHAR(10) PRIMARY KEY,
  nombre        VARCHAR(80) NOT NULL,
  tecnologia    VARCHAR(120) NOT NULL,
  objetivo      VARCHAR(120) NOT NULL,
  cadr_m3h      NUMERIC(8,2) NOT NULL,
  vida_util_h   NUMERIC(8,2) NOT NULL,
  horas_uso     NUMERIC(10,3) NOT NULL DEFAULT 0,
  ultimo_cambio TIMESTAMPTZ
);

CREATE TABLE lotes (
  id            SERIAL PRIMARY KEY,
  fecha_ingreso TIMESTAMPTZ NOT NULL,
  escenario     VARCHAR(30) NOT NULL,
  ubicacion     VARCHAR(120) NOT NULL,
  volumen_m3    NUMERIC(8,2) NOT NULL,
  fuente_datos  VARCHAR(20) NOT NULL DEFAULT 'sensor_simulado',
  nivel_entrada SMALLINT NOT NULL CHECK (nivel_entrada BETWEEN 1 AND 6),
  ica_pm25      SMALLINT NOT NULL
);

CREATE TABLE procesos (
  id                  SERIAL PRIMARY KEY,
  lote_id             INT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  filtros             VARCHAR(60) NOT NULL,
  inicio              TIMESTAMPTZ NOT NULL,
  fin                 TIMESTAMPTZ,
  duracion_programada INT NOT NULL,
  duracion_real_min   INT,
  auto_stop           BOOLEAN NOT NULL DEFAULT TRUE,
  estado              VARCHAR(12) NOT NULL CHECK (estado IN ('en_curso','finalizado','cancelado')),
  minuto_actual       INT NOT NULL DEFAULT 0,
  estado_json         JSONB,
  tiempo_predicho_min NUMERIC(6,1),
  red_pm25 NUMERIC(5,1), red_pm10 NUMERIC(5,1), red_co2 NUMERIC(5,1), red_co NUMERIC(5,1), red_tvoc NUMERIC(5,1),
  eficiencia_global   NUMERIC(5,1),
  resultado           VARCHAR(15)
);

CREATE TABLE mediciones (
  id         BIGSERIAL PRIMARY KEY,
  lote_id    INT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  proceso_id INT REFERENCES procesos(id) ON DELETE CASCADE,
  etapa      VARCHAR(10) NOT NULL CHECK (etapa IN ('entrada','proceso','salida')),
  minuto     INT NOT NULL DEFAULT 0,
  fecha_hora TIMESTAMPTZ NOT NULL,
  pm25 NUMERIC(7,1) NOT NULL, pm10 NUMERIC(7,1) NOT NULL, co2 NUMERIC(7,0) NOT NULL,
  co   NUMERIC(6,2) NOT NULL, tvoc NUMERIC(6,2) NOT NULL,
  nivel SMALLINT NOT NULL
);
CREATE INDEX ix_med_lote ON mediciones(lote_id, etapa);
CREATE INDEX ix_med_proc ON mediciones(proceso_id, minuto);

CREATE TABLE alertas (
  id           SERIAL PRIMARY KEY,
  fecha        TIMESTAMPTZ NOT NULL,
  lote_id      INT REFERENCES lotes(id) ON DELETE CASCADE,
  proceso_id   INT REFERENCES procesos(id) ON DELETE CASCADE,
  tipo         VARCHAR(30) NOT NULL,
  contaminante VARCHAR(10),
  valor        NUMERIC(10,2),
  umbral       NUMERIC(10,2),
  severidad    VARCHAR(8) NOT NULL CHECK (severidad IN ('media','alta','critica')),
  mensaje      TEXT NOT NULL,
  atendida     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE VIEW v_comparacion AS
SELECT l.id AS lote_id, l.fecha_ingreso, l.fecha_ingreso::date AS dia, l.escenario,
       p.id AS proceso_id, p.filtros, p.duracion_programada, p.duracion_real_min, p.tiempo_predicho_min,
       p.resultado, p.eficiencia_global,
       e.pm25 AS pm25_ini, s.pm25 AS pm25_fin, e.pm10 AS pm10_ini, s.pm10 AS pm10_fin,
       e.co2 AS co2_ini, s.co2 AS co2_fin, e.co AS co_ini, s.co AS co_fin, e.tvoc AS tvoc_ini, s.tvoc AS tvoc_fin,
       e.nivel AS nivel_ini, s.nivel AS nivel_fin, p.red_pm25, p.red_pm10, p.red_co2, p.red_co, p.red_tvoc
FROM lotes l
JOIN mediciones e ON e.lote_id = l.id AND e.etapa = 'entrada'
LEFT JOIN procesos p ON p.lote_id = l.id AND p.estado = 'finalizado'
LEFT JOIN mediciones s ON s.proceso_id = p.id AND s.etapa = 'salida';
