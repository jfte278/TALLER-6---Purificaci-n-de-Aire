// Genera 60 días de operación histórica simulada (reproducible: semilla fija).
// Uso: npm run seed      (borra y recrea data/airquality.db)
const fs = require('node:fs');
const M = require('../src/modelo');
const { abrir, transaccion, RUTA } = require('../src/db');
const { crearServicio } = require('../src/servicio');

for (const ext of ['', '-wal', '-shm']) fs.rmSync(RUTA + ext, { force: true });
const db = abrir();
const svc = crearServicio(db);
const rng = M.crearRng(20261120);

// Desgaste previo de los filtros (para que la regla de mantenimiento tenga casos reales)
const uso = { PRE: 395, HEPA: 820, CARBON: 610, CATAL: 900, CO2: 300 };
for (const [c, h] of Object.entries(uso)) db.prepare('UPDATE filtros SET horas_uso = ?, ultimo_cambio = ? WHERE codigo = ?').run(h, '2026-07-15T08:00:00.000Z', c);

const pesos = [['urbano', 0.34], ['industrial', 0.22], ['interior', 0.2], ['construccion', 0.14], ['incendio', 0.1]];
const elegir = () => { let x = rng(); for (const [e, p] of pesos) { if ((x -= p) <= 0) return e; } return 'urbano'; };
const DIAS = 60;
const hoy = new Date('2026-11-20T00:00:00-05:00');
let total = 0;

transaccion(db, () => {
  for (let d = DIAS; d >= 1; d--) {
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const fecha = new Date(hoy.getTime() - d * 86400000 + (7 + rng() * 11) * 3600000);
      let esc = elegir();
      if (d > 38 && d < 44 && rng() < 0.6) esc = 'incendio';   // episodio de incendios forestales
      const det = svc.crearLote({ escenario: esc, fecha, rng });
      if (rng() < 0.05) continue;                             // algunos ingresos quedan sin tratar
      let filtros = det.recomendacion.filtros;
      let duracion = Math.min(120, Math.max(10, Math.ceil((det.recomendacion.prediccion.minutos || 40) * 1.2)));
      if (rng() < 0.12) filtros = ['HEPA'];                    // error de operación: solo HEPA
      if (rng() < 0.08) duracion = Math.max(5, Math.round(duracion * 0.4)); // tiempo insuficiente
      svc.simularCompleto({ lote_id: det.lote.id, filtros, duracion, auto_stop: true, fecha: new Date(fecha.getTime() + 4 * 60000), rng });
      total++;
    }
  }
});

// Las alertas de más de 3 días ya fueron gestionadas por el operador
db.prepare(`UPDATE alertas SET atendida = 1 WHERE fecha < ? AND tipo <> 'FILTRO_SATURADO'`).run(new Date(hoy.getTime() - 3 * 86400000).toISOString());

const r = db.prepare(`SELECT COUNT(*) lotes, SUM(resultado='Óptimo') opt, SUM(resultado='Aceptable') ac, SUM(resultado='Insuficiente') ins FROM v_comparacion`).get();
const a = db.prepare('SELECT COUNT(*) n FROM alertas').get().n;
console.log(`Base de datos creada en ${RUTA}`);
console.log(`Lotes: ${r.lotes} | Procesos: ${total} (Óptimo ${r.opt}, Aceptable ${r.ac}, Insuficiente ${r.ins}) | Alertas: ${a}`);
