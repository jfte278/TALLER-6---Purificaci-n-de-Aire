// Interfaz de la aplicación. Está hecha con JavaScript normal, sin React ni otros frameworks.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CLAVES = ['pm25', 'pm10', 'co2', 'co', 'tvoc'];
const SERIE_VAR = { pm25: '--s1', pm10: '--s2', co2: '--s3', co: '--s4', tvoc: '--s5' };
let cfg, loteActual = null, corriendo = false, detenerSolicitado = false;
const charts = {};

async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Error');
  return data;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
}
const num = (v, d = 1) => v == null ? '—' : Number(v).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: d });
const fval = (k, v) => num(v, cfg.contaminantes[k].dec);
const fecha = s => new Date(s).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function nivelDe(k, v) { const c = cfg.cortes[k]; let i = 0; while (i < c.length && v > c[i]) i++; return i + 1; }
function badgeNivel(n) { const nv = cfg.niveles[n]; return `<span class="badge"><i style="background:${nv.color}"></i>${esc(nv.nombre)}</span>`; }
function badgeResultado(r) { if (!r) return '<span class="badge">Sin tratar</span>'; const c = r === 'Óptimo' ? 'ok' : r === 'Aceptable' ? 'mid' : 'bad'; return `<span class="badge ${c}">${esc(r)}</span>`; }
const nombreFiltros = s => s.split(',').map(c => cfg.filtros.find(f => f.codigo === c)?.nombre || c).join(' + ');

// ---------- gráficos ----------
function tema() {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = css('--text-2');
  Chart.defaults.borderColor = css('--grid');
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.boxHeight = 12;
  Chart.defaults.plugins.tooltip.backgroundColor = css('--text');
  Chart.defaults.plugins.tooltip.titleColor = css('--surface');
  Chart.defaults.plugins.tooltip.bodyColor = css('--surface');
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation.duration = 350;
}
function grafico(id, config) {
  charts[id]?.destroy();
  charts[id] = new Chart(document.getElementById(id), config);
  return charts[id];
}
const ejeY = (titulo, extra = {}) => ({ beginAtZero: true, title: { display: !!titulo, text: titulo }, grid: { color: css('--grid') }, border: { display: false }, ...extra });
const ejeX = (extra = {}) => ({ grid: { display: false }, border: { color: css('--border') }, ...extra });

// ---------- navegación ----------
const cargadores = { monitoreo: () => {}, proceso: renderProceso, validacion: cargarValidacion, dashboard: cargarDashboard, reportes: cargarReportes };
function mostrar() {
  const tab = (location.hash || '#monitoreo').slice(1).split('?')[0];
  const id = cargadores[tab] ? tab : 'monitoreo';
  document.querySelectorAll('.vista').forEach(s => (s.hidden = s.id !== id));
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('activo', a.dataset.tab === id));
  cargadores[id]();
}
window.addEventListener('hashchange', mostrar);
setInterval(() => ($('#reloj').textContent = new Date().toLocaleTimeString('es-CO')), 1000);
function estado(txt, on) { $('#txtEstado').textContent = txt; $('#dotEstado').classList.toggle('on', on); }

// =====================================================================
// MÓDULO 1 - Monitoreo
// =====================================================================
function initMonitoreo() {
  $('#selEscenario').innerHTML = Object.entries(cfg.escenarios).map(([k, v]) => `<option value="${k}">${esc(v.nombre)}</option>`).join('');
  $('#fEscenario').innerHTML += Object.entries(cfg.escenarios).map(([k, v]) => `<option value="${k}">${esc(v.nombre)}</option>`).join('');
  $('#manual').innerHTML = CLAVES.map(k => `<label>${cfg.contaminantes[k].nombre} (${cfg.contaminantes[k].unidad})<input type="number" step="any" min="0" id="m_${k}"></label>`).join('');
  document.querySelectorAll('input[name=fuente]').forEach(r => r.addEventListener('change', () => ($('#manual').hidden = r.value !== 'manual' || !r.checked)));
  $('#btnDetectar').addEventListener('click', detectar);
}

async function detectar() {
  const manual = document.querySelector('input[name=fuente]:checked').value === 'manual';
  let valores = null;
  if (manual) {
    valores = {};
    for (const k of CLAVES) {
      const v = $('#m_' + k).value;
      if (v === '') return toast(`Ingrese el valor de ${cfg.contaminantes[k].nombre}`);
      valores[k] = Number(v);
    }
  }
  const btn = $('#btnDetectar'); btn.disabled = true;
  $('#lecturaSensores').hidden = false;
  $('#lecturaSensores .barra').innerHTML = '<i></i>';
  estado('Aire ingresando - leyendo sensores', true);
  await sleep(1100);
  try {
    loteActual = await api('/api/lotes', { method: 'POST', body: { escenario: $('#selEscenario').value, valores } });
    renderLote(loteActual);
    cargarLotes();
    const n = loteActual.alertas.length;
    toast(`Ingreso #${loteActual.lote.id} registrado${n ? ` - ${n} alerta(s) generadas` : ''}`);
  } catch (e) { toast(e.message); }
  btn.disabled = false; $('#lecturaSensores').hidden = true; estado('Sistema en espera', false);
}

function renderLote(d) {
  const { lote, entrada, niveles, recomendacion, alertas, procesos } = d;
  const tratado = procesos.find(p => p.estado === 'finalizado');
  const ica = lote.ica_pm25, nivelIca = nivelDe('pm25', entrada.pm25);
  $('#panelLote').innerHTML = `
    <div class="lote-head">
      <div><h2>Ingreso #${lote.id} · ${esc(cfg.escenarios[lote.escenario]?.nombre)}</h2>
        <div class="meta">${fecha(lote.fecha_ingreso)} · ${esc(lote.ubicacion)} · ${lote.fuente_datos === 'manual' ? 'Ingreso manual' : 'Sensores'} · Cámara ${lote.volumen_m3} m³</div></div>
      <div>Nivel global: ${badgeNivel(lote.nivel_entrada)}</div>
    </div>
    <div class="sensores">${CLAVES.map(k => {
      const c = cfg.contaminantes[k], n = niveles[k];
      return `<div class="sensor" style="--c:${cfg.niveles[n].color}"><small>${c.nombre}</small><b>${fval(k, entrada[k])}</b><span>${c.unidad}</span><em><i></i>${esc(cfg.niveles[n].nombre)}</em></div>`;
    }).join('')}</div>
    <div class="cols2">
      <div>
        <h3>Índice de calidad del aire (ICA) por PM2.5</h3>
        <div class="ica"><span class="ica-num">${ica}</span><div style="flex:1">${badgeNivel(nivelIca)}
          <div class="escala">${cfg.niveles.slice(1).map(n => `<span style="background:${n.color}" title="${esc(n.nombre)}"></span>`).join('')}</div>
          <small>0 · 50 · 100 · 150 · 200 · 300 · 500</small></div></div>
        <h3 style="margin-top:16px">Alertas generadas</h3>
        ${alertas.length ? `<ul class="alertas">${alertas.map(a => `<li class="${a.severidad}"><b>${a.severidad}</b>${esc(a.mensaje)}</li>`).join('')}</ul>` : '<p class="meta">Sin alertas: todos los contaminantes por debajo de los umbrales.</p>'}
      </div>
      <div>
        <h3>Tratamiento recomendado (motor de reglas)</h3>
        <div class="chips">${recomendacion.filtros.map(c => `<span class="chip">${esc(cfg.filtros.find(f => f.codigo === c).nombre)}</span>`).join('')}</div>
        <p class="meta">Tiempo estimado para alcanzar calidad "Buena": <b>${recomendacion.prediccion.minutos ?? '—'} min</b> (modelo de decaimiento exponencial, cámara de ${cfg.volumen_camara} m³).</p>
        ${tratado ? `<p>Este ingreso ya fue tratado: ${badgeResultado(tratado.resultado)}</p><a class="btn" href="#validacion?p=${tratado.id}">Ver validación</a>`
                  : `<a class="btn primario" href="#proceso">Iniciar descontaminación →</a>`}
      </div>
    </div>`;
}

async function cargarLotes() {
  const lotes = await api('/api/lotes?limit=15');
  $('#tablaLotes').innerHTML = `<thead><tr><th>#</th><th>Fecha de ingreso</th><th>Escenario</th><th class="n">ICA PM2.5</th><th>Nivel</th><th>Tratamiento</th></tr></thead><tbody>${
    lotes.map(l => `<tr class="click" data-id="${l.id}"><td>${l.id}</td><td>${fecha(l.fecha_ingreso)}</td><td>${esc(cfg.escenarios[l.escenario]?.nombre)}</td><td class="n">${l.ica_pm25}</td><td>${badgeNivel(l.nivel_entrada)}</td><td>${l.estado === 'finalizado' ? badgeResultado(l.resultado) : l.estado === 'en_curso' ? '<span class="badge">En curso</span>' : '<span class="badge">Pendiente</span>'}</td></tr>`).join('')}</tbody>`;
  $('#tablaLotes').querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', async () => {
    loteActual = await api('/api/lotes/' + tr.dataset.id); renderLote(loteActual); window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  return lotes;
}

// =====================================================================
// MÓDULO 2 - Proceso de descontaminación
// =====================================================================
let filtrosEstado = [];
async function renderProceso() {
  if (corriendo) return;
  filtrosEstado = await api('/api/filtros');
  if (loteActual) loteActual = await api('/api/lotes/' + loteActual.lote.id);
  const d = loteActual;
  if (!d) { $('#loteActivo').innerHTML = 'Primero registre un ingreso de aire en el Módulo 1.'; $('#btnActivar').disabled = true; return; }
  const tratado = d.procesos.find(p => p.estado === 'finalizado');
  $('#loteActivo').innerHTML = `<b>Ingreso #${d.lote.id}</b> · ${esc(cfg.escenarios[d.lote.escenario].nombre)} · ${badgeNivel(d.lote.nivel_entrada)}<br>
    <small>PM2.5 ${fval('pm25', d.entrada.pm25)} µg/m³ · PM10 ${fval('pm10', d.entrada.pm10)} · CO₂ ${fval('co2', d.entrada.co2)} ppm · CO ${fval('co', d.entrada.co)} ppm · COV ${fval('tvoc', d.entrada.tvoc)} mg/m³</small>
    ${tratado ? `<br><small><b>Ya tratado</b> (${esc(tratado.resultado)}). Se muestra el registro del proceso; para un nuevo tratamiento registre otro ingreso.</small>` : ''}`;
  const rec = d.recomendacion.filtros;
  const sel = tratado ? tratado.filtros.split(',') : rec;
  $('#listaFiltros').innerHTML = cfg.filtros.map(f => {
    const est = filtrosEstado.find(x => x.codigo === f.codigo);
    return `<label class="filtro"><input type="checkbox" value="${f.codigo}" ${sel.includes(f.codigo) ? 'checked' : ''}>
      <span><b>${esc(f.nombre)}</b></span>${rec.includes(f.codigo) ? '<span class="rec">Recomendado</span>' : '<span></span>'}
      <small>${esc(f.tecnologia)} · Remueve: ${esc(f.objetivo)} · CADR ${f.cadr_m3h} m³/h · vida útil usada ${num(est.pct_uso)} %</small>
      <span class="vida ${est.pct_uso >= 80 ? 'alta' : ''}"><i style="width:${Math.min(100, est.pct_uso)}%"></i></span></label>`;
  }).join('');
  $('#listaFiltros').querySelectorAll('input').forEach(i => i.addEventListener('change', actualizarPrediccion));
  const sugerida = Math.min(120, Math.max(5, Math.ceil((d.recomendacion.prediccion.minutos || 40) * 1.2)));
  $('#rngDuracion').value = tratado ? tratado.duracion_programada : sugerida;
  $('#lblDuracion').textContent = $('#rngDuracion').value + ' min';
  $('#btnActivar').disabled = !!tratado;
  actualizarPrediccion();
  if (tratado) dibujarProceso(d.entrada, tratado.lecturas.filter(l => l.etapa === 'proceso'), tratado.duracion_programada);
  else dibujarProceso(d.entrada, [], Number($('#rngDuracion').value));
}
$('#rngDuracion').addEventListener('input', e => ($('#lblDuracion').textContent = e.target.value + ' min'));
const filtrosSel = () => [...$('#listaFiltros').querySelectorAll('input:checked')].map(i => i.value);

async function actualizarPrediccion() {
  if (!loteActual) return;
  const f = filtrosSel();
  if (!f.length) { $('#prediccion').innerHTML = '<span class="warn">Seleccione al menos una tecnología.</span>'; return; }
  const p = await api('/api/prediccion', { method: 'POST', body: { lote_id: loteActual.lote.id, filtros: f } });
  const sin = CLAVES.filter(k => p.por_contaminante[k] === null).map(k => cfg.contaminantes[k].nombre);
  $('#prediccion').innerHTML = `Predicción del modelo: ${p.minutos != null ? `<b>${p.minutos} min</b> para alcanzar calidad "Buena"` : '<b>no alcanza</b> calidad "Buena"'}
    ${sin.length ? `<span class="warn">⚠ ${sin.join(', ')} no se reduce(n) con esta selección de filtros.</span>` : ''}`;
}

function dibujarProceso(entrada, lecturas, duracion) {
  const labels = lecturas.map(l => l.minuto);
  grafico('chProceso', {
    type: 'line',
    data: { labels, datasets: CLAVES.map(k => ({ label: cfg.contaminantes[k].nombre, data: lecturas.map(l => +(l[k] / entrada[k] * 100).toFixed(1)), borderColor: css(SERIE_VAR[k]), backgroundColor: css(SERIE_VAR[k]), borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: .25 })) },
    options: { interaction: { mode: 'index', intersect: false }, animation: false,
      scales: { x: ejeX({ title: { display: true, text: 'Minuto' } }), y: ejeY('% del valor inicial', { max: 110 }) },
      plugins: { legend: { position: 'top', align: 'start' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y} % (${fval(CLAVES[c.datasetIndex], lecturas[c.dataIndex]?.[CLAVES[c.datasetIndex]])} ${cfg.contaminantes[CLAVES[c.datasetIndex]].unidad})` } } } },
  });
  const ult = lecturas[lecturas.length - 1];
  $('#lblMinuto').textContent = ult ? ult.minuto : 0;
  $('#lblNivelProc').innerHTML = ult ? badgeNivel(ult.nivel) : '—';
  $('#lblEta').textContent = '—';
  $('#barProgreso').style.width = ult ? Math.min(100, ult.minuto / duracion * 100) + '%' : '0';
  renderRegistro(lecturas);
}
function renderRegistro(lecturas) {
  $('#tablaRegistro').innerHTML = `<thead><tr><th class="n">Min</th><th>Hora (simulada)</th>${CLAVES.map(k => `<th class="n">${cfg.contaminantes[k].nombre}</th>`).join('')}<th>Nivel</th></tr></thead><tbody>${
    [...lecturas].reverse().map(l => `<tr><td class="n">${l.minuto}</td><td>${new Date(l.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</td>${CLAVES.map(k => `<td class="n">${fval(k, l[k])}</td>`).join('')}<td>${badgeNivel(l.nivel)}</td></tr>`).join('')}</tbody>`;
}

$('#btnActivar').addEventListener('click', async () => {
  const filtros = filtrosSel();
  if (!filtros.length) return toast('Seleccione al menos un filtro');
  const duracion = Number($('#rngDuracion').value);
  let ini;
  try { ini = await api('/api/procesos', { method: 'POST', body: { lote_id: loteActual.lote.id, filtros, duracion, auto_stop: $('#chkAuto').checked } }); }
  catch (e) { return toast(e.message); }
  corriendo = true; detenerSolicitado = false;
  $('#btnActivar').disabled = true; $('#btnDetener').disabled = false;
  $('#listaFiltros').querySelectorAll('input').forEach(i => (i.disabled = true));
  $('#ventilador').classList.add('on');
  estado(`Purificando ingreso #${loteActual.lote.id}`, true);
  const entrada = loteActual.entrada;
  const lecturas = [{ ...entrada, minuto: 0, fecha_hora: ini.proceso.inicio }];
  dibujarProceso(entrada, lecturas, duracion);
  const ch = charts.chProceso;
  try {
    while (true) {
      await sleep(Number($('#selVelocidad').value));
      const r = await api(`/api/procesos/${ini.proceso.id}/paso`, { method: 'POST' });
      const l = { ...r.medicion, minuto: r.minuto, nivel: r.nivel, fecha_hora: new Date(new Date(ini.proceso.inicio).getTime() + r.minuto * 60000).toISOString() };
      lecturas.push(l);
      ch.data.labels.push(r.minuto);
      CLAVES.forEach((k, i) => ch.data.datasets[i].data.push(+(l[k] / entrada[k] * 100).toFixed(1)));
      ch.update('none');
      $('#lblMinuto').textContent = r.minuto;
      $('#lblNivelProc').innerHTML = badgeNivel(r.nivel);
      $('#lblEta').textContent = r.eta_min == null ? (r.minuto < 3 ? 'calculando…' : 'no alcanzable con estos filtros') : r.eta_min === 0 ? 'objetivo alcanzado' : `≈ ${r.eta_min} min`;
      $('#barProgreso').style.width = Math.min(100, r.minuto / duracion * 100) + '%';
      renderRegistro(lecturas);
      if (r.terminado || detenerSolicitado) break;
    }
    const comp = await api(`/api/procesos/${ini.proceso.id}/finalizar`, { method: 'POST' });
    toast(`Proceso finalizado en ${comp.proceso.duracion_real_min} min - resultado: ${comp.proceso.resultado}`);
    location.hash = `#validacion?p=${ini.proceso.id}`;
  } catch (e) { toast(e.message); }
  finally {
    corriendo = false; $('#btnDetener').disabled = true; $('#ventilador').classList.remove('on'); estado('Sistema en espera', false);
    $('#listaFiltros').querySelectorAll('input').forEach(i => (i.disabled = false));
    cargarLotes();
  }
});
$('#btnDetener').addEventListener('click', () => { detenerSolicitado = true; toast('Deteniendo: se realizará la medición de salida'); });

// =====================================================================
// MÓDULO 3 - Validación
// =====================================================================
async function cargarValidacion() {
  const filas = (await api('/api/reportes/procesos')).filter(f => f.proceso_id);
  const pedido = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('p')) || filas[0]?.proceso_id;
  $('#selProceso').innerHTML = filas.slice(0, 80).map(f => `<option value="${f.proceso_id}" ${f.proceso_id === pedido ? 'selected' : ''}>Proceso #${f.proceso_id} · ingreso #${f.lote_id} · ${fecha(f.fecha_ingreso)} · ${esc(cfg.escenarios[f.escenario]?.nombre)} · ${esc(f.resultado)}</option>`).join('');
  $('#selProceso').onchange = e => { location.hash = '#validacion?p=' + e.target.value; };
  if (pedido) renderValidacion(await api('/api/procesos/' + pedido));
  else $('#panelValidacion').innerHTML = '<div class="card vacio">Aún no hay procesos finalizados.</div>';
}

function renderValidacion(c) {
  const { proceso: p, entrada: e, salida: s, lote } = c;
  if (!s) { $('#panelValidacion').innerHTML = '<div class="card vacio">El proceso no tiene medición de salida.</div>'; return; }
  const red = k => p['red_' + k];
  const mejorados = CLAVES.filter(k => nivelDe(k, s[k]) < nivelDe(k, e[k])).map(k => cfg.contaminantes[k].nombre);
  const pendientes = CLAVES.filter(k => nivelDe(k, s[k]) > 1).map(k => cfg.contaminantes[k].nombre);
  $('#panelValidacion').innerHTML = `
  <div class="card">
    <div class="veredicto"><div><small>Resultado del tratamiento</small><div class="big">${badgeResultado(p.resultado)}</div></div>
      <div><small>Calidad</small><div>${badgeNivel(e.nivel)} → ${badgeNivel(s.nivel)}</div></div>
      <div><small>Eficiencia global</small><div class="big">${num(p.eficiencia_global)} %</div></div>
      <div><small>Tiempo de purificación</small><div class="big">${p.duracion_real_min} min</div><small>programado ${p.duracion_programada} · predicho ${num(p.tiempo_predicho_min)}</small></div></div>
    <p class="meta">Ingreso #${lote.id} · ${esc(cfg.escenarios[lote.escenario].nombre)} · ${fecha(p.inicio)} → ${fecha(p.fin)} · Tecnologías: <b>${esc(nombreFiltros(p.filtros))}</b></p>
    <div class="tabla-scroll"><table><thead><tr><th>Contaminante</th><th class="n">Antes</th><th class="n">Después</th><th>Unidad</th><th class="n">Reducción</th><th>Nivel antes</th><th>Nivel después</th><th class="n">Meta "Buena"</th></tr></thead><tbody>
      ${CLAVES.map(k => `<tr><td><b>${cfg.contaminantes[k].nombre}</b></td><td class="n">${fval(k, e[k])}</td><td class="n">${fval(k, s[k])}</td><td>${cfg.contaminantes[k].unidad}</td>
        <td class="n"><span class="reduccion ${red(k) >= 0 ? 'pos' : 'neg'}">${num(red(k))} %</span></td><td>${badgeNivel(nivelDe(k, e[k]))}</td><td>${badgeNivel(nivelDe(k, s[k]))}</td><td class="n">≤ ${num(cfg.cortes[k][0], 2)}</td></tr>`).join('')}
    </tbody></table></div>
    <p><b>Análisis:</b> el tratamiento redujo PM2.5 en ${num(red('pm25'))} % y PM10 en ${num(red('pm10'))} %. ${mejorados.length ? `Mejoraron de nivel: ${mejorados.join(', ')}.` : ''}
      ${pendientes.length ? `Aún fuera de la categoría "Buena": ${pendientes.join(', ')}${p.filtros.includes('CO2') || !pendientes.includes('CO₂') ? '' : ' (el CO₂ requiere depurador o renovación de aire; HEPA y carbón activado no lo retienen)'}.` : 'Todos los contaminantes quedaron en categoría "Buena": el aire puede liberarse.'}</p>
  </div>
  <div class="grid g2">
    <div class="card chart-box"><h3>Material particulado antes vs. después (µg/m³)</h3><div class="chart h280"><canvas id="chValPm"></canvas></div></div>
    <div class="card chart-box"><h3>Porcentaje de reducción por contaminante</h3><div class="chart h280"><canvas id="chValRed"></canvas></div></div>
  </div>`;
  grafico('chValPm', {
    type: 'bar',
    data: { labels: ['PM2.5', 'PM10'], datasets: [
      { label: 'Antes (entrada)', data: [e.pm25, e.pm10], backgroundColor: css('--s-entrada'), borderRadius: 4, maxBarThickness: 46 },
      { label: 'Después (salida)', data: [s.pm25, s.pm10], backgroundColor: css('--s-salida'), borderRadius: 4, maxBarThickness: 46 }] },
    options: { scales: { x: ejeX(), y: ejeY('µg/m³') }, plugins: { legend: { position: 'top', align: 'start' } } },
  });
  grafico('chValRed', {
    type: 'bar',
    data: { labels: CLAVES.map(k => cfg.contaminantes[k].nombre), datasets: [{ label: 'Reducción %', data: CLAVES.map(k => red(k)), backgroundColor: css('--s1'), borderRadius: 4, maxBarThickness: 34 }] },
    options: { indexAxis: 'y', scales: { x: ejeY('%', { max: 100, min: Math.min(0, Math.floor(Math.min(...CLAVES.map(red)) / 10) * 10) }), y: ejeX() }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${num(c.parsed.x)} %` } } } },
  });
}

// =====================================================================
// MÓDULO 4 - Dashboard BI
// =====================================================================
function paramsFiltro() {
  const p = new URLSearchParams();
  if ($('#fDesde').value) p.set('desde', $('#fDesde').value);
  if ($('#fHasta').value) p.set('hasta', $('#fHasta').value);
  if ($('#fEscenario').value) p.set('escenario', $('#fEscenario').value);
  return p.toString();
}
$('#btnFiltrar').addEventListener('click', cargarDashboard);
$('#btnLimpiar').addEventListener('click', () => { $('#fDesde').value = $('#fHasta').value = $('#fEscenario').value = ''; cargarDashboard(); });

async function cargarDashboard() {
  const d = await api('/api/dashboard?' + paramsFiltro());
  const k = d.kpi;
  const kpi = (t, v, u, p) => `<div class="kpi"><small>${t}</small><b>${v}${u ? ` <span>${u}</span>` : ''}</b><p>${p}</p></div>`;
  $('#kpis').innerHTML =
    kpi('PM2.5 antes → después', `${num(k.pm25_ini_t)}<span class="flecha">→</span>${num(k.pm25_fin)}`, 'µg/m³', `Concentración media de material particulado (${k.procesos} tratamientos)`) +
    kpi('CO₂ antes → después', `${num(k.co2_ini, 0)}<span class="flecha">→</span>${num(k.co2_fin, 0)}`, 'ppm', `Reducción media de CO₂: ${num(k.red_co2)} %`) +
    kpi('Reducción de PM2.5', num(k.red_pm25), '%', `PM10 ${num(k.red_pm10)} % · CO ${num(k.red_co)} % · COV ${num(k.red_tvoc)} %`) +
    kpi('Tiempo de purificación', num(k.tiempo_prom), 'min', `Promedio por tratamiento · máximo ${num(k.tiempo_max, 0)} min`) +
    kpi('Aire tratado conforme', num(k.pct_conforme), '%', `Óptimo ${k.optimos ?? 0} · Aceptable ${k.aceptables ?? 0} · Insuficiente ${k.insuficientes ?? 0}`) +
    kpi('Alertas abiertas', k.alertas_abiertas, '', `${k.alertas_criticas} críticas · ${k.lotes} ingresos en el periodo`);

  grafico('chSerie', {
    type: 'line',
    data: { labels: d.serie.map(s => s.dia.slice(5)), datasets: [
      { label: 'Entrada (aire contaminado)', data: d.serie.map(s => s.pm25_ini), borderColor: css('--s-entrada'), backgroundColor: css('--s-entrada'), borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: .3 },
      { label: 'Salida (aire purificado)', data: d.serie.map(s => s.pm25_fin), borderColor: css('--s-salida'), backgroundColor: css('--s-salida'), borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: .3, spanGaps: true }] },
    options: { interaction: { mode: 'index', intersect: false }, scales: { x: ejeX({ ticks: { maxTicksLimit: 10 } }), y: ejeY('µg/m³') }, plugins: { legend: { position: 'top', align: 'start' } } },
  });
  grafico('chReduccion', {
    type: 'bar',
    data: { labels: CLAVES.map(c => cfg.contaminantes[c].nombre), datasets: [{ label: 'Reducción promedio', data: CLAVES.map(c => k['red_' + c]), backgroundColor: css('--s3'), borderRadius: 4, maxBarThickness: 48 }] },
    options: { scales: { x: ejeX(), y: ejeY('%', { max: 100 }) }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${num(c.parsed.y)} %` } } } },
  });
  const tot = arr => arr.reduce((s, x) => s + x.n, 0) || 1;
  const te = tot(d.niveles), ts = tot(d.nivelesSalida);
  grafico('chNiveles', {
    type: 'bar',
    data: { labels: ['Entrada', 'Salida'], datasets: cfg.niveles.slice(1).map(nv => ({
      label: nv.nombre, backgroundColor: nv.color, borderColor: css('--surface'), borderWidth: { left: 0, right: 2, top: 0, bottom: 0 }, maxBarThickness: 60,
      data: [+((d.niveles.find(x => x.nivel === nv.id)?.n || 0) / te * 100).toFixed(1), +((d.nivelesSalida.find(x => x.nivel === nv.id)?.n || 0) / ts * 100).toFixed(1)] })) },
    options: { indexAxis: 'y', scales: { x: ejeY('% de ingresos', { stacked: true, max: 100 }), y: ejeX({ stacked: true }) }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${num(c.parsed.x)} %` } } } },
  });
  if (d.modelo) {
    const xs = d.modelo.puntos.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    grafico('chModelo', {
      type: 'scatter',
      data: { datasets: [
        { label: 'Tratamientos (HEPA, objetivo alcanzado)', data: d.modelo.puntos.map(([x, y]) => ({ x, y })), backgroundColor: css('--s1'), borderColor: css('--surface'), borderWidth: 2, pointRadius: 5, pointHoverRadius: 7 },
        { label: 'Regresión lineal', type: 'line', data: [{ x: x0, y: d.modelo.a + d.modelo.b * x0 }, { x: x1, y: d.modelo.a + d.modelo.b * x1 }], borderColor: css('--s2'), borderWidth: 2, pointRadius: 0 }] },
      options: { scales: { x: ejeY('PM2.5 inicial (µg/m³)', { type: 'linear', grid: { display: false } }), y: ejeY('Minutos') }, plugins: { legend: { position: 'top', align: 'start' }, tooltip: { callbacks: { label: c => ` PM2.5 ${num(c.parsed.x)} µg/m³ → ${num(c.parsed.y)} min` } } } },
    });
    $('#txtModelo').innerHTML = `Tiempo ≈ ${num(d.modelo.a)} + ${num(d.modelo.b, 3)} × PM2.5 inicial (R² = ${num(d.modelo.r2, 3)}, n = ${d.modelo.n}). El modelo de decaimiento exponencial que usa la app al iniciar cada proceso tuvo un error medio absoluto de <b>${num(d.modelo.mae_prediccion_min)} min</b>.`;
  } else { charts.chModelo?.destroy(); $('#txtModelo').textContent = 'Datos insuficientes para ajustar el modelo en este filtro.'; }
  const escs = [...d.escenarios].sort((a, b) => (b.tiempo || 0) - (a.tiempo || 0));
  grafico('chEscenarios', {
    type: 'bar',
    data: { labels: escs.map(e => e.nombre), datasets: [{ label: 'Minutos promedio', data: escs.map(e => e.tiempo), backgroundColor: css('--s1'), borderRadius: 4, maxBarThickness: 30 }] },
    options: { indexAxis: 'y', scales: { x: ejeY('min'), y: ejeX() }, plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: c => `${escs[c.dataIndex].n} ingresos · eficiencia ${num(escs[c.dataIndex].eficiencia)} %` } } } },
  });
  $('#estadoFiltros').innerHTML = `<div class="barras-vida">${d.filtros.map(f => `<div class="f"><span><b>${esc(f.nombre)}</b> · ${num(f.horas_uso, 0)} / ${f.vida_util_h} h</span>
    <span>${num(f.pct_uso)} % ${f.pct_uso >= 80 ? `<button class="btn mini" data-reemplazar="${f.codigo}">Reemplazar</button>` : ''}</span><span class="vida ${f.pct_uso >= 80 ? 'alta' : ''}"><i style="width:${Math.min(100, f.pct_uso)}%"></i></span></div>`).join('')}</div>`;
  $('#estadoFiltros').querySelectorAll('[data-reemplazar]').forEach(b => b.addEventListener('click', async () => { await api(`/api/filtros/${b.dataset.reemplazar}/reemplazar`, { method: 'POST' }); toast('Filtro reemplazado: vida útil reiniciada'); cargarDashboard(); }));
  $('#recos').innerHTML = d.recomendaciones.map(r => `<li>${esc(r)}</li>`).join('');
  const tipos = { CONTAMINACION_ENTRADA: 'Contaminación en entrada', EFICIENCIA_BAJA: 'Eficiencia baja', SALIDA_FUERA_NORMA: 'Salida fuera de norma', FILTRO_SATURADO: 'Filtro saturado' };
  $('#tablaAlertas').innerHTML = `<thead><tr><th>Fecha</th><th>Tipo</th><th>Severidad</th><th>Ingreso</th><th>Mensaje</th><th></th></tr></thead><tbody>${
    d.alertas.map(a => `<tr class="${a.atendida ? 'atendida' : ''}"><td>${fecha(a.fecha)}</td><td>${tipos[a.tipo]}</td><td><span class="badge ${a.severidad === 'critica' ? 'bad' : a.severidad === 'alta' ? 'mid' : ''}">${a.severidad}</span></td><td>${a.lote_id ? '#' + a.lote_id : '—'}</td><td style="white-space:normal;min-width:280px">${esc(a.mensaje)}</td>
      <td>${a.atendida ? 'Atendida' : `<button class="btn mini" data-atender="${a.id}">Atender</button>`}</td></tr>`).join('')}</tbody>`;
  $('#tablaAlertas').querySelectorAll('[data-atender]').forEach(b => b.addEventListener('click', async () => { await api(`/api/alertas/${b.dataset.atender}/atender`, { method: 'POST' }); cargarDashboard(); }));
  return d;
}

// =====================================================================
// REPORTES
// =====================================================================
async function cargarReportes() {
  const q = paramsFiltro();
  const [d, filas] = await Promise.all([api('/api/dashboard?' + q), api('/api/reportes/procesos?' + q)]);
  $('#lnkCsv').href = '/api/reportes/procesos.csv' + (q ? '?' + q : '');
  const k = d.kpi;
  const dias = filas.map(f => f.dia).sort();
  $('#resumenEjecutivo').innerHTML = `<h2>Resumen ejecutivo</h2>
    <p class="meta">Periodo: ${dias[0] || '—'} a ${dias[dias.length - 1] || '—'}${$('#fEscenario').value ? ' · Escenario: ' + esc(cfg.escenarios[$('#fEscenario').value].nombre) : ''} · Generado ${new Date().toLocaleString('es-CO')}</p>
    <p>Se registraron <b>${k.lotes}</b> ingresos de aire contaminado y se completaron <b>${k.procesos}</b> tratamientos. La concentración media de PM2.5 bajó de <b>${num(k.pm25_ini_t)}</b> a <b>${num(k.pm25_fin)} µg/m³</b> (−${num(k.red_pm25)} %) y la de PM10 se redujo ${num(k.red_pm10)} %.
    El CO₂ pasó de ${num(k.co2_ini, 0)} a ${num(k.co2_fin, 0)} ppm (−${num(k.red_co2)} %). El tiempo medio de purificación fue de <b>${num(k.tiempo_prom)} min</b> y el <b>${num(k.pct_conforme)} %</b> de los tratamientos entregó aire conforme (Óptimo ${k.optimos ?? 0}, Aceptable ${k.aceptables ?? 0}, Insuficiente ${k.insuficientes ?? 0}).</p>
    <h3>Decisiones recomendadas</h3><ul class="recos">${d.recomendaciones.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`;
  $('#tablaReporte').innerHTML = `<thead><tr><th>Ingreso</th><th>Fecha</th><th>Escenario</th><th>Tecnologías</th><th class="n">PM2.5 ini</th><th class="n">PM2.5 fin</th><th class="n">CO₂ ini</th><th class="n">CO₂ fin</th><th class="n">Red. PM2.5</th><th class="n">Eficiencia</th><th class="n">Min</th><th>Resultado</th></tr></thead><tbody>${
    filas.map(f => `<tr><td>#${f.lote_id}</td><td>${fecha(f.fecha_ingreso)}</td><td>${esc(cfg.escenarios[f.escenario]?.nombre)}</td><td>${f.filtros ? esc(f.filtros.replace(/,/g, ' + ')) : '—'}</td>
      <td class="n">${num(f.pm25_ini)}</td><td class="n">${num(f.pm25_fin)}</td><td class="n">${num(f.co2_ini, 0)}</td><td class="n">${num(f.co2_fin, 0)}</td><td class="n">${f.red_pm25 == null ? '—' : num(f.red_pm25) + ' %'}</td><td class="n">${f.eficiencia_global == null ? '—' : num(f.eficiencia_global) + ' %'}</td><td class="n">${f.duracion_real_min ?? '—'}</td><td>${badgeResultado(f.resultado)}</td></tr>`).join('')}</tbody>`;
}

// ---------- arranque ----------
(async function init() {
  cfg = await api('/api/config');
  tema();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { tema(); mostrar(); });
  initMonitoreo();
  const lotes = await cargarLotes();
  if (lotes.length) { loteActual = await api('/api/lotes/' + lotes[0].id); renderLote(loteActual); }
  mostrar();
})();
