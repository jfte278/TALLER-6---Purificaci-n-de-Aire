// Conexión SQLite (módulo nativo node:sqlite, sin dependencias externas)
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { FILTROS } = require('./modelo');

const RUTA = process.env.AQI_DB || path.join(__dirname, '..', 'data', 'airquality.db');

function abrir(ruta = RUTA) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  const ins = db.prepare(`INSERT OR IGNORE INTO filtros (codigo,nombre,tecnologia,objetivo,cadr_m3h,vida_util_h,horas_uso,ultimo_cambio)
                          VALUES (?,?,?,?,?,?,0,?)`);
  for (const f of FILTROS) ins.run(f.codigo, f.nombre, f.tecnologia, f.objetivo, f.cadr_m3h, f.vida_util_h, new Date().toISOString());
  return db;
}

function transaccion(db, fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { abrir, transaccion, RUTA };
