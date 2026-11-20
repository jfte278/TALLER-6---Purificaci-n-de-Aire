// Genera docs/informe/informe.html con los resultados reales de la base de datos.
// Luego scripts/informe.ps1 lo convierte a Word (.docx) y PDF con Microsoft Word.
const fs = require('node:fs');
const path = require('node:path');
const M = require('../src/modelo');
const { abrir } = require('../src/db');
const { crearAnalitica } = require('../src/analitica');

const db = abrir();
const d = crearAnalitica(db).dashboard();
const k = d.kpi;
const filas = db.prepare(`SELECT * FROM v_comparacion WHERE proceso_id IS NOT NULL`).all();
const rango = db.prepare(`SELECT MIN(dia) a, MAX(dia) b FROM v_comparacion`).get();
const f = (x, dec = 1) => (x == null ? '—' : Number(x).toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
// Ajusta cada captura dentro de la página conservando su proporción (lee el tamaño del PNG)
const img = (n, maxW = 620, maxH = 820) => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'docs', 'capturas', n + '.png'));
  const w0 = buf.readUInt32BE(16), h0 = buf.readUInt32BE(20);
  const s = Math.min(maxW / w0, maxH / h0);
  return `<p class="fig"><img src="../capturas/${n}.png" width="${Math.round(w0 * s)}" height="${Math.round(h0 * s)}"></p>`;
};
const ejemplo = db.prepare(`SELECT * FROM v_comparacion WHERE escenario='industrial' AND resultado='Óptimo' ORDER BY lote_id DESC LIMIT 1`).get();

const tablaCont = M.CLAVES.map(c => {
  const a = filas.reduce((s, r) => s + r[c + '_ini'], 0) / filas.length, b = filas.reduce((s, r) => s + r[c + '_fin'], 0) / filas.length;
  return `<tr><td>${M.CONTAMINANTES[c].nombre}</td><td>${M.CONTAMINANTES[c].unidad}</td><td class=n>${f(a, 2)}</td><td class=n>${f(b, 2)}</td><td class=n>${f(k['red_' + c])} %</td></tr>`;
}).join('');
const tablaEsc = d.escenarios.map(e => `<tr><td>${e.nombre}</td><td class=n>${e.n}</td><td class=n>${f(e.pm25_ini)}</td><td class=n>${f(e.tiempo)}</td><td class=n>${f(e.eficiencia)} %</td><td class=n>${e.insuficientes ?? 0}</td></tr>`).join('');
const tablaComb = d.combinaciones.map(c => `<tr><td>${c.filtros.replace(/,/g, ' + ')}</td><td class=n>${c.n}</td><td class=n>${f(c.eficiencia)} %</td><td class=n>${f(c.tiempo)}</td></tr>`).join('');
const niveles = M.NIVELES.slice(1).map(n => `<tr><td>${n.id}</td><td>${n.nombre}</td>${M.CLAVES.map(c => `<td class=n>${n.id === 1 ? '≤ ' + M.CORTES[c][0] : n.id === 6 ? '> ' + M.CORTES[c][4] : M.CORTES[c][n.id - 2] + ' – ' + M.CORTES[c][n.id - 1]}</td>`).join('')}</tr>`).join('');
const filtros = M.FILTROS.map(x => `<tr><td>${x.nombre}</td><td>${x.tecnologia}</td><td>${x.objetivo}</td><td class=n>${x.cadr_m3h}</td><td class=n>${x.vida_util_h}</td></tr>`).join('');

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe técnico - Air Quality Intelligence</title>
<style>
body{font-family:Calibri,"Segoe UI",sans-serif;font-size:11pt;line-height:1.4;color:#1b2522}
h1{font-size:22pt;color:#0f766e;margin:0 0 6pt}h2{font-size:15pt;color:#0f766e;border-bottom:1.5pt solid #0f766e;padding-bottom:2pt;margin-top:20pt}
h3{font-size:12pt;color:#24423d;margin-top:12pt}
table{border-collapse:collapse;width:100%;margin:6pt 0 10pt;font-size:9.5pt}
th{background:#0f766e;color:#fff;padding:4pt 6pt;text-align:left;border:1pt solid #0f766e}
td{padding:3pt 6pt;border:1pt solid #c9d3cf}td.n{text-align:right}
.portada{text-align:center;padding-top:120pt}.portada p{font-size:12pt;margin:4pt}
.fig{text-align:center;margin:6pt 0 2pt}.cap{text-align:center;font-size:9pt;color:#4d5a55;margin:0 0 12pt;font-style:italic}
.formula{font-family:Cambria Math,Cambria,serif;font-size:12pt;text-align:center;margin:8pt 0}
.caja{background:#e2f3f0;border-left:4pt solid #0f766e;padding:6pt 10pt;margin:8pt 0}
</style></head><body>
<div class="portada">
<h1>AIR QUALITY INTELLIGENCE</h1>
<p style="font-size:14pt">Sistema inteligente para el monitoreo, descontaminación y purificación del aire mediante tecnología y software</p>
<p>&nbsp;</p><p><b>Informe técnico</b></p><p>&nbsp;</p>
<p>José Fernando Téllez</p><p>Inteligencia de Negocios</p><p>&nbsp;</p>
<p>Repositorio: https://github.com/&lt;usuario&gt;/air-quality-intelligence</p>
<p>Video demostrativo: &lt;enlace de YouTube&gt;</p><p>&nbsp;</p>
<p>${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
</div>
<br style="page-break-before:always" clear="all">

<h2>1. Introducción y reto</h2>
<p>La contaminación del aire por material particulado (PM2.5 y PM10) y gases como el monóxido de carbono (CO) y el dióxido de carbono (CO₂) afecta la salud de las personas expuestas en ambientes exteriores, industriales e interiores. El reto planteado es: <i>¿cómo desarrollar una aplicación inteligente que permita identificar el ingreso de aire contaminado, analizar sus componentes, controlar el proceso de descontaminación y verificar la calidad del aire purificado mediante indicadores y herramientas de inteligencia de negocios?</i></p>
<p><b>Objetivo general:</b> diseñar y desarrollar una aplicación de inteligencia de negocios que monitoree la calidad del aire, identifique contaminantes, simule el proceso de purificación y presente los resultados en dashboards e indicadores para apoyar la toma de decisiones.</p>
<p><b>Objetivos específicos:</b> (1) registrar y clasificar el aire que ingresa; (2) seleccionar la tecnología de purificación según el contaminante y controlar su tiempo de funcionamiento; (3) validar el aire tratado comparando valores iniciales y finales; (4) construir un dashboard con indicadores de eficiencia, alertas y un modelo predictivo.</p>

<h2>2. Arquitectura tecnológica</h2>
<p>La solución se organiza en cuatro componentes: <b>entrada de aire</b> (sensores de PM2.5, PM10, CO₂, CO y COV), <b>sistema de purificación</b> (cámara de ${M.VOLUMEN_CAMARA} m³ con cinco tecnologías), <b>software BI</b> (API, motor de reglas, modelo predictivo y dashboard) y <b>base de datos</b> (mediciones de entrada, proceso y salida).</p>
${img('arquitectura', 640)}<p class="cap">Figura 1. Arquitectura de la solución.</p>
<table><tr><th>Capa</th><th>Tecnología</th><th>Uso</th></tr>
<tr><td>Interfaz</td><td>HTML5, CSS3, JavaScript, Chart.js 4.4</td><td>Módulos 1–4, dashboard y reportes (modo claro/oscuro, adaptable a móvil)</td></tr>
<tr><td>Backend</td><td>Node.js ≥ 22 (http nativo)</td><td>API REST, simulación de sensores y del proceso, reglas de alerta</td></tr>
<tr><td>Base de datos</td><td>SQLite (node:sqlite); script equivalente PostgreSQL</td><td>Almacenamiento de lotes, mediciones, procesos, alertas y filtros</td></tr>
<tr><td>Análisis</td><td>Node.js y Python (librería estándar)</td><td>Estadística antes/después, prueba t pareada, regresión, exportación CSV para Power BI</td></tr></table>

<h3>2.1 Modelo de datos</h3>
<table><tr><th>Tabla</th><th>Contenido</th></tr>
<tr><td>lotes</td><td>Cada ingreso de aire: fecha y hora, escenario de origen, ubicación, volumen, fuente (sensor/manual), nivel e ICA de entrada.</td></tr>
<tr><td>mediciones</td><td>Lecturas de PM2.5, PM10, CO₂, CO y COV con su etapa (entrada, proceso minuto a minuto, salida) y nivel.</td></tr>
<tr><td>procesos</td><td>Filtros usados, tiempo programado y real, tiempo predicho, % de reducción por contaminante, eficiencia global y resultado.</td></tr>
<tr><td>alertas</td><td>Tipo, severidad, contaminante, valor, umbral, mensaje y estado (atendida).</td></tr>
<tr><td>filtros</td><td>Catálogo de tecnologías con CADR, vida útil y horas de uso.</td></tr>
<tr><td>v_comparacion (vista)</td><td>Una fila por ingreso con valores antes y después: fuente del dashboard y de Power BI.</td></tr></table>

<h3>2.2 Clasificación de la calidad del aire</h3>
<p>Se usa una escala de seis niveles basada en el Índice de Calidad del Aire de Colombia (Resolución 2254 de 2017) para PM2.5 y PM10; los cortes de CO siguen la EPA, los de CO₂ las recomendaciones de ventilación (ASHRAE/REHVA) y los de COV las guías de la agencia ambiental alemana (UBA). El nivel global del aire es el del contaminante más crítico.</p>
<table><tr><th>#</th><th>Nivel</th><th>PM2.5 µg/m³</th><th>PM10 µg/m³</th><th>CO₂ ppm</th><th>CO ppm</th><th>COV mg/m³</th></tr>${niveles}</table>

<h3>2.3 Tecnologías de purificación</h3>
<table><tr><th>Tecnología</th><th>Principio</th><th>Contaminante objetivo</th><th>CADR m³/h</th><th>Vida útil h</th></tr>${filtros}</table>
<div class="caja">Ninguna tecnología elimina todos los contaminantes: el HEPA captura partículas pero no gases; el carbón activado adsorbe COV pero casi no retiene CO ni CO₂; el CO requiere oxidación catalítica y el CO₂ un adsorbente específico o renovación de aire. Por eso el sistema recomienda la combinación según los contaminantes detectados.</div>

<h3>2.4 Modelo físico y predictivo</h3>
<p>La cámara se modela como un reactor de mezcla completa. Para cada contaminante:</p>
<p class="formula">C(t) = C<sub>∞</sub> + (C<sub>0</sub> − C<sub>∞</sub>) · e<sup>−k·t</sup>,&nbsp;&nbsp;&nbsp; k = Σ (CADR<sub>i</sub> · η<sub>i</sub> · d<sub>i</sub>) / V</p>
<p>donde C<sub>∞</sub> es la concentración mínima alcanzable, η la eficiencia de captura de cada filtro, d un factor de desgaste (la eficiencia cae hasta 35 % al final de la vida útil) y V el volumen de la cámara. Despejando t se predice el tiempo necesario para alcanzar el nivel “Buena”. Durante el proceso, k se reestima por mínimos cuadrados sobre ln(C − C<sub>∞</sub>) con las lecturas reales para actualizar el tiempo restante.</p>

<h2>3. Desarrollo de la aplicación</h2>
<h3>Módulo 1. Monitoreo del aire contaminado</h3>
<p>Registra la fecha y hora del ingreso, mide los cinco contaminantes (sensores simulados por escenario o ingreso manual), calcula el ICA de PM2.5, clasifica el nivel, genera alertas y recomienda la tecnología de purificación con el tiempo estimado.</p>
${img('monitoreo')}<p class="cap">Figura 2. Módulo de monitoreo.</p>
<h3>Módulo 2. Proceso de descontaminación</h3>
<p>Permite seleccionar los filtros (con su vida útil), fijar el tiempo de funcionamiento (5–120 min), detener automáticamente al alcanzar calidad “Buena” y activar la filtración simulada. Cada minuto se registra una medición en la base de datos y se muestra la curva de concentración y el tiempo restante estimado.</p>
${img('proceso')}<p class="cap">Figura 3. Proceso de descontaminación con registro minuto a minuto.</p>
<h3>Módulo 3. Validación del aire purificado</h3>
<p>Al terminar se toma una nueva medición, se comparan los valores iniciales y finales, se calcula el porcentaje de reducción de cada contaminante y la eficiencia global (promedio de los contaminantes que estaban fuera de “Buena”), y se clasifica el resultado: <b>Óptimo</b> (aire en nivel Buena y eficiencia ≥ 50 %), <b>Aceptable</b> (nivel Aceptable o mejor) o <b>Insuficiente</b>.</p>
${img('validacion')}<p class="cap">Figura 4. Validación antes vs. después.</p>
<h3>Módulo 4. Inteligencia de negocios</h3>
<p>El dashboard incluye seis indicadores (PM2.5 antes→después, CO₂ en ppm, porcentaje de reducción, tiempo de purificación, porcentaje de aire conforme y alertas abiertas), cinco visualizaciones, el estado de los filtros, la tabla de alertas y recomendaciones automáticas. Se puede filtrar por rango de fechas y escenario; la pestaña de reportes genera el resumen ejecutivo, CSV y PDF.</p>
${img('dashboard_1')}<p class="cap">Figura 5. Dashboard: filtros, indicadores y gráficos principales.</p>${img('dashboard_2')}<p class="cap">Figura 6. Dashboard: tiempos por escenario, estado de filtros, recomendaciones y alertas.</p>
<h3>Componente de inteligencia</h3>
<table><tr><th>Regla / modelo</th><th>Condición</th><th>Acción</th></tr>
<tr><td>Contaminación en la entrada</td><td>Contaminante en nivel ≥ 3 (media), 4 (alta) o ≥ 5 (crítica)</td><td>Alerta y recomendación de filtros</td></tr>
<tr><td>Eficiencia baja</td><td>A mitad del tiempo programado, reducción &lt; 40 % de un contaminante crítico</td><td>Alerta: revisar selección o estado del filtro</td></tr>
<tr><td>Salida fuera de norma</td><td>Aire tratado con nivel ≥ 3</td><td>Alerta: no liberar, repetir tratamiento</td></tr>
<tr><td>Filtro saturado</td><td>Horas de uso ≥ 80 % de la vida útil</td><td>Alerta de mantenimiento preventivo</td></tr>
<tr><td>Modelo predictivo</td><td>Decaimiento exponencial + regresión histórica</td><td>Tiempo estimado al iniciar y tiempo restante en línea</td></tr></table>

<h2>4. Resultados</h2>
<p>Se analizaron ${k.lotes} ingresos de aire simulados entre ${rango.a} y ${rango.b}, de los cuales ${k.procesos} completaron el tratamiento.</p>
<table><tr><th>Contaminante</th><th>Unidad</th><th>Promedio antes</th><th>Promedio después</th><th>Reducción media</th></tr>${tablaCont}</table>
<p>El material particulado se redujo en promedio ${f(k.red_pm25)} % (PM2.5) y ${f(k.red_pm10)} % (PM10), con diferencias estadísticamente significativas (prueba t pareada, ver <i>docs/analisis_resultados.md</i>). El CO₂ apenas bajó ${f(k.red_co2)} % porque solo una parte de los tratamientos incluyó el depurador de CO₂. El tiempo medio de purificación fue ${f(k.tiempo_prom)} min y el ${f(k.pct_conforme)} % de los tratamientos entregó aire conforme (Óptimo ${k.optimos}, Aceptable ${k.aceptables}, Insuficiente ${k.insuficientes}).</p>
${ejemplo ? `<p><b>Ejemplo:</b> el ingreso #${ejemplo.lote_id} (zona industrial) llegó con PM2.5 = ${f(ejemplo.pm25_ini)} µg/m³ y CO = ${f(ejemplo.co_ini, 2)} ppm; tras ${ejemplo.duracion_real_min} min con ${ejemplo.filtros.replace(/,/g, ' + ')} salió con ${f(ejemplo.pm25_fin)} µg/m³ y ${f(ejemplo.co_fin, 2)} ppm (predicción: ${f(ejemplo.tiempo_predicho_min)} min).</p>` : ''}
<h3>Desempeño por escenario</h3>
<table><tr><th>Escenario</th><th>Ingresos</th><th>PM2.5 inicial</th><th>Tiempo medio (min)</th><th>Eficiencia</th><th>Insuficientes</th></tr>${tablaEsc}</table>
<h3>Desempeño por combinación de tecnologías</h3>
<table><tr><th>Tecnologías</th><th>Procesos</th><th>Eficiencia</th><th>Tiempo medio (min)</th></tr>${tablaComb}</table>
<p>Usar solo HEPA cuando hay gases presentes produce la menor eficiencia: confirma que la tecnología debe elegirse según el contaminante.</p>
<h3>Modelo predictivo</h3>
<p>Regresión lineal histórica: <b>tiempo ≈ ${f(d.modelo.a, 2)} + ${f(d.modelo.b, 3)} × PM2.5 inicial</b> (R² = ${f(d.modelo.r2, 3)}, n = ${d.modelo.n}). El R² moderado se explica porque el tiempo también depende de los gases presentes; por eso la aplicación usa el modelo exponencial por contaminante, cuyo error medio absoluto frente al tiempo real fue de <b>${f(d.modelo.mae_prediccion_min)} min</b>.</p>
<h3>Alertas</h3>
<table><tr><th>Tipo</th><th>Severidad</th><th>Cantidad</th></tr>${d.alertasTipo.map(a => `<tr><td>${a.tipo}</td><td>${a.severidad}</td><td class=n>${a.n}</td></tr>`).join('')}</table>
${img('reportes', 560)}<p class="cap">Figura 7. Reporte para la toma de decisiones.</p>

<h2>5. Decisiones recomendadas por el sistema</h2>
<ul>${d.recomendaciones.map(r => `<li>${r}</li>`).join('')}</ul>

<h2>6. Conclusiones</h2>
<ul>
<li>La aplicación cubre el ciclo completo: detección del ingreso, medición y clasificación, purificación controlada, validación y análisis BI, con todas las mediciones almacenadas en la base de datos.</li>
<li>La combinación de tecnologías según el contaminante es determinante: el HEPA reduce más del 98 % del material particulado, pero el CO, los COV y el CO₂ requieren catalizador, carbón activado y depurador respectivamente.</li>
<li>Los indicadores de reducción, tiempo y conformidad permiten comparar escenarios y combinaciones de filtros y decidir mantenimiento, programación y capacidad (CADR).</li>
<li>El componente de inteligencia (reglas de alerta y modelo predictivo) anticipa el tiempo de tratamiento con un error cercano a un minuto y detecta filtros degradados y tratamientos insuficientes.</li>
<li>Limitaciones y trabajo futuro: los datos son simulados; el siguiente paso es conectar sensores reales (p. ej. PMS5003 para partículas, SCD30 para CO₂ y MQ-7 para CO con un ESP32) a la misma API y migrar a PostgreSQL con el script incluido.</li>
</ul>
<h2>Referencias</h2>
<ul>
<li>Ministerio de Ambiente y Desarrollo Sostenible. Resolución 2254 de 2017 (norma de calidad del aire ambiente, Colombia).</li>
<li>U.S. EPA. Technical Assistance Document for the Reporting of Daily Air Quality – the Air Quality Index (AQI).</li>
<li>ASHRAE Standard 62.1 – Ventilation and Acceptable Indoor Air Quality.</li>
<li>Umweltbundesamt (UBA). Guide values for indoor air: total volatile organic compounds (TVOC).</li>
<li>AHAM AC-1. Method for Measuring Performance of Portable Household Electric Room Air Cleaners (CADR).</li>
</ul>
</body></html>`;

const out = path.join(__dirname, '..', 'docs', 'informe', 'informe.html');
fs.writeFileSync(out, html);
console.log('Informe HTML:', out);
