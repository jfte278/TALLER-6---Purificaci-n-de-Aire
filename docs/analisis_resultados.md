# Análisis de resultados: el aire antes y después del tratamiento

Aquí comparo cómo llegaba el aire a la cámara y cómo salía después de purificarlo. Los números se calculan directamente desde la base de datos con `npm run analisis`, así que si se generan datos nuevos el análisis se actualiza solo.

Generado: 20/11/2026, 1:25:22 p. m. · Ingresos: 123 · Tratamientos finalizados: 112

## 1. Estadística descriptiva por contaminante

| Contaminante | Unidad | Media antes | Media después | DE antes | DE después | Reducción media | t pareada |
|---|---|---:|---:|---:|---:|---:|---:|
| PM2.5 | µg/m³ | 76,97 | 9,58 | 68,68 | 8,00 | 81,4 % | 10,71 |
| PM10 | µg/m³ | 165,50 | 16,19 | 133,30 | 12,77 | 83,9 % | 11,84 |
| CO₂ | ppm | 848,25 | 671,55 | 502,52 | 271,98 | 10,8 % | 5,19 |
| CO | ppm | 8,51 | 3,67 | 7,69 | 3,90 | 36,8 % | 7,40 |
| COV totales | mg/m³ | 0,95 | 0,37 | 0,77 | 0,46 | 50,6 % | 9,11 |

Para saber si la diferencia entre antes y después era real y no casualidad usé una prueba t pareada. Con 112 tratamientos, un valor de t mayor a 1,98 significa que la diferencia es significativa al 95 %, y eso se cumple en los cinco contaminantes.

Lo que más se nota es la caída del material particulado, que baja más del 80 %. El CO₂ es el que menos baja, y tiene explicación: solo algunos tratamientos usaron el depurador de CO₂, y además el catalizador convierte el CO en CO₂, así que en esos casos hasta sube un poco.

## 2. Resultado de los tratamientos

| Resultado | Procesos | % |
|---|---:|---:|
| Óptimo | 57 | 50,9 % |
| Aceptable | 36 | 32,1 % |
| Insuficiente | 19 | 17,0 % |

## 3. Desempeño por escenario

| Escenario | Ingresos | PM2.5 inicial | Tiempo medio (min) | Eficiencia | Insuficientes |
|---|---:|---:|---:|---:|---:|
| Urbano - tráfico vehicular | 47 | 45,5 | 18,0 | 60,2 % | 4 |
| Interior con alta ocupación | 24 | 22,8 | 37,8 | 64,5 % | 6 |
| Zona industrial | 19 | 118,6 | 30,1 | 76,3 % | 4 |
| Humo de incendio forestal | 19 | 224,4 | 43,2 | 84,8 % | 4 |
| Obra en construcción | 14 | 60,4 | 18,2 | 73,5 % | 1 |

El humo de incendio es el que más tiempo necesita porque llega con muchísimas partículas. Lo que no esperaba fue lo del salón con mucha gente: casi no tiene partículas, pero se demora bastante por el CO₂, que es lo más lento de quitar.

## 4. Desempeño por combinación de tecnologías

| Tecnologías | Procesos | Eficiencia | Tiempo medio |
|---|---:|---:|---:|
| PRE + HEPA + CARBON + CATAL | 31 | 79,5 % | 28,9 min |
| HEPA + CARBON + CO2 | 18 | 69,4 % | 33,9 min |
| HEPA | 15 | 43,6 % | 34,9 min |
| HEPA + CARBON + CATAL | 14 | 57,7 % | 16,0 min |
| PRE + HEPA + CARBON | 10 | 75,8 % | 18,7 min |
| PRE + HEPA + CARBON + CATAL + CO2 | 8 | 76,9 % | 36,1 min |
| HEPA + CARBON | 6 | 68,9 % | 20,0 min |
| HEPA + CATAL | 4 | 67,0 % | 18,3 min |

Esta tabla es la que mejor resume el trabajo: cuando se usó solo HEPA la eficiencia fue la más baja, porque el HEPA no sirve para los gases. Las combinaciones que incluyen carbón activado y catalizador funcionan mucho mejor.

## 5. Componente de inteligencia

**Regresión lineal** (procesos con HEPA que alcanzaron calidad "Buena"): tiempo = 17,50 + 0,122 × PM2.5 inicial · R² = 0,415 · n = 59.

**Modelo de decaimiento exponencial** C(t) = C∞ + (C₀ − C∞)·e^(−k·t), con k = Σ(CADR·eficiencia)/V: error medio absoluto de la predicción del tiempo = 0,9 min.

**Alertas por tipo**

| Tipo | Severidad | Cantidad |
|---|---|---:|
| CONTAMINACION_ENTRADA | alta | 115 |
| CONTAMINACION_ENTRADA | critica | 63 |
| CONTAMINACION_ENTRADA | media | 107 |
| EFICIENCIA_BAJA | alta | 45 |
| FILTRO_SATURADO | media | 1 |
| SALIDA_FUERA_NORMA | alta | 12 |
| SALIDA_FUERA_NORMA | critica | 7 |

## 6. Recomendaciones automáticas

- Solo el 83 % de los tratamientos entrega aire conforme (Buena/Aceptable). Meta: ≥ 90 %.
- El escenario "Humo de incendio forestal" exige el mayor tiempo de purificación (43.2 min en promedio): conviene programarlo en horas de baja demanda o ampliar el CADR.
- Reemplazar Prefiltro G4 (83.8 % de vida útil); la eficiencia de captura ya se está degradando.
- La combinación HEPA tiene eficiencia media de 43.6 %: no cubre todos los contaminantes. Usar la recomendación automática.
- El CO₂ apenas se reduce (10.8 %): HEPA y carbón activado no lo retienen; se requiere depurador de CO₂ o renovación de aire.
- 78 ingresos llegaron con nivel dañino o peor: activar protocolo de prefiltrado y aviso al personal expuesto.
