// Pruebas automáticas del modelo y del flujo completo (node --test no requerido)
// Uso: npm test
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
process.env.AQI_DB = path.join(os.tmpdir(), `aqi-test-${process.pid}.db`);
const M = require('../src/modelo');
const { abrir } = require('../src/db');
const { crearServicio } = require('../src/servicio');
const { crearAnalitica, regresion } = require('../src/analitica');

let ok = 0;
const t = (nombre, fn) => { fn(); ok++; console.log('  ✓', nombre); };

t('clasificación por niveles (ICA Colombia PM2.5)', () => {
  assert.equal(M.nivelDe('pm25', 10), 1);
  assert.equal(M.nivelDe('pm25', 37), 2);
  assert.equal(M.nivelDe('pm25', 120), 4);
  assert.equal(M.nivelDe('pm25', 400), 6);
  assert.equal(M.icaPm25(12), 50);
  assert.equal(M.icaPm25(55), 150);
});
t('HEPA no remueve gases y el depurador de CO2 sí', () => {
  const k = M.constantes(['HEPA']);
  assert.ok(k.pm25 > 0.05);
  assert.equal(k.co2, 0);
  assert.equal(k.co, 0);
  assert.ok(M.constantes(['CO2']).co2 > 0);
});
t('motor de reglas recomienda filtros según contaminante', () => {
  const r = M.recomendarFiltros({ pm25: 80, pm10: 200, co2: 1800, co: 12, tvoc: 1.2 });
  assert.deepEqual(r, ['PRE', 'HEPA', 'CARBON', 'CATAL', 'CO2']);
  assert.deepEqual(M.recomendarFiltros({ pm25: 5, pm10: 10, co2: 500, co: 1, tvoc: 0.1 }), ['HEPA']);
});
t('predicción exponencial coincide con la simulación', () => {
  const m = { pm25: 150, pm10: 200, co2: 600, co: 2, tvoc: 0.2 };
  const k = M.constantes(['PRE', 'HEPA']);
  const pred = M.predecirTiempo(m, k).total;
  let c = m, min = 0;
  while (M.nivelGlobal(c) > 1) { c = M.avanzar(c, k); min++; }
  assert.ok(Math.abs(pred - min) <= 1, `pred ${pred} vs sim ${min}`);
});
t('regresión lineal', () => {
  const r = regresion([[1, 3], [2, 5], [3, 7], [4, 9]]);
  assert.equal(r.b, 2); assert.equal(r.a, 1); assert.equal(r.r2, 1);
});
t('flujo completo: ingreso → proceso → validación → dashboard', () => {
  const db = abrir();
  const svc = crearServicio(db);
  const rng = M.crearRng(7);
  const lote = svc.crearLote({ escenario: 'incendio', rng });
  assert.ok(lote.alertas.length > 0, 'debe generar alertas de entrada');
  const comp = svc.simularCompleto({ lote_id: lote.lote.id, filtros: lote.recomendacion.filtros, duracion: 90, rng });
  assert.equal(comp.proceso.estado, 'finalizado');
  assert.ok(comp.salida.pm25 < lote.entrada.pm25 * 0.2);
  assert.ok(comp.proceso.red_pm25 > 80);
  assert.throws(() => svc.iniciarProceso({ lote_id: lote.lote.id, filtros: ['HEPA'] }), /ya fue tratado/);
  const d = crearAnalitica(db).dashboard();
  assert.equal(d.kpi.procesos, 1);
  db.close();
});

for (const ext of ['', '-wal', '-shm']) fs.rmSync(process.env.AQI_DB + ext, { force: true });
console.log(`\n${ok} pruebas superadas`);
