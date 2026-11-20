// Módulo 4: Inteligencia de negocios (KPI, series, regresión, reportes)
const M = require('./modelo');

const r1 = v => (v == null ? null : Math.round(v * 10) / 10);

// Regresión lineal simple y = a + b·x con R²
function regresion(pts) {
  const n = pts.length;
  if (n < 3) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (sxx === 0) return null;
  const b = sxy / sxx, a = my - b * mx;
  return { a, b, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy), n };
}

function crearAnalitica(db) {
  function filtroSql({ desde, hasta, escenario } = {}) {
    const w = [], args = [];
    if (desde) { w.push('dia >= ?'); args.push(desde); }
    if (hasta) { w.push('dia <= ?'); args.push(hasta); }
    if (escenario) { w.push('escenario = ?'); args.push(escenario); }
    return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', args };
  }

  function dashboard(params = {}) {
    const { where, args } = filtroSql(params);
    const and = where ? where + ' AND' : 'WHERE';
    const kpi = db.prepare(`SELECT COUNT(*) lotes, COUNT(proceso_id) procesos,
        AVG(pm25_ini) pm25_ini, AVG(CASE WHEN proceso_id IS NOT NULL THEN pm25_ini END) pm25_ini_t, AVG(pm25_fin) pm25_fin,
        AVG(pm10_ini) pm10_ini, AVG(pm10_fin) pm10_fin, AVG(co2_ini) co2_ini, AVG(co2_fin) co2_fin,
        AVG(co_ini) co_ini, AVG(co_fin) co_fin, AVG(tvoc_ini) tvoc_ini, AVG(tvoc_fin) tvoc_fin,
        AVG(red_pm25) red_pm25, AVG(red_pm10) red_pm10, AVG(red_co2) red_co2, AVG(red_co) red_co, AVG(red_tvoc) red_tvoc,
        AVG(eficiencia_global) eficiencia, AVG(duracion_real_min) tiempo_prom, MAX(duracion_real_min) tiempo_max,
        SUM(resultado='Óptimo') optimos, SUM(resultado='Aceptable') aceptables, SUM(resultado='Insuficiente') insuficientes,
        SUM(nivel_ini >= 4) lotes_criticos
      FROM v_comparacion ${where}`).get(...args);
    for (const k of Object.keys(kpi)) if (typeof kpi[k] === 'number' && !Number.isInteger(kpi[k])) kpi[k] = r1(kpi[k]);
    kpi.pct_optimo = kpi.procesos ? r1((kpi.optimos / kpi.procesos) * 100) : 0;
    kpi.pct_conforme = kpi.procesos ? r1(((kpi.optimos + kpi.aceptables) / kpi.procesos) * 100) : 0;
    kpi.alertas_abiertas = db.prepare(`SELECT COUNT(*) n FROM alertas WHERE atendida = 0`).get().n;
    kpi.alertas_criticas = db.prepare(`SELECT COUNT(*) n FROM alertas WHERE atendida = 0 AND severidad='critica'`).get().n;

    const serie = db.prepare(`SELECT dia, COUNT(*) n, AVG(pm25_ini) pm25_ini, AVG(pm25_fin) pm25_fin, AVG(co2_ini) co2_ini, AVG(co2_fin) co2_fin
      FROM v_comparacion ${where} GROUP BY dia ORDER BY dia`).all(...args).map(s => ({ ...s, pm25_ini: r1(s.pm25_ini), pm25_fin: r1(s.pm25_fin), co2_ini: r1(s.co2_ini), co2_fin: r1(s.co2_fin) }));
    const niveles = db.prepare(`SELECT nivel_ini nivel, COUNT(*) n FROM v_comparacion ${where} GROUP BY nivel_ini ORDER BY nivel_ini`).all(...args);
    const nivelesSalida = db.prepare(`SELECT nivel_fin nivel, COUNT(*) n FROM v_comparacion ${and} nivel_fin IS NOT NULL GROUP BY nivel_fin ORDER BY nivel_fin`).all(...args);
    const escenarios = db.prepare(`SELECT escenario, COUNT(*) n, AVG(pm25_ini) pm25_ini, AVG(duracion_real_min) tiempo, AVG(eficiencia_global) eficiencia,
        SUM(resultado='Insuficiente') insuficientes FROM v_comparacion ${where} GROUP BY escenario ORDER BY n DESC`).all(...args)
      .map(e => ({ ...e, nombre: M.ESCENARIOS[e.escenario]?.nombre || e.escenario, pm25_ini: r1(e.pm25_ini), tiempo: r1(e.tiempo), eficiencia: r1(e.eficiencia) }));
    const combinaciones = db.prepare(`SELECT filtros, COUNT(*) n, AVG(eficiencia_global) eficiencia, AVG(duracion_real_min) tiempo
      FROM v_comparacion ${and} proceso_id IS NOT NULL GROUP BY filtros ORDER BY n DESC LIMIT 8`).all(...args).map(c => ({ ...c, eficiencia: r1(c.eficiencia), tiempo: r1(c.tiempo) }));

    // Modelo predictivo histórico: tiempo de purificación ~ PM2.5 inicial (procesos que alcanzaron el objetivo con HEPA)
    const pts = db.prepare(`SELECT pm25_ini, duracion_real_min, tiempo_predicho_min, nivel_fin FROM v_comparacion ${and} proceso_id IS NOT NULL AND filtros LIKE '%HEPA%' AND nivel_fin = 1`).all(...args);
    const reg = regresion(pts.map(p => [p.pm25_ini, p.duracion_real_min]));
    const errPred = pts.filter(p => p.tiempo_predicho_min != null);
    const mae = errPred.length ? r1(errPred.reduce((s, p) => s + Math.abs(p.tiempo_predicho_min - p.duracion_real_min), 0) / errPred.length) : null;

    const alertas = db.prepare(`SELECT a.*, l.escenario FROM alertas a LEFT JOIN lotes l ON l.id = a.lote_id ORDER BY a.atendida, a.fecha DESC LIMIT 60`).all();
    const alertasTipo = db.prepare(`SELECT tipo, severidad, COUNT(*) n FROM alertas GROUP BY tipo, severidad`).all();
    const filtros = db.prepare(`SELECT *, ROUND(horas_uso * 100.0 / vida_util_h, 1) pct_uso FROM filtros`).all();

    return {
      kpi, serie, niveles, nivelesSalida, escenarios, combinaciones, alertas, alertasTipo, filtros,
      modelo: reg ? { a: r1(reg.a), b: Math.round(reg.b * 1000) / 1000, r2: Math.round(reg.r2 * 1000) / 1000, n: reg.n, mae_prediccion_min: mae,
        puntos: pts.map(p => [p.pm25_ini, p.duracion_real_min]) } : null,
      recomendaciones: recomendaciones(kpi, escenarios, filtros, combinaciones),
    };
  }

  // Reglas de negocio que convierten indicadores en decisiones
  function recomendaciones(kpi, escenarios, filtros, combinaciones) {
    const out = [];
    if (kpi.procesos && kpi.pct_conforme < 90) out.push(`Solo el ${kpi.pct_conforme} % de los tratamientos entrega aire conforme (Buena/Aceptable). Meta: ≥ 90 %.`);
    const peor = [...escenarios].filter(e => e.n >= 3).sort((a, b) => (b.tiempo || 0) - (a.tiempo || 0))[0];
    if (peor) out.push(`El escenario "${peor.nombre}" exige el mayor tiempo de purificación (${peor.tiempo} min en promedio): conviene programarlo en horas de baja demanda o ampliar el CADR.`);
    for (const f of filtros) if (f.pct_uso >= 80) out.push(`Reemplazar ${f.nombre} (${f.pct_uso} % de vida útil); la eficiencia de captura ya se está degradando.`);
    const mala = combinaciones.filter(c => c.n >= 2).sort((a, b) => a.eficiencia - b.eficiencia)[0];
    if (mala && mala.eficiencia < 75) out.push(`La combinación ${mala.filtros.replace(/,/g, ' + ')} tiene eficiencia media de ${mala.eficiencia} %: no cubre todos los contaminantes. Usar la recomendación automática.`);
    if (kpi.red_co2 != null && kpi.red_co2 < 20) out.push(`El CO₂ apenas se reduce (${kpi.red_co2} %): HEPA y carbón activado no lo retienen; se requiere depurador de CO₂ o renovación de aire.`);
    if (kpi.lotes_criticos) out.push(`${kpi.lotes_criticos} ingresos llegaron con nivel dañino o peor: activar protocolo de prefiltrado y aviso al personal expuesto.`);
    if (!out.length) out.push('Todos los indicadores están dentro de la meta.');
    return out;
  }

  function procesosTabla(params = {}) {
    const { where, args } = filtroSql(params);
    return db.prepare(`SELECT * FROM v_comparacion ${where} ORDER BY fecha_ingreso DESC`).all(...args);
  }

  function csv(params = {}) {
    const filas = procesosTabla(params);
    if (!filas.length) return 'sin datos\n';
    const cols = Object.keys(filas[0]);
    const esc = v => (v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    return '﻿' + [cols.join(';'), ...filas.map(f => cols.map(c => esc(f[c])).join(';'))].join('\n') + '\n';
  }

  return { dashboard, procesosTabla, csv };
}

module.exports = { crearAnalitica, regresion };
