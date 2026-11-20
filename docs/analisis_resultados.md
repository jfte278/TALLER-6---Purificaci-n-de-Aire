# Análisis de resultados — calidad del aire antes y después del tratamiento

Generado: 20/11/2026, 12:33:43 p. m. · Ingresos: 115 · Tratamientos finalizados: 111

## 1. Estadística descriptiva por contaminante

| Contaminante | Unidad | Media antes | Media después | DE antes | DE después | Reducción media | t pareada |
|---|---|---:|---:|---:|---:|---:|---:|
| PM2.5 | µg/m³ | 77,08 | 9,56 | 68,98 | 8,03 | 81,4 % | 10,63 |
| PM10 | µg/m³ | 164,47 | 16,13 | 133,46 | 12,81 | 83,8 % | 11,70 |
| CO₂ | ppm | 851,35 | 673,02 | 503,72 | 272,77 | 10,9 % | 5,20 |
| CO | ppm | 8,57 | 3,69 | 7,69 | 3,92 | 37,1 % | 7,42 |
| COV totales | mg/m³ | 0,96 | 0,37 | 0,77 | 0,47 | 50,5 % | 9,07 |

Con n = 111, |t| > 1,98 indica diferencia significativa al 95 % entre antes y después.

## 2. Resultado de los tratamientos

| Resultado | Procesos | % |
|---|---:|---:|
| Óptimo | 56 | 50,5 % |
| Aceptable | 36 | 32,4 % |
| Insuficiente | 19 | 17,1 % |

## 3. Desempeño por escenario

| Escenario | Ingresos | PM2.5 inicial | Tiempo medio (min) | Eficiencia | Insuficientes |
|---|---:|---:|---:|---:|---:|
| Urbano - tráfico vehicular | 44 | 45,9 | 18,0 | 60,2 % | 4 |
| Interior con alta ocupación | 23 | 22,9 | 37,8 | 64,5 % | 6 |
| Zona industrial | 18 | 117,9 | 30,1 | 76,3 % | 4 |
| Humo de incendio forestal | 17 | 212,2 | 43,2 | 84,8 % | 4 |
| Obra en construcción | 13 | 60,0 | 18,2 | 73,3 % | 1 |

## 4. Desempeño por combinación de tecnologías

| Tecnologías | Procesos | Eficiencia | Tiempo medio |
|---|---:|---:|---:|
| PRE + HEPA + CARBON + CATAL | 31 | 79,5 % | 28,9 min |
| HEPA + CARBON + CO2 | 18 | 69,4 % | 33,9 min |
| HEPA | 15 | 43,6 % | 34,9 min |
| HEPA + CARBON + CATAL | 14 | 57,7 % | 16,0 min |
| PRE + HEPA + CARBON | 9 | 75,7 % | 18,7 min |
| PRE + HEPA + CARBON + CATAL + CO2 | 8 | 76,9 % | 36,1 min |
| HEPA + CARBON | 6 | 68,9 % | 20,0 min |
| HEPA + CATAL | 4 | 67,0 % | 18,3 min |

## 5. Componente de inteligencia

**Regresión lineal** (procesos con HEPA que alcanzaron calidad "Buena"): tiempo = 17,70 + 0,122 × PM2.5 inicial · R² = 0,416 · n = 58.

**Modelo de decaimiento exponencial** C(t) = C∞ + (C₀ − C∞)·e^(−k·t), con k = Σ(CADR·eficiencia)/V: error medio absoluto de la predicción del tiempo = 1,0 min.

**Alertas por tipo**

| Tipo | Severidad | Cantidad |
|---|---|---:|
| CONTAMINACION_ENTRADA | alta | 108 |
| CONTAMINACION_ENTRADA | critica | 56 |
| CONTAMINACION_ENTRADA | media | 101 |
| EFICIENCIA_BAJA | alta | 44 |
| FILTRO_SATURADO | media | 1 |
| SALIDA_FUERA_NORMA | alta | 12 |
| SALIDA_FUERA_NORMA | critica | 7 |

## 6. Recomendaciones automáticas

- Solo el 82.9 % de los tratamientos entrega aire conforme (Buena/Aceptable). Meta: ≥ 90 %.
- El escenario "Humo de incendio forestal" exige el mayor tiempo de purificación (43.2 min en promedio): conviene programarlo en horas de baja demanda o ampliar el CADR.
- Reemplazar Prefiltro G4 (83.7 % de vida útil); la eficiencia de captura ya se está degradando.
- La combinación HEPA tiene eficiencia media de 43.6 %: no cubre todos los contaminantes. Usar la recomendación automática.
- El CO₂ apenas se reduce (10.9 %): HEPA y carbón activado no lo retienen; se requiere depurador de CO₂ o renovación de aire.
- 72 ingresos llegaron con nivel dañino o peor: activar protocolo de prefiltrado y aviso al personal expuesto.
