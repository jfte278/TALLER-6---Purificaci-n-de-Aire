// =====================================================================
// AIR QUALITY INTELLIGENCE - Servidor HTTP + API REST (Node.js puro)
// Uso: node server.js   ->  http://localhost:3000
// =====================================================================
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const M = require('./src/modelo');
const { abrir } = require('./src/db');
const { crearServicio, ErrorNegocio } = require('./src/servicio');
const { crearAnalitica } = require('./src/analitica');

const PORT = Number(process.env.PORT) || 3000;
// Primera ejecución: genera la base de datos con 60 días de historia simulada
if (!fs.existsSync(require('./src/db').RUTA)) {
  console.log('  Creando base de datos inicial...');
  require('node:child_process').execFileSync(process.execPath, [path.join(__dirname, 'scripts', 'seed.js')], { stdio: 'inherit' });
}
const db = abrir();
const svc = crearServicio(db);
const bi = crearAnalitica(db);
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 1e6) req.destroy(); });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { mal(new ErrorNegocio('JSON inválido')); } });
    req.on('error', mal);
  });
}

const rutas = [
  ['GET', /^\/api\/config$/, () => ({
    contaminantes: M.CONTAMINANTES, niveles: M.NIVELES, cortes: M.CORTES, filtros: M.FILTROS, objetivo: M.OBJETIVO,
    escenarios: Object.fromEntries(Object.entries(M.ESCENARIOS).map(([k, v]) => [k, { nombre: v.nombre, ubicacion: v.ubicacion }])),
    volumen_camara: M.VOLUMEN_CAMARA,
  })],
  ['GET', /^\/api\/lotes$/, (req, u) => db.prepare(`SELECT l.*, p.id proceso_id, p.estado, p.resultado FROM lotes l
      LEFT JOIN procesos p ON p.id = (SELECT MAX(id) FROM procesos WHERE lote_id = l.id) ORDER BY l.id DESC LIMIT ?`).all(Number(u.searchParams.get('limit')) || 30)],
  ['POST', /^\/api\/lotes$/, async req => { const b = await leerCuerpo(req); return svc.crearLote({ escenario: b.escenario, valores: b.valores || null }); }],
  ['GET', /^\/api\/lotes\/(\d+)$/, (req, u, m) => svc.detalleLote(Number(m[1]))],
  ['POST', /^\/api\/prediccion$/, async req => {
    const b = await leerCuerpo(req);
    const e = db.prepare(`SELECT * FROM mediciones WHERE lote_id = ? AND etapa='entrada'`).get(Number(b.lote_id));
    if (!e) throw new ErrorNegocio('Lote no encontrado', 404);
    return svc.prediccion(e, b.filtros || []);
  }],
  ['POST', /^\/api\/procesos$/, async req => { const b = await leerCuerpo(req); return svc.iniciarProceso({ lote_id: Number(b.lote_id), filtros: b.filtros, duracion: b.duracion, auto_stop: b.auto_stop !== false }); }],
  ['POST', /^\/api\/procesos\/(\d+)\/paso$/, (req, u, m) => svc.paso(Number(m[1]))],
  ['POST', /^\/api\/procesos\/(\d+)\/finalizar$/, (req, u, m) => svc.finalizar(Number(m[1]))],
  ['POST', /^\/api\/procesos\/(\d+)\/cancelar$/, (req, u, m) => svc.cancelar(Number(m[1]))],
  ['GET', /^\/api\/procesos\/ultimo$/, () => {
    const p = db.prepare(`SELECT id FROM procesos WHERE estado='finalizado' ORDER BY fin DESC, id DESC LIMIT 1`).get();
    return p ? svc.comparacion(p.id) : null;
  }],
  ['GET', /^\/api\/procesos\/(\d+)$/, (req, u, m) => svc.comparacion(Number(m[1]))],
  ['GET', /^\/api\/dashboard$/, (req, u) => bi.dashboard(Object.fromEntries(u.searchParams))],
  ['GET', /^\/api\/reportes\/procesos$/, (req, u) => bi.procesosTabla(Object.fromEntries(u.searchParams))],
  ['POST', /^\/api\/alertas\/(\d+)\/atender$/, (req, u, m) => { db.prepare(`UPDATE alertas SET atendida = 1 WHERE id = ?`).run(Number(m[1])); return { ok: true }; }],
  ['GET', /^\/api\/filtros$/, () => db.prepare(`SELECT *, ROUND(horas_uso * 100.0 / vida_util_h, 1) pct_uso FROM filtros`).all()],
  ['POST', /^\/api\/filtros\/(\w+)\/reemplazar$/, (req, u, m) => svc.reemplazarFiltro(m[1])],
];

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  try {
    if (u.pathname === '/api/reportes/procesos.csv') {
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="reporte_calidad_aire.csv"' });
      return res.end(bi.csv(Object.fromEntries(u.searchParams)));
    }
    if (u.pathname.startsWith('/api/')) {
      for (const [metodo, re, fn] of rutas) {
        const m = u.pathname.match(re);
        if (m && req.method === metodo) return json(res, 200, await fn(req, u, m));
      }
      return json(res, 404, { error: 'Ruta no encontrada' });
    }
    // archivos estáticos
    const ruta = path.normalize(path.join(PUBLIC, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname)));
    if (!ruta.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    fs.readFile(ruta, (err, data) => {
      if (err) { res.writeHead(404); return res.end('No encontrado'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(ruta)] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    if (e instanceof ErrorNegocio) return json(res, e.status, { error: e.message });
    console.error(e);
    json(res, 500, { error: 'Error interno: ' + e.message });
  }
});

server.listen(PORT, () => {
  const n = db.prepare('SELECT COUNT(*) n FROM lotes').get().n;
  console.log(`\n  AIR QUALITY INTELLIGENCE  ->  http://localhost:${PORT}`);
  console.log(`  Base de datos con ${n} lotes registrados${n ? '' : '  (ejecute "npm run seed" para cargar datos históricos)'}\n`);
});
