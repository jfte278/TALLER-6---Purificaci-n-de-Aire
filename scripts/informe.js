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
const fechaLarga = s => new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
// Ajusta cada captura dentro de la página conservando su proporción (lee el tamaño del PNG)
const img = (n, maxW = 620, maxH = 820) => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'docs', 'capturas', n + '.png'));
  const w0 = buf.readUInt32BE(16), h0 = buf.readUInt32BE(20);
  const s = Math.min(maxW / w0, maxH / h0);
  return `<p class="fig"><img src="../capturas/${n}.png" width="${Math.round(w0 * s)}" height="${Math.round(h0 * s)}"></p>`;
};
const ejemplo = db.prepare(`SELECT * FROM v_comparacion WHERE escenario='industrial' AND resultado='Óptimo' ORDER BY lote_id DESC LIMIT 1`).get();
const soloHepa = d.combinaciones.find(c => c.filtros === 'HEPA');
const mejorComb = [...d.combinaciones].filter(c => c.n >= 5).sort((a, b) => b.eficiencia - a.eficiencia)[0];
const incendio = d.escenarios.find(e => e.escenario === 'incendio');
const urbano = d.escenarios.find(e => e.escenario === 'urbano');

const tablaCont = M.CLAVES.map(c => {
  const a = filas.reduce((s, r) => s + r[c + '_ini'], 0) / filas.length, b = filas.reduce((s, r) => s + r[c + '_fin'], 0) / filas.length;
  return `<tr><td>${M.CONTAMINANTES[c].nombre}</td><td>${M.CONTAMINANTES[c].unidad}</td><td class=n>${f(a, 2)}</td><td class=n>${f(b, 2)}</td><td class=n>${f(k['red_' + c])} %</td></tr>`;
}).join('');
const tablaEsc = d.escenarios.map(e => `<tr><td>${e.nombre}</td><td class=n>${e.n}</td><td class=n>${f(e.pm25_ini)}</td><td class=n>${f(e.tiempo)}</td><td class=n>${f(e.eficiencia)} %</td><td class=n>${e.insuficientes ?? 0}</td></tr>`).join('');
const tablaComb = d.combinaciones.map(c => `<tr><td>${c.filtros.replace(/,/g, ' + ')}</td><td class=n>${c.n}</td><td class=n>${f(c.eficiencia)} %</td><td class=n>${f(c.tiempo)}</td></tr>`).join('');
const niveles = M.NIVELES.slice(1).map(n => `<tr><td>${n.id}</td><td>${n.nombre}</td>${M.CLAVES.map(c => `<td class=n>${n.id === 1 ? '≤ ' + M.CORTES[c][0] : n.id === 6 ? '> ' + M.CORTES[c][4] : M.CORTES[c][n.id - 2] + ' – ' + M.CORTES[c][n.id - 1]}</td>`).join('')}</tr>`).join('');
const filtros = M.FILTROS.map(x => `<tr><td>${x.nombre}</td><td>${x.tecnologia}</td><td>${x.objetivo}</td><td class=n>${x.cadr_m3h}</td><td class=n>${x.vida_util_h}</td></tr>`).join('');
const nAlertas = d.alertasTipo.reduce((s, a) => s + a.n, 0);
const alertasDe = t => d.alertasTipo.filter(a => a.tipo === t).reduce((s, a) => s + a.n, 0);

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

<h2>1. Introducción</h2>
<p>Cuando se habla de contaminación del aire casi siempre se piensa en el humo de los carros, pero el problema va más allá. Las partículas finas (PM2.5 y PM10) entran a los pulmones, el monóxido de carbono (CO) es tóxico incluso en concentraciones bajas y el dióxido de carbono (CO₂) acumulado en un salón lleno de gente produce cansancio y dolor de cabeza. Es decir, el aire “malo” no es uno solo: depende de dónde venga.</p>
<p>La actividad planteaba una pregunta concreta: <i>¿cómo desarrollar una aplicación inteligente que permita identificar el ingreso de aire contaminado, analizar sus componentes, controlar el proceso de descontaminación y verificar la calidad del aire purificado mediante indicadores y herramientas de inteligencia de negocios?</i></p>
<p>Mi respuesta fue construir <b>Air Quality Intelligence</b>, una aplicación web que simula una cámara de purificación. El aire entra, los sensores lo miden, el sistema decide qué filtros usar, se purifica durante un tiempo controlado y al final se vuelve a medir para saber si de verdad quedó limpio. Todo lo que pasa queda guardado en una base de datos y se analiza en un dashboard.</p>
<p><b>Objetivo general.</b> Diseñar y desarrollar una aplicación de inteligencia de negocios que monitoree la calidad del aire, identifique los contaminantes, simule el proceso de purificación y muestre los resultados en indicadores que sirvan para tomar decisiones.</p>
<p><b>Objetivos específicos.</b></p>
<ul>
<li>Registrar cada ingreso de aire y clasificar qué tan contaminado llega.</li>
<li>Escoger la tecnología de filtrado según el contaminante y controlar el tiempo de funcionamiento.</li>
<li>Comprobar el resultado comparando los valores de entrada y de salida.</li>
<li>Construir un dashboard con indicadores de eficiencia, alertas y un modelo que prediga el tiempo de purificación.</li>
</ul>

<h2>2. Arquitectura de la solución</h2>
<p>Organicé el sistema en las cuatro partes que pedía la guía. Primero está la <b>entrada de aire</b>, donde los sensores miden PM2.5, PM10, CO₂, CO y, como extra, compuestos orgánicos volátiles (COV). Después viene el <b>sistema de purificación</b>, una cámara de ${M.VOLUMEN_CAMARA} m³ con cinco tecnologías distintas. El <b>software BI</b> recibe los datos, aplica las reglas y alimenta el dashboard. Por último, la <b>base de datos</b> guarda todas las mediciones: las de entrada, las que se toman cada minuto durante el proceso y las de salida.</p>
${img('arquitectura', 640)}<p class="cap">Figura 1. Arquitectura general del sistema.</p>
<p>En cuanto a tecnologías, tomé algunas decisiones que vale la pena explicar. La guía sugería React y MySQL o PostgreSQL. Preferí JavaScript sin frameworks y SQLite porque así la aplicación funciona en cualquier computador con solo tener Node.js instalado: no hay que montar un servidor de base de datos ni instalar paquetes. Para no cerrar la puerta a PostgreSQL dejé el script equivalente en <i>db/schema_postgresql.sql</i>.</p>
<table><tr><th>Capa</th><th>Tecnología</th><th>Para qué se usa</th></tr>
<tr><td>Interfaz</td><td>HTML, CSS, JavaScript y Chart.js</td><td>Las cinco pantallas de la aplicación y los gráficos</td></tr>
<tr><td>Servidor</td><td>Node.js</td><td>API REST, simulación de sensores y del proceso, reglas de alerta</td></tr>
<tr><td>Base de datos</td><td>SQLite (con script para PostgreSQL)</td><td>Guardar ingresos, mediciones, procesos, alertas y filtros</td></tr>
<tr><td>Análisis</td><td>Node.js y Python</td><td>Estadística antes/después, regresión y exportación a CSV para Power BI</td></tr></table>

<h3>2.1 Base de datos</h3>
<p>Cada vez que entra aire a la cámara se crea un registro al que llamé <i>lote</i>. A ese lote se le asocian todas sus mediciones y el proceso de purificación que se le aplicó. La tabla más importante para el análisis es en realidad una vista, <i>v_comparacion</i>, que pone en una misma fila los valores de antes y de después. De ahí sale casi todo el dashboard.</p>
<table><tr><th>Tabla</th><th>Qué guarda</th></tr>
<tr><td>lotes</td><td>Fecha y hora del ingreso, de dónde viene el aire, ubicación, si la medición fue automática o manual, y el nivel con el que llegó.</td></tr>
<tr><td>mediciones</td><td>Los valores de los cinco contaminantes en cada momento: entrada, cada minuto del proceso y salida.</td></tr>
<tr><td>procesos</td><td>Filtros usados, tiempo programado, tiempo real, tiempo que predijo el modelo, porcentaje de reducción y resultado final.</td></tr>
<tr><td>alertas</td><td>Tipo, gravedad, contaminante, valor medido, umbral y si ya fue atendida.</td></tr>
<tr><td>filtros</td><td>Las cinco tecnologías con su capacidad, su vida útil y cuántas horas llevan de uso.</td></tr></table>

<h3>2.2 ¿Cómo se decide qué tan malo está el aire?</h3>
<p>Para que la clasificación no fuera inventada, usé como base el Índice de Calidad del Aire de Colombia (Resolución 2254 de 2017) en el caso del material particulado. Para el CO tomé los cortes de la EPA, para el CO₂ las recomendaciones de ventilación de ASHRAE y para los COV las guías de la agencia ambiental alemana. El nivel global del aire lo define el contaminante que esté peor: si todo está bien menos el CO, el aire se clasifica según el CO.</p>
<table><tr><th>#</th><th>Nivel</th><th>PM2.5 µg/m³</th><th>PM10 µg/m³</th><th>CO₂ ppm</th><th>CO ppm</th><th>COV mg/m³</th></tr>${niveles}</table>

<h3>2.3 Tecnologías de purificación</h3>
<table><tr><th>Tecnología</th><th>Cómo funciona</th><th>Qué elimina</th><th>CADR m³/h</th><th>Vida útil (h)</th></tr>${filtros}</table>
<div class="caja">Uno de los puntos que más me interesó de la guía fue la nota técnica: ningún filtro sirve para todo. El HEPA atrapa partículas pero deja pasar los gases. El carbón activado retiene los COV pero casi no sirve para el CO ni para el CO₂. Para el CO hace falta un catalizador que lo convierta en CO₂, y para el CO₂ un adsorbente especial o renovar el aire. Por eso la aplicación no usa siempre el mismo filtro, sino que recomienda una combinación según lo que detecten los sensores.</div>

<h3>2.4 El modelo que hay detrás de la simulación</h3>
<p>Para que la simulación se pareciera a la realidad no quise usar números al azar. Modelé la cámara como un espacio donde el aire está bien mezclado: cada minuto los filtros limpian una parte del aire y la concentración baja de forma exponencial, primero rápido y luego cada vez más despacio. La ecuación es:</p>
<p class="formula">C(t) = C<sub>∞</sub> + (C<sub>0</sub> − C<sub>∞</sub>) · e<sup>−k·t</sup>,&nbsp;&nbsp;&nbsp; k = Σ (CADR<sub>i</sub> · η<sub>i</sub> · d<sub>i</sub>) / V</p>
<p>C<sub>0</sub> es la concentración con la que llega el aire y C<sub>∞</sub> la mínima a la que se puede llegar. La constante <i>k</i> depende de cuánto aire limpia cada filtro (CADR), de qué tan eficiente es con ese contaminante (η) y del volumen de la cámara (V). También agregué un factor de desgaste (d): un filtro viejo pierde hasta el 35 % de su eficiencia, igual que pasa en la vida real.</p>
<p>Lo útil de esta ecuación es que se puede despejar el tiempo. Así, apenas llega el aire, la aplicación ya sabe cuántos minutos necesitará para dejarlo en nivel “Buena”. Además, mientras el proceso avanza, vuelve a calcular <i>k</i> con las lecturas reales (por mínimos cuadrados) y corrige el tiempo restante.</p>

<h2>3. Cómo funciona la aplicación</h2>
<h3>Módulo 1. Monitoreo del aire contaminado</h3>
<p>Es la pantalla de entrada. Se escoge de dónde viene el aire (tráfico, zona industrial, humo de incendio, un salón con mucha gente o una obra) y al pulsar <i>Detectar ingreso de aire</i> los sensores toman la medición. También se pueden escribir los valores a mano, por ejemplo para probar un caso concreto. La aplicación guarda la fecha y la hora, calcula el índice de calidad del aire, pinta cada contaminante con el color de su nivel y, si algo supera los límites, genera alertas. Al lado aparece qué filtros recomienda y cuánto tiempo cree que va a tardar.</p>
${img('monitoreo')}<p class="cap">Figura 2. Pantalla de monitoreo con un ingreso de zona industrial.</p>
<h3>Módulo 2. Proceso de descontaminación</h3>
<p>Aquí se controla la purificación. Los filtros recomendados ya vienen marcados, pero se pueden cambiar. Si se quita uno necesario, por ejemplo el depurador de CO₂ cuando el CO₂ está alto, la aplicación avisa que ese contaminante no va a bajar. También se fija el tiempo de funcionamiento y se puede pedir que el proceso se detenga solo cuando el aire llegue a “Buena”. Durante la simulación se ve el ventilador girando, la curva de cada contaminante y una tabla que se va llenando minuto a minuto. Cada una de esas lecturas queda en la base de datos.</p>
${img('proceso')}<p class="cap">Figura 3. Proceso de descontaminación y registro de cada minuto.</p>
<h3>Módulo 3. Validación del aire purificado</h3>
<p>No basta con suponer que el aire quedó limpio: hay que medirlo otra vez. Al terminar el proceso se hace una nueva medición y se compara con la de entrada. Para cada contaminante se calcula cuánto se redujo y si cambió de nivel. Con eso el tratamiento se clasifica como <b>Óptimo</b> (todo quedó en “Buena” con al menos 50 % de reducción), <b>Aceptable</b> (quedó en “Aceptable” o mejor) o <b>Insuficiente</b> (el aire sigue siendo dañino y no debería liberarse).</p>
${img('validacion')}<p class="cap">Figura 4. Comparación antes y después de un tratamiento.</p>
<h3>Módulo 4. Inteligencia de negocios</h3>
<p>Esta es la parte pensada para quien toma decisiones, no para quien opera la máquina. Arriba están los seis indicadores: PM2.5 antes y después, CO₂ en ppm, porcentaje de reducción, tiempo promedio de purificación, porcentaje de aire que sale conforme y alertas abiertas. Debajo hay cinco gráficos, el estado de los filtros, una lista de recomendaciones que la aplicación genera sola y la tabla de alertas. Todo se puede filtrar por fechas y por tipo de escenario.</p>
${img('dashboard_1')}<p class="cap">Figura 5. Dashboard: filtros, indicadores y gráficos principales.</p>${img('dashboard_2')}<p class="cap">Figura 6. Dashboard: tiempos por escenario, filtros, recomendaciones y alertas.</p>
<h3>El componente de inteligencia</h3>
<p>La guía pedía una regla de alertas <i>o</i> un modelo predictivo. Implementé las dos cosas porque se complementan: las reglas avisan cuando algo va mal y el modelo ayuda a planear.</p>
<table><tr><th>Regla o modelo</th><th>Cuándo se activa</th><th>Qué hace</th></tr>
<tr><td>Contaminación en la entrada</td><td>Un contaminante llega en nivel 3 o más</td><td>Genera una alerta (media, alta o crítica según el nivel) y recomienda filtros</td></tr>
<tr><td>Eficiencia baja</td><td>A la mitad del tiempo programado un contaminante crítico no ha bajado ni el 40 %</td><td>Avisa que hay que revisar los filtros elegidos o su estado</td></tr>
<tr><td>Salida fuera de norma</td><td>El aire tratado sigue en nivel 3 o peor</td><td>Indica que no se debe liberar y que hay que repetir el tratamiento</td></tr>
<tr><td>Filtro desgastado</td><td>Un filtro pasa del 80 % de su vida útil</td><td>Pide programar el cambio</td></tr>
<tr><td>Modelo predictivo</td><td>Al iniciar y durante cada proceso</td><td>Estima el tiempo total y el tiempo que falta</td></tr></table>

<h2>4. Resultados</h2>
<p>Para tener suficientes datos que analizar generé dos meses de operación simulada, del ${fechaLarga(rango.a)} al ${fechaLarga(rango.b)}. En ese periodo entraron ${k.lotes} lotes de aire y ${k.procesos} pasaron por el proceso completo. Algunos se dejaron sin tratar y en otros se simularon errores del operador, como usar solo el filtro HEPA o programar muy poco tiempo, para ver si el sistema los detectaba.</p>
<table><tr><th>Contaminante</th><th>Unidad</th><th>Promedio antes</th><th>Promedio después</th><th>Reducción media</th></tr>${tablaCont}</table>
<p>El resultado más claro está en el material particulado: el PM2.5 bajó en promedio un ${f(k.red_pm25)} % y el PM10 un ${f(k.red_pm10)} %. Para confirmar que la diferencia no era casualidad apliqué una prueba t pareada, y en todos los contaminantes salió significativa (el detalle está en <i>docs/analisis_resultados.md</i>). El CO₂, en cambio, apenas bajó un ${f(k.red_co2)} %. Al principio pensé que era un error, pero tiene sentido: solo una parte de los tratamientos incluyó el depurador de CO₂, y el catalizador, al eliminar el CO, lo convierte justamente en CO₂.</p>
<p>En promedio cada purificación tardó ${f(k.tiempo_prom)} minutos y el ${f(k.pct_conforme)} % de los tratamientos dejó el aire en condiciones aceptables o mejores (${k.optimos} óptimos, ${k.aceptables} aceptables y ${k.insuficientes} insuficientes).</p>
${ejemplo ? `<p>Un caso concreto: el lote #${ejemplo.lote_id}, de zona industrial, llegó con ${f(ejemplo.pm25_ini)} µg/m³ de PM2.5 y ${f(ejemplo.co_ini, 2)} ppm de CO. Después de ${ejemplo.duracion_real_min} minutos con ${ejemplo.filtros.replace(/,/g, ' + ')} salió con ${f(ejemplo.pm25_fin)} µg/m³ y ${f(ejemplo.co_fin, 2)} ppm. El modelo había calculado ${f(ejemplo.tiempo_predicho_min)} minutos.</p>` : ''}
<h3>Según el origen del aire</h3>
<table><tr><th>Escenario</th><th>Ingresos</th><th>PM2.5 inicial</th><th>Tiempo medio (min)</th><th>Eficiencia</th><th>Insuficientes</th></tr>${tablaEsc}</table>
<p>${incendio ? `El humo de incendio es el caso más exigente: llega con mucho material particulado y necesita en promedio ${f(incendio.tiempo)} minutos.` : ''} ${urbano ? `El aire urbano, en cambio, se limpia en unos ${f(urbano.tiempo)} minutos.` : ''} Algo que no esperaba es que el aire de un salón con mucha gente tarde tanto, aunque casi no tenga partículas. La razón es el CO₂, que es el contaminante más lento de eliminar.</p>
<h3>Según la combinación de filtros</h3>
<table><tr><th>Tecnologías</th><th>Procesos</th><th>Eficiencia</th><th>Tiempo medio (min)</th></tr>${tablaComb}</table>
<p>Esta tabla resume bien la idea central del trabajo. ${soloHepa ? `Cuando se usó solo HEPA la eficiencia promedio fue de apenas ${f(soloHepa.eficiencia)} %,` : 'Usar solo HEPA dio la eficiencia más baja,'} ${mejorComb ? `mientras que la combinación ${mejorComb.filtros.replace(/,/g, ' + ')} llegó a ${f(mejorComb.eficiencia)} %.` : ''} El HEPA es muy bueno, pero solo para partículas. Si el aire trae gases, hay que acompañarlo con otras tecnologías.</p>
<h3>¿Qué tan bien predice el modelo?</h3>
<p>Primero probé algo sencillo: una regresión lineal entre el PM2.5 inicial y el tiempo de purificación. Dio <b>tiempo ≈ ${f(d.modelo.a, 2)} + ${f(d.modelo.b, 3)} × PM2.5 inicial</b>, con un R² de ${f(d.modelo.r2, 3)}. Es un ajuste moderado, y la explicación es que el tiempo no depende solo de las partículas: si hay mucho CO₂ o CO, el proceso se alarga aunque el PM2.5 sea bajo. Por eso la aplicación usa el modelo exponencial, que calcula el tiempo contaminante por contaminante. Ese modelo se equivocó en promedio <b>${f(d.modelo.mae_prediccion_min)} minuto</b> frente al tiempo real.</p>
<h3>Alertas generadas</h3>
<p>En total se generaron ${nAlertas} alertas. La mayoría (${alertasDe('CONTAMINACION_ENTRADA')}) fueron por aire que llegó muy contaminado, lo cual es normal en este tipo de planta. Las más útiles para la operación fueron las ${alertasDe('EFICIENCIA_BAJA')} de eficiencia baja y las ${alertasDe('SALIDA_FUERA_NORMA')} de salida fuera de norma, porque coinciden justamente con los casos en que se simuló un error del operador.</p>
<table><tr><th>Tipo</th><th>Gravedad</th><th>Cantidad</th></tr>${d.alertasTipo.map(a => `<tr><td>${a.tipo}</td><td>${a.severidad}</td><td class=n>${a.n}</td></tr>`).join('')}</table>
${img('reportes', 560)}<p class="cap">Figura 7. Reporte con el resumen ejecutivo.</p>

<h2>5. Decisiones que sugiere el sistema</h2>
<p>Con los datos de estos dos meses, la aplicación generó automáticamente estas recomendaciones:</p>
<ul>${d.recomendaciones.map(r => `<li>${r}</li>`).join('')}</ul>

<h2>6. Conclusiones</h2>
<p>La aplicación cumple el ciclo completo que pedía el reto: detecta el aire que entra, lo mide y lo clasifica, controla la purificación, verifica el resultado y convierte todo eso en indicadores. Cada medición queda guardada, así que cualquier número del dashboard se puede rastrear hasta el dato original.</p>
<p>La lección más importante fue que el filtro correcto depende del contaminante. El HEPA elimina casi todas las partículas, pero no hace nada contra el CO, los COV o el CO₂. Un sistema que use siempre el mismo filtro puede mostrar buenos resultados en PM2.5 y aun así liberar aire que no es seguro.</p>
<p>También me pareció valioso el enfoque de inteligencia de negocios. Más allá de mostrar gráficos bonitos, los indicadores sirven para tomar decisiones concretas: cuándo cambiar un filtro, qué tipo de aire conviene tratar en horas de menos demanda o si vale la pena invertir en un equipo con más capacidad.</p>
<p>La principal limitación es que los datos son simulados. Aunque el modelo se basa en ecuaciones reales, el siguiente paso sería conectar sensores de verdad. Por ejemplo, un PMS5003 para partículas, un SCD30 para CO₂ y un MQ-7 para CO, conectados a un ESP32 que envíe los datos a la misma API. La aplicación ya está preparada para eso, y la base de datos se puede migrar a PostgreSQL con el script incluido.</p>

<h2>Referencias</h2>
<ul>
<li>Ministerio de Ambiente y Desarrollo Sostenible. (2017). <i>Resolución 2254 de 2017: norma de calidad del aire ambiente</i>. Bogotá, Colombia.</li>
<li>U.S. Environmental Protection Agency. <i>Technical Assistance Document for the Reporting of Daily Air Quality – the Air Quality Index (AQI)</i>.</li>
<li>ASHRAE. <i>Standard 62.1: Ventilation and Acceptable Indoor Air Quality</i>.</li>
<li>Umweltbundesamt (UBA). <i>Guide values for indoor air: total volatile organic compounds (TVOC)</i>.</li>
<li>AHAM. <i>AC-1: Method for Measuring Performance of Portable Household Electric Room Air Cleaners</i>.</li>
</ul>
</body></html>`;

const out = path.join(__dirname, '..', 'docs', 'informe', 'informe.html');
fs.writeFileSync(out, html);
console.log('Informe HTML:', out);
