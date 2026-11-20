// Modelo de dominio: contaminantes, escala de calidad, filtros,
// sensores simulados, dinámica de purificación y reglas inteligentes.

const CONTAMINANTES = {
  pm25: { nombre: 'PM2.5', unidad: 'µg/m³', dec: 1, piso: 1.5 },
  pm10: { nombre: 'PM10', unidad: 'µg/m³', dec: 1, piso: 3 },
  co2:  { nombre: 'CO₂',  unidad: 'ppm',   dec: 0, piso: 420 },   // no baja de la línea base atmosférica
  co:   { nombre: 'CO',   unidad: 'ppm',   dec: 2, piso: 0.2 },
  tvoc: { nombre: 'COV totales', unidad: 'mg/m³', dec: 2, piso: 0.04 },
};
const CLAVES = Object.keys(CONTAMINANTES);

// Escala de 6 niveles inspirada en el ICA (Res. 2254 de 2017, Colombia).
const NIVELES = [
  null,
  { id: 1, nombre: 'Buena',                         color: '#2e9e44' },
  { id: 2, nombre: 'Aceptable',                     color: '#e3c500' },
  { id: 3, nombre: 'Dañina para grupos sensibles',  color: '#f28c18' },
  { id: 4, nombre: 'Dañina',                        color: '#d7263d' },
  { id: 5, nombre: 'Muy dañina',                    color: '#8e3b9e' },
  { id: 6, nombre: 'Peligrosa',                     color: '#7a1f1f' },
];

// Límite superior de los niveles 1..5 (por encima del último => nivel 6)
const CORTES = {
  pm25: [12, 37, 55, 150, 250],          // ICA Colombia (24 h)
  pm10: [54, 154, 254, 354, 424],        // ICA Colombia (24 h)
  co:   [4.4, 9.4, 12.4, 15.4, 30.4],    // EPA AQI (8 h)
  co2:  [800, 1000, 1500, 2000, 5000],   // confort / ventilación (ASHRAE, REHVA)
  tvoc: [0.3, 0.5, 1.0, 3.0, 10.0],      // guías UBA (Alemania)
};

function nivelDe(cont, valor) {
  const c = CORTES[cont];
  let i = 0;
  while (i < c.length && valor > c[i]) i++;
  return i + 1;
}

function nivelGlobal(m) {
  return Math.max(...CLAVES.map(k => nivelDe(k, m[k])));
}

// Índice ICA numérico para PM2.5 (interpolación lineal por tramos)
const ICA_PM25 = [[0, 12, 0, 50], [12.1, 37, 51, 100], [37.1, 55, 101, 150], [55.1, 150, 151, 200], [150.1, 250, 201, 300], [250.1, 500, 301, 500]];
function icaPm25(c) {
  const v = Math.round(c * 10) / 10;
  for (const [blo, bhi, ilo, ihi] of ICA_PM25) {
    if (v <= bhi) return Math.round(((ihi - ilo) / (bhi - blo)) * (Math.max(v, blo) - blo) + ilo);
  }
  return 500;
}

// Catálogo de tecnologías. ef = eficiencia de captura por paso, por contaminante.
const FILTROS = [
  { codigo: 'PRE', nombre: 'Prefiltro G4', tecnologia: 'Malla sintética plisada', objetivo: 'PM10 (partículas gruesas)', cadr_m3h: 500, vida_util_h: 500, ef: { pm10: 0.65, pm25: 0.2 } },
  { codigo: 'HEPA', nombre: 'Filtro HEPA H13', tecnologia: 'Fibra de vidrio de alta eficiencia', objetivo: 'PM2.5 y PM10 (99,97 % a 0,3 µm)', cadr_m3h: 320, vida_util_h: 2000, ef: { pm25: 0.9995, pm10: 0.9999 } },
  { codigo: 'CARBON', nombre: 'Carbón activado', tecnologia: 'Adsorción en lecho de carbón granular', objetivo: 'COV, olores y gases orgánicos', cadr_m3h: 260, vida_util_h: 1000, ef: { tvoc: 0.85, co: 0.04, pm25: 0.05 } },
  { codigo: 'CATAL', nombre: 'Catalizador de CO', tecnologia: 'Oxidación catalítica (hopcalita) CO → CO₂', objetivo: 'Monóxido de carbono', cadr_m3h: 220, vida_util_h: 3000, ef: { co: 0.92 } },
  { codigo: 'CO2', nombre: 'Depurador de CO₂', tecnologia: 'Adsorción en zeolita + renovación controlada', objetivo: 'Dióxido de carbono', cadr_m3h: 180, vida_util_h: 1500, ef: { co2: 0.7 } },
];
const FILTRO = Object.fromEntries(FILTROS.map(f => [f.codigo, f]));

const VOLUMEN_CAMARA = 60; // m³

// Escenarios de ingreso de aire (valores medios de los sensores)
const ESCENARIOS = {
  urbano:       { nombre: 'Urbano - tráfico vehicular', ubicacion: 'Toma exterior Av. principal', base: { pm25: 45, pm10: 85, co2: 560, co: 6.5, tvoc: 0.45 } },
  industrial:   { nombre: 'Zona industrial',            ubicacion: 'Toma planta de producción',   base: { pm25: 120, pm10: 210, co2: 820, co: 13, tvoc: 1.6 } },
  incendio:     { nombre: 'Humo de incendio forestal',  ubicacion: 'Toma exterior norte',         base: { pm25: 240, pm10: 340, co2: 640, co: 22, tvoc: 2.4 } },
  interior:     { nombre: 'Interior con alta ocupación', ubicacion: 'Sala de reuniones',          base: { pm25: 22, pm10: 38, co2: 1850, co: 1.8, tvoc: 0.9 } },
  construccion: { nombre: 'Obra en construcción',       ubicacion: 'Toma exterior sur',           base: { pm25: 58, pm10: 290, co2: 520, co: 3.2, tvoc: 0.55 } },
};

// ---------------- utilidades numéricas ----------------
function crearRng(seed) {           // PRNG determinístico (mulberry32)
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  const u = Math.max(rng(), 1e-9), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function redondear(m) {
  const r = {};
  for (const k of CLAVES) { const d = CONTAMINANTES[k].dec; r[k] = Math.round(m[k] * 10 ** d) / 10 ** d; }
  return r;
}

// ---------------- sensores ----------------
function leerSensores(escenario, rng = Math.random) {
  const base = ESCENARIOS[escenario].base;
  const m = {};
  for (const k of CLAVES) {
    const variacion = k === 'co2' ? 0.18 : 0.28;
    m[k] = Math.max(CONTAMINANTES[k].piso * 1.2, base[k] * (1 + variacion * gauss(rng)));
  }
  if (m.pm10 < m.pm25 * 1.1) m.pm10 = m.pm25 * 1.25; // PM10 incluye PM2.5
  return redondear(m);
}
// Lectura del sensor sobre la concentración real (ruido de ±2 %)
function medir(real, rng = Math.random) {
  const m = {};
  for (const k of CLAVES) m[k] = Math.max(0, real[k] * (1 + 0.02 * gauss(rng)));
  return redondear(m);
}

// ---------------- dinámica de purificación ----------------
// Modelo de mezcla completa: dC/dt = -k (C - piso), k = Σ CADR·ef / V
// La eficiencia cae hasta 35 % cuando el filtro se acerca al fin de su vida útil.
function constantes(codigos, desgaste = {}) {
  const k = Object.fromEntries(CLAVES.map(c => [c, 0]));
  for (const cod of codigos) {
    const f = FILTRO[cod];
    if (!f) continue;
    const factor = 1 - 0.35 * Math.min(1, desgaste[cod] || 0);
    for (const [c, ef] of Object.entries(f.ef)) k[c] += (f.cadr_m3h * ef * factor) / VOLUMEN_CAMARA / 60; // por minuto
  }
  return k;
}
function avanzar(real, k, dt = 1) {
  const n = {};
  for (const c of CLAVES) {
    const piso = CONTAMINANTES[c].piso;
    n[c] = real[c] <= piso ? real[c] : piso + (real[c] - piso) * Math.exp(-k[c] * dt);
  }
  n.co2 += Math.max(0, real.co - n.co); // el catalizador oxida CO a CO₂ (1:1 en ppm)
  return n;
}

// ---------------- componente de inteligencia ----------------
const OBJETIVO = Object.fromEntries(CLAVES.map(c => [c, CORTES[c][0] * 0.95])); // llegar a "Buena"

// Predicción analítica: minutos para que cada contaminante llegue a "Buena"
function predecirTiempo(medicion, k) {
  const por = {};
  for (const c of CLAVES) {
    const piso = CONTAMINANTES[c].piso, obj = OBJETIVO[c];
    if (medicion[c] <= obj) por[c] = 0;
    else if (k[c] <= 0 || obj <= piso) por[c] = Infinity;
    else por[c] = Math.log((medicion[c] - piso) / (obj - piso)) / k[c];
  }
  const total = Math.max(...Object.values(por));
  return { total, por };
}

// Ajuste empírico (mínimos cuadrados sobre ln(C - piso)) con las lecturas del proceso
function ajustarK(lecturas, cont) {
  const piso = CONTAMINANTES[cont].piso;
  const pts = lecturas.filter(l => l[cont] - piso > 1e-6).map(l => [l.minuto, Math.log(l[cont] - piso)]);
  if (pts.length < 3) return null;
  const n = pts.length, sx = pts.reduce((s, p) => s + p[0], 0), sy = pts.reduce((s, p) => s + p[1], 0);
  const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0), sxy = pts.reduce((s, p) => s + p[0] * p[1], 0);
  const den = n * sxx - sx * sx;
  if (den === 0) return null;
  const b = (n * sxy - sx * sy) / den;
  return -b; // k estimado
}

function recomendarFiltros(m) {
  const set = new Set();
  const n = c => nivelDe(c, m[c]);
  if (n('pm25') > 1 || n('pm10') > 1) set.add('HEPA');
  if (n('pm10') >= 2 && m.pm10 > 100) set.add('PRE');
  if (n('tvoc') > 1) set.add('CARBON');
  if (n('co') > 1) set.add('CATAL');
  if (n('co2') > 1) set.add('CO2');
  if (set.size === 0) set.add('HEPA');
  return FILTROS.map(f => f.codigo).filter(c => set.has(c));
}

const SEVERIDAD = { 3: 'media', 4: 'alta', 5: 'critica', 6: 'critica' };
function alertasEntrada(m) {
  const out = [];
  for (const c of CLAVES) {
    const n = nivelDe(c, m[c]);
    if (n >= 3) {
      out.push({
        tipo: 'CONTAMINACION_ENTRADA', contaminante: c, valor: m[c], umbral: CORTES[c][1], severidad: SEVERIDAD[n],
        mensaje: `${CONTAMINANTES[c].nombre} = ${m[c]} ${CONTAMINANTES[c].unidad}: nivel "${NIVELES[n].nombre}"`,
      });
    }
  }
  return out;
}

function clasificarResultado(nivelFinal, eficiencia) {
  if (nivelFinal === 1 && eficiencia >= 50) return 'Óptimo';
  if (nivelFinal <= 2) return 'Aceptable';
  return 'Insuficiente';
}

module.exports = {
  CONTAMINANTES, CLAVES, NIVELES, CORTES, FILTROS, FILTRO, ESCENARIOS, VOLUMEN_CAMARA, OBJETIVO,
  nivelDe, nivelGlobal, icaPm25, crearRng, leerSensores, medir, redondear, constantes, avanzar,
  predecirTiempo, ajustarK, recomendarFiltros, alertasEntrada, clasificarResultado,
};
