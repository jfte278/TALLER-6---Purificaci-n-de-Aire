// =====================================================================
// Lógica de negocio de los módulos 1, 2 y 3.
// =====================================================================
const M = require('./modelo');

class ErrorNegocio extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

const iso = d => d.toISOString();
const masMin = (fechaIso, min) => new Date(new Date(fechaIso).getTime() + min * 60000).toISOString();

function crearServicio(db) {
  const q = {
    insLote: db.prepare(`INSERT INTO lotes (fecha_ingreso,escenario,ubicacion,volumen_m3,fuente_datos,nivel_entrada,ica_pm25) VALUES (?,?,?,?,?,?,?)`),
    insMed: db.prepare(`INSERT INTO mediciones (lote_id,proceso_id,etapa,minuto,fecha_hora,pm25,pm10,co2,co,tvoc,nivel) VALUES (?,?,?,?,?,?,?,?,?,?,?)`),
    insAlerta: db.prepare(`INSERT INTO alertas (fecha,lote_id,proceso_id,tipo,contaminante,valor,umbral,severidad,mensaje) VALUES (?,?,?,?,?,?,?,?,?)`),
    lote: db.prepare(`SELECT * FROM lotes WHERE id = ?`),
    entrada: db.prepare(`SELECT * FROM mediciones WHERE lote_id = ? AND etapa = 'entrada'`),
    proceso: db.prepare(`SELECT * FROM procesos WHERE id = ?`),
    procesosLote: db.prepare(`SELECT * FROM procesos WHERE lote_id = ? ORDER BY id`),
    lecturas: db.prepare(`SELECT * FROM mediciones WHERE proceso_id = ? ORDER BY minuto, id`),
    alertasLote: db.prepare(`SELECT * FROM alertas WHERE lote_id = ? ORDER BY id`),
    filtros: db.prepare(`SELECT * FROM filtros`),
    usoFiltro: db.prepare(`UPDATE filtros SET horas_uso = horas_uso + ? WHERE codigo = ?`),
    alertaFiltroAbierta: db.prepare(`SELECT 1 FROM alertas WHERE tipo='FILTRO_SATURADO' AND contaminante = ? AND atendida = 0`),
  };

  const desgaste = () => Object.fromEntries(q.filtros.all().map(f => [f.codigo, f.horas_uso / f.vida_util_h]));

  function guardarMedicion(loteId, procId, etapa, minuto, fecha, m) {
    q.insMed.run(loteId, procId, etapa, minuto, fecha, m.pm25, m.pm10, m.co2, m.co, m.tvoc, M.nivelGlobal(m));
  }
  function alerta(fecha, loteId, procId, a) {
    q.insAlerta.run(fecha, loteId, procId, a.tipo, a.contaminante ?? null, a.valor ?? null, a.umbral ?? null, a.severidad, a.mensaje);
  }

  // ---------------- Módulo 1: ingreso y monitoreo ----------------
  function crearLote({ escenario = 'urbano', valores = null, fecha = null, rng = Math.random } = {}) {
    if (!M.ESCENARIOS[escenario]) throw new ErrorNegocio('Escenario no válido');
    let m;
    if (valores) {
      m = {};
      for (const k of M.CLAVES) {
        const v = Number(valores[k]);
        if (!Number.isFinite(v) || v < 0) throw new ErrorNegocio(`Valor inválido para ${M.CONTAMINANTES[k].nombre}`);
        m[k] = v;
      }
      m = M.redondear(m);
    } else m = M.leerSensores(escenario, rng);
    const f = fecha ? iso(new Date(fecha)) : iso(new Date());
    const esc = M.ESCENARIOS[escenario];
    const nivel = M.nivelGlobal(m);
    const { lastInsertRowid } = q.insLote.run(f, escenario, esc.ubicacion, M.VOLUMEN_CAMARA, valores ? 'manual' : 'sensor_simulado', nivel, M.icaPm25(m.pm25));
    const id = Number(lastInsertRowid);
    guardarMedicion(id, null, 'entrada', 0, f, m);
    for (const a of M.alertasEntrada(m)) alerta(f, id, null, a);
    return detalleLote(id);
  }

  function prediccion(medicion, filtros) {
    const k = M.constantes(filtros, desgaste());
    const p = M.predecirTiempo(medicion, k);
    return { minutos: Number.isFinite(p.total) ? Math.ceil(p.total) : null, por_contaminante: Object.fromEntries(Object.entries(p.por).map(([c, v]) => [c, Number.isFinite(v) ? Math.round(v * 10) / 10 : null])) };
  }

  function detalleLote(id) {
    const lote = q.lote.get(id);
    if (!lote) throw new ErrorNegocio('Lote no encontrado', 404);
    const entrada = q.entrada.get(id);
    const recomendados = M.recomendarFiltros(entrada);
    const procesos = q.procesosLote.all(id).map(p => ({ ...p, estado_json: undefined, lecturas: q.lecturas.all(p.id) }));
    return {
      lote, entrada,
      niveles: Object.fromEntries(M.CLAVES.map(c => [c, M.nivelDe(c, entrada[c])])),
      recomendacion: { filtros: recomendados, prediccion: prediccion(entrada, recomendados) },
      procesos, alertas: q.alertasLote.all(id),
    };
  }

  // ---------------- Módulo 2: proceso de descontaminación ----------------
  function iniciarProceso({ lote_id, filtros, duracion = 30, auto_stop = true, fecha = null }) {
    const lote = q.lote.get(lote_id);
    if (!lote) throw new ErrorNegocio('Lote no encontrado', 404);
    filtros = [...new Set(filtros || [])].filter(c => M.FILTRO[c]);
    if (!filtros.length) throw new ErrorNegocio('Seleccione al menos un filtro');
    duracion = Math.round(Number(duracion));
    if (!(duracion >= 1 && duracion <= 240)) throw new ErrorNegocio('La duración debe estar entre 1 y 240 minutos');
    const previos = q.procesosLote.all(lote_id);
    if (previos.some(p => p.estado === 'finalizado')) throw new ErrorNegocio('Este lote ya fue tratado. Registre un nuevo ingreso de aire.', 409);
    db.prepare(`UPDATE procesos SET estado='cancelado' WHERE lote_id = ? AND estado='en_curso'`).run(lote_id);

    const entrada = q.entrada.get(lote_id);
    const real = Object.fromEntries(M.CLAVES.map(c => [c, entrada[c]]));
    const k = M.constantes(filtros, desgaste());
    const pred = M.predecirTiempo(real, k);
    const inicio = fecha ? iso(new Date(fecha)) : iso(new Date());
    const { lastInsertRowid } = db.prepare(`INSERT INTO procesos (lote_id,filtros,inicio,duracion_programada,auto_stop,estado,minuto_actual,estado_json,tiempo_predicho_min)
      VALUES (?,?,?,?,?,'en_curso',0,?,?)`).run(lote_id, filtros.join(','), inicio, duracion, auto_stop ? 1 : 0,
      JSON.stringify({ real, k }), Number.isFinite(pred.total) ? Math.round(pred.total * 10) / 10 : null);
    const id = Number(lastInsertRowid);
    guardarMedicion(lote_id, id, 'proceso', 0, inicio, entrada);
    return { proceso: q.proceso.get(id), k, prediccion: prediccion(entrada, filtros) };
  }

  function paso(id, { rng = Math.random } = {}) {
    const p = q.proceso.get(id);
    if (!p) throw new ErrorNegocio('Proceso no encontrado', 404);
    if (p.estado !== 'en_curso') throw new ErrorNegocio('El proceso no está en curso', 409);
    const st = JSON.parse(p.estado_json);
    st.real = M.avanzar(st.real, st.k, 1);
    const minuto = p.minuto_actual + 1;
    const med = M.medir(st.real, rng);
    const nivel = M.nivelGlobal(med);
    guardarMedicion(p.lote_id, id, 'proceso', minuto, masMin(p.inicio, minuto), med);
    db.prepare(`UPDATE procesos SET minuto_actual = ?, estado_json = ? WHERE id = ?`).run(minuto, JSON.stringify(st), id);

    const entrada = q.entrada.get(p.lote_id);
    // Regla de inteligencia: a mitad del tiempo programado la reducción debe superar 40 %
    if (minuto === Math.ceil(p.duracion_programada / 2)) {
      for (const c of M.CLAVES) {
        if (M.nivelDe(c, entrada[c]) < 3) continue;
        const red = (entrada[c] - med[c]) / entrada[c] * 100;
        if (red < 40) alerta(masMin(p.inicio, minuto), p.lote_id, id, {
          tipo: 'EFICIENCIA_BAJA', contaminante: c, valor: Math.round(red * 10) / 10, umbral: 40, severidad: 'alta',
          mensaje: `A mitad del proceso ${M.CONTAMINANTES[c].nombre} solo se redujo ${red.toFixed(1)} %. Revise la selección o el estado del filtro.`,
        });
      }
    }
    // Predicción en línea: k ajustado con las lecturas reales del peor contaminante
    const lecturas = q.lecturas.all(id);
    let eta = null;
    const peores = M.CLAVES.filter(c => M.nivelDe(c, med[c]) > 1);
    if (peores.length) {
      const ests = peores.map(c => {
        const kEst = M.ajustarK(lecturas, c);
        if (!kEst || kEst <= 0.0005) return Infinity;
        const piso = M.CONTAMINANTES[c].piso;
        return Math.log((med[c] - piso) / (M.OBJETIVO[c] - piso)) / kEst;
      });
      const mx = Math.max(...ests);
      eta = Number.isFinite(mx) ? Math.ceil(mx) : null;
    } else eta = 0;

    const objetivo = nivel === 1;
    const terminado = minuto >= p.duracion_programada || (p.auto_stop === 1 && objetivo);
    return { proceso_id: id, minuto, medicion: med, nivel, objetivo_alcanzado: objetivo, terminado, eta_min: eta };
  }

  // ---------------- Módulo 3: validación del aire purificado ----------------
  function finalizar(id, { rng = Math.random } = {}) {
    const p = q.proceso.get(id);
    if (!p) throw new ErrorNegocio('Proceso no encontrado', 404);
    if (p.estado !== 'en_curso') throw new ErrorNegocio('El proceso no está en curso', 409);
    const st = JSON.parse(p.estado_json);
    const fin = masMin(p.inicio, p.minuto_actual);
    const entrada = q.entrada.get(p.lote_id);
    const salida = M.medir(st.real, rng);              // nueva medición independiente
    const nivelFin = M.nivelGlobal(salida);
    const red = {};
    for (const c of M.CLAVES) red[c] = Math.round(((entrada[c] - salida[c]) / entrada[c]) * 1000) / 10;
    const relevantes = M.CLAVES.filter(c => M.nivelDe(c, entrada[c]) > 1);
    const base = relevantes.length ? relevantes : ['pm25'];
    const eficiencia = Math.round(base.reduce((s, c) => s + Math.max(0, red[c]), 0) / base.length * 10) / 10;
    const resultado = M.clasificarResultado(nivelFin, eficiencia);

    guardarMedicion(p.lote_id, id, 'salida', p.minuto_actual, fin, salida);
    db.prepare(`UPDATE procesos SET estado='finalizado', fin=?, duracion_real_min=?, red_pm25=?, red_pm10=?, red_co2=?, red_co=?, red_tvoc=?, eficiencia_global=?, resultado=? WHERE id=?`)
      .run(fin, p.minuto_actual, red.pm25, red.pm10, red.co2, red.co, red.tvoc, eficiencia, resultado, id);

    if (nivelFin >= 3) alerta(fin, p.lote_id, id, {
      tipo: 'SALIDA_FUERA_NORMA', contaminante: M.CLAVES.reduce((a, c) => (M.nivelDe(c, salida[c]) > M.nivelDe(a, salida[a]) ? c : a), 'pm25'),
      valor: nivelFin, umbral: 2, severidad: nivelFin >= 4 ? 'critica' : 'alta',
      mensaje: `El aire tratado sale con nivel "${M.NIVELES[nivelFin].nombre}". No debe liberarse: repetir tratamiento.`,
    });
    // Desgaste de filtros y regla de mantenimiento preventivo (≥ 80 % de vida útil)
    for (const cod of p.filtros.split(',')) {
      q.usoFiltro.run(p.minuto_actual / 60, cod);
      const f = db.prepare(`SELECT * FROM filtros WHERE codigo = ?`).get(cod);
      const pct = f.horas_uso / f.vida_util_h * 100;
      if (pct >= 80 && !q.alertaFiltroAbierta.get(cod)) alerta(fin, null, id, {
        tipo: 'FILTRO_SATURADO', contaminante: cod, valor: Math.round(pct), umbral: 80, severidad: pct >= 100 ? 'critica' : 'media',
        mensaje: `${f.nombre} al ${pct.toFixed(0)} % de su vida útil: programe el reemplazo.`,
      });
    }
    return comparacion(id);
  }

  function comparacion(id) {
    const p = q.proceso.get(id);
    if (!p) throw new ErrorNegocio('Proceso no encontrado', 404);
    const entrada = q.entrada.get(p.lote_id);
    const lecturas = q.lecturas.all(id);
    const salida = lecturas.find(l => l.etapa === 'salida') || null;
    return { proceso: { ...p, estado_json: undefined }, lote: q.lote.get(p.lote_id), entrada, salida, lecturas: lecturas.filter(l => l.etapa === 'proceso'), alertas: q.alertasLote.all(p.lote_id) };
  }

  function cancelar(id) {
    const r = db.prepare(`UPDATE procesos SET estado='cancelado' WHERE id = ? AND estado='en_curso'`).run(id);
    if (!r.changes) throw new ErrorNegocio('El proceso no está en curso', 409);
    return { ok: true };
  }

  function reemplazarFiltro(codigo) {
    const r = db.prepare(`UPDATE filtros SET horas_uso = 0, ultimo_cambio = ? WHERE codigo = ?`).run(iso(new Date()), codigo);
    if (!r.changes) throw new ErrorNegocio('Filtro no encontrado', 404);
    db.prepare(`UPDATE alertas SET atendida = 1 WHERE tipo='FILTRO_SATURADO' AND contaminante = ?`).run(codigo);
    return { ok: true };
  }

  // Ejecuta un proceso completo (lo usa el generador de datos históricos)
  function simularCompleto({ lote_id, filtros, duracion, auto_stop = true, fecha, rng }) {
    const { proceso } = iniciarProceso({ lote_id, filtros, duracion, auto_stop, fecha });
    let r;
    do { r = paso(proceso.id, { rng }); } while (!r.terminado);
    return finalizar(proceso.id, { rng });
  }

  return { crearLote, detalleLote, prediccion, iniciarProceso, paso, finalizar, comparacion, cancelar, reemplazarFiltro, simularCompleto };
}

module.exports = { crearServicio, ErrorNegocio };
