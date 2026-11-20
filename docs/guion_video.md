# Guion del video demostrativo (máx. 6 minutos)

Preparación: ejecutar `npm start`, abrir http://localhost:3000 en pantalla completa y tener abierto el informe técnico. Grabar con la Barra de juegos de Windows (Win + Alt + R) o OBS. Subir a YouTube como **No listado** y pegar el enlace en el README y en el informe.

| Tiempo | Pantalla | Qué decir |
|---|---|---|
| 0:00 – 0:35 | Portada del informe / pestaña Monitoreo | Presentación: nombre, materia y el reto: identificar el aire contaminado, purificarlo y verificar el resultado con BI. |
| 0:35 – 1:05 | README (diagrama de arquitectura) | Cuatro componentes: entrada de aire con sensores, sistema de purificación, software BI y base de datos SQLite. Node.js sin dependencias, Chart.js, Python para análisis. |
| 1:05 – 2:05 | **Módulo 1** | Elegir “Zona industrial” → *Detectar ingreso de aire*. Explicar fecha/hora, las 5 mediciones, colores del ICA, índice ICA de PM2.5, alertas generadas y filtros recomendados por el motor de reglas con el tiempo estimado. Mostrar también el ingreso manual. |
| 2:05 – 3:20 | **Módulo 2** | Mostrar filtros recomendados y la nota técnica: HEPA = partículas, carbón = COV, catalizador = CO, depurador = CO₂. Quitar el depurador de CO₂ para ver la advertencia de la predicción; volver a marcarlo. Ajustar el tiempo, *Activar purificación*. Narrar la curva, el registro minuto a minuto y el tiempo restante estimado. |
| 3:20 – 4:05 | **Módulo 3** | Resultado del tratamiento, tabla antes/después, % de reducción, cambio de nivel y gráficos. Leer el análisis automático. |
| 4:05 – 5:15 | **Módulo 4 – Dashboard** | KPI: PM2.5 antes→después, CO₂ en ppm, % de reducción, tiempo de purificación, conformidad y alertas. Gráficos: serie diaria (episodio de incendio), reducción por contaminante (el CO₂ casi no baja sin depurador), distribución de niveles, modelo predictivo (ecuación y R²) y tiempo por escenario. Filtrar por “Humo de incendio forestal”. Reemplazar el prefiltro saturado y atender una alerta. |
| 5:15 – 5:45 | **Reportes** | Resumen ejecutivo y decisiones recomendadas; descargar CSV e imprimir PDF. |
| 5:45 – 6:00 | — | Conclusión: la combinación de tecnologías según el contaminante reduce más del 80 % del material particulado y el BI permite decidir mantenimiento, programación y tecnología. |
