# Guion del video (unos 5 minutos)

Antes de grabar: abrir http://localhost:3000, poner el navegador en pantalla completa (F11) y grabar con Win + Alt + R. En la pestaña Descontaminación dejar la velocidad en "1 min = 0,4 s".

Lo que está entre corchetes es lo que se hace en pantalla; el resto se lee.

---

### 1. Presentación (≈ 30 s) — pestaña Monitoreo

Hola, mi nombre es José Fernando Téllez y les voy a mostrar Air Quality Intelligence, la aplicación que desarrollé para la actividad de inteligencia de negocios.

La idea es simular una cámara a la que entra aire contaminado. El sistema lo mide, decide qué filtros usar, lo purifica y después comprueba si de verdad quedó limpio. Todo queda guardado en una base de datos y al final se analiza en un dashboard.

La hice con Node.js, una base de datos SQLite y JavaScript con Chart.js para los gráficos.

### 2. Monitoreo (≈ 1 min)

[Escoger "Zona industrial" y pulsar *Detectar ingreso de aire*]

Voy a simular que entra aire de una zona industrial. Los sensores miden cinco cosas: PM2.5 y PM10, que son partículas, y tres gases: CO₂, monóxido de carbono y compuestos orgánicos volátiles.

[Señalar las tarjetas de colores]

Cada valor sale con el color de su nivel. Usé como referencia el índice de calidad del aire de Colombia, la Resolución 2254. El nivel general del aire lo define el contaminante que esté peor.

[Señalar las alertas]

Como varios valores superan los límites, el sistema generó estas alertas automáticamente.

[Señalar los filtros recomendados]

Y aquí está lo interesante: según lo que detectó, el sistema recomienda qué filtros usar y calcula cuántos minutos va a tardar en limpiar el aire.

### 3. Descontaminación (≈ 1 min 15 s)

[Ir a la pestaña Descontaminación]

En esta parte se controla la purificación. Hay cinco tecnologías, y es importante entender que ninguna sirve para todo. El HEPA atrapa partículas pero no gases. El carbón activado sirve para los compuestos orgánicos, el catalizador para el monóxido y el depurador para el CO₂.

[Desmarcar "Depurador de CO₂"]

Miren lo que pasa si quito el depurador de CO₂: el sistema avisa que ese gas no se va a reducir.

[Volver a marcarlo]

Lo vuelvo a poner. Aquí se fija el tiempo de funcionamiento y se puede pedir que se detenga solo cuando el aire esté limpio.

[Pulsar *Activar purificación*]

Ahora se ve cómo baja cada contaminante. Las partículas bajan rápido y los gases más despacio. Cada minuto queda registrado en esta tabla y en la base de datos. Y arriba el sistema va recalculando cuánto tiempo falta.

### 4. Validación (≈ 45 s)

[Se abre sola al terminar]

Cuando termina, se vuelve a medir el aire. Aquí está la comparación: cuánto había antes, cuánto quedó y el porcentaje de reducción de cada contaminante. El tratamiento se clasifica como óptimo, aceptable o insuficiente, y abajo hay un pequeño análisis automático del resultado.

### 5. Dashboard (≈ 1 min 15 s)

[Ir a Dashboard BI]

Esta es la parte de inteligencia de negocios. Tiene datos de dos meses de operación simulada.

[Señalar los indicadores de arriba]

Arriba están los indicadores principales: el PM2.5 bajó de unos 77 a menos de 10 microgramos, la reducción promedio es de más del 80 % y cada tratamiento tarda en promedio unos 27 minutos.

[Señalar los gráficos]

En este gráfico se ve la entrada contra la salida día a día. En este otro se ve que el CO₂ casi no baja, porque no todos los tratamientos usaron el filtro adecuado. Este de aquí es el modelo predictivo, que relaciona la contaminación inicial con el tiempo de purificación.

[Escoger "Humo de incendio forestal" y pulsar *Aplicar*]

Se puede filtrar por tipo de aire. Por ejemplo, el humo de incendio es el que más tiempo necesita.

[Bajar hasta los filtros y las alertas]

El sistema también controla el desgaste de los filtros. Este prefiltro ya pasó del 80 % de su vida útil y lo puedo reemplazar desde aquí. Y abajo están las alertas, que se pueden marcar como atendidas.

### 6. Reportes y cierre (≈ 30 s)

[Ir a Reportes]

Por último, en reportes hay un resumen ejecutivo con las decisiones recomendadas, y se puede descargar en CSV para Excel o Power BI, o imprimir en PDF.

En conclusión, la aplicación cubre todo el ciclo: detectar, medir, purificar, verificar y analizar. Y la lección principal es que el filtro correcto depende del contaminante: usar solo HEPA no basta cuando el aire trae gases.

Muchas gracias.
