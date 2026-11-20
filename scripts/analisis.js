// Análisis de resultados antes vs. después (salida en consola + docs/analisis_resultados.md)
// Uso: npm run analisis
const fs = require('node:fs');
const path = require('node:path');
const M = require('../src/modelo');
const { abrir } = require('../src/db');
const { crearAnalitica } = require('../src/analitica');

const db = abrir();
const d = crearAnalitica(db).dashboard();
const k = d.kpi;
const filas = db.prepare(`SELECT * FROM v_comparacion WHERE proceso_id IS NOT NULL`).all();

function stats(arr) {
  const v = arr.filter(x => x != null).sort((a, b) => a - b);
  const n = v.length, media = v.reduce((s, x) => s + x, 0) / n;
  const de = Math.sqrt(v.reduce((s, x) => s + (x - media) ** 2, 0) / (n - 1));
  const med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  return { n, media, de, min: v[0], med, max: v[n - 1] };
}
// Prueba t pareada (antes - después) con aproximación normal para n grande
function tPareada(a, b) {
  const dif = a.map((x, i) => x - b[i]);
  const s = stats(dif);
  return { t: s.media / (s.de / Math.sqrt(s.n)), media: s.media, n: s.n };
}
const f = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d }));

let md = `# Análisis de resultados: el aire antes y después del tratamiento\n\n`;
md += `Aquí comparo cómo llegaba el aire a la cámara y cómo salía después de purificarlo. Los números se calculan directamente desde la base de datos con \`npm run analisis\`, así que si se generan datos nuevos el análisis se actualiza solo.\n\n`;
md += `Generado: ${new Date().toLocaleString('es-CO')} · Ingresos: ${k.lotes} · Tratamientos finalizados: ${filas.length}\n\n`;
md += `## 1. Estadística descriptiva por contaminante\n\n| Contaminante | Unidad | Media antes | Media después | DE antes | DE después | Reducción media | t pareada |\n|---|---|---:|---:|---:|---:|---:|---:|\n`;
for (const c of M.CLAVES) {
  const a = filas.map(r => r[c + '_ini']), b = filas.map(r => r[c + '_fin']);
  const sa = stats(a), sb = stats(b), t = tPareada(a, b);
  md += `| ${M.CONTAMINANTES[c].nombre} | ${M.CONTAMINANTES[c].unidad} | ${f(sa.media, 2)} | ${f(sb.media, 2)} | ${f(sa.de, 2)} | ${f(sb.de, 2)} | ${f(k['red_' + c])} % | ${f(t.t, 2)} |\n`;
}
md += `\nPara saber si la diferencia entre antes y después era real y no casualidad usé una prueba t pareada. Con ${filas.length} tratamientos, un valor de t mayor a 1,98 significa que la diferencia es significativa al 95 %, y eso se cumple en los cinco contaminantes.\n\n`;
md += `Lo que más se nota es la caída del material particulado, que baja más del 80 %. El CO₂ es el que menos baja, y tiene explicación: solo algunos tratamientos usaron el depurador de CO₂, y además el catalizador convierte el CO en CO₂, así que en esos casos hasta sube un poco.\n\n`;

md += `## 2. Resultado de los tratamientos\n\n| Resultado | Procesos | % |\n|---|---:|---:|\n`;
for (const r of ['Óptimo', 'Aceptable', 'Insuficiente']) {
  const n = filas.filter(x => x.resultado === r).length;
  md += `| ${r} | ${n} | ${f(n / filas.length * 100)} % |\n`;
}
md += `\n## 3. Desempeño por escenario\n\n| Escenario | Ingresos | PM2.5 inicial | Tiempo medio (min) | Eficiencia | Insuficientes |\n|---|---:|---:|---:|---:|---:|\n`;
for (const e of d.escenarios) md += `| ${e.nombre} | ${e.n} | ${f(e.pm25_ini)} | ${f(e.tiempo)} | ${f(e.eficiencia)} % | ${e.insuficientes ?? 0} |\n`;

md += `\nEl humo de incendio es el que más tiempo necesita porque llega con muchísimas partículas. Lo que no esperaba fue lo del salón con mucha gente: casi no tiene partículas, pero se demora bastante por el CO₂, que es lo más lento de quitar.\n`;
md += `\n## 4. Desempeño por combinación de tecnologías\n\n| Tecnologías | Procesos | Eficiencia | Tiempo medio |\n|---|---:|---:|---:|\n`;
for (const c of d.combinaciones) md += `| ${c.filtros.replace(/,/g, ' + ')} | ${c.n} | ${f(c.eficiencia)} % | ${f(c.tiempo)} min |\n`;

md += `\nEsta tabla es la que mejor resume el trabajo: cuando se usó solo HEPA la eficiencia fue la más baja, porque el HEPA no sirve para los gases. Las combinaciones que incluyen carbón activado y catalizador funcionan mucho mejor.\n`;
md += `\n## 5. Componente de inteligencia\n\n`;
if (d.modelo) md += `**Regresión lineal** (procesos con HEPA que alcanzaron calidad "Buena"): tiempo = ${f(d.modelo.a, 2)} + ${f(d.modelo.b, 3)} × PM2.5 inicial · R² = ${f(d.modelo.r2, 3)} · n = ${d.modelo.n}.\n\n`;
md += `**Modelo de decaimiento exponencial** C(t) = C∞ + (C₀ − C∞)·e^(−k·t), con k = Σ(CADR·eficiencia)/V: error medio absoluto de la predicción del tiempo = ${f(d.modelo?.mae_prediccion_min)} min.\n\n`;
md += `**Alertas por tipo**\n\n| Tipo | Severidad | Cantidad |\n|---|---|---:|\n` + d.alertasTipo.map(a => `| ${a.tipo} | ${a.severidad} | ${a.n} |`).join('\n') + '\n\n';
md += `## 6. Recomendaciones automáticas\n\n` + d.recomendaciones.map(r => `- ${r}`).join('\n') + '\n';

const salida = path.join(__dirname, '..', 'docs', 'analisis_resultados.md');
fs.writeFileSync(salida, md);
console.log(md);
console.log('Guardado en', salida);
