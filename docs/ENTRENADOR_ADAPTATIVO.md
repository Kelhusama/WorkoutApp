# Entrenador adaptativo: investigación y propuesta (20/11/2026)

Pregunta de partida: ¿puede Forja tener un «entrenamiento evolutivo algorítmico», una red neuronal que aconseje y vaya viendo la progresión según los avances?

**Respuesta corta**: sí a un entrenador que aprende de ti y ajusta lo que te pide; no a que su núcleo sea una red neuronal. Con los datos de una sola persona una red sobreajusta, y nadie ha demostrado que supere a reglas bien hechas. Lo que sí funciona con pocos datos es un estimador de tu fuerza real (filtro de Kalman), reglas de autorregulación con parámetros que se ajustan a ti y un «bandido» que prueba variantes y se queda con la que mejor te va. Todo cabe en TypeScript puro, gratis, sin conexión y funcionando ya en Expo Go.

> **Fiabilidad de las fuentes.** La búsqueda se hizo sobre resúmenes y abstracts, no sobre textos completos. Lo comercial sale casi todo de material de cada empresa (ninguna publica su algoritmo). Lo que no se pudo confirmar va marcado como «sin verificar».

## 1. Qué hacen de verdad las apps «con IA»

| App | Lo que está documentado | Qué ajusta |
|---|---|---|
| Fitbod | Recuperación por grupo muscular (0–100 %) + 1RM estimado tras cada sesión + «ML» sin especificar | Ejercicios, carga, volumen |
| JuggernautAI | Reglas de autorregulación; su «readiness» es una media ponderada | Carga y volumen del día y del bloque |
| RP Hypertrophy | Reglas sobre sensación: poco bombeo + pocas agujetas + carga fácil → más series | Series, peso y repeticiones |
| Alpha Progression | Progresión por historial; si el salto de peso es grande, pide más repeticiones | Peso y repeticiones |
| MacroFactor | Lo dicen ellos: algoritmos «puramente deterministas» (media ponderada + balance energético) | Gasto estimado y calorías |
| Freeletics, SensAI | Capa de modelo de lenguaje sobre datos de pulsera; de pago y con conexión | Plan semanal |

Fuentes: [Fitbod](https://fitbod.me/blog/fitbod-algorithm), [JuggernautAI](https://help.jtsstrength.com/en/articles/3-how-juggernautai-is-individualized-to-you), [RP](https://help.rpstrength.com/hc/en-us/articles/32600173777815-How-does-the-app-determine-when-to-add-weight-reps-and-sets), [Alpha Progression](https://alphaprogression.com/en), [MacroFactor](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/), [Freeletics](https://www.freeletics.com/en/blog/posts/AI-and-your-Coach/).

**Conclusión**: ninguna documenta una red neuronal que prescriba el entrenamiento. Lo que hay son reglas, medias móviles y estimadores de 1RM.

En código abierto, [Liftosaur](https://github.com/astashov/liftosaur) y [wger](https://github.com/wger-project/wger) hacen progresión por reglas con estado por ejercicio. Son AGPL: se pueden tomar las ideas, no el código. No se encontró ningún repositorio con aprendizaje por refuerzo o bandidos para sobrecarga progresiva.

## 2. Qué dice la ciencia

### Redes neuronales y aprendizaje automático
- **Predicción de 1RM**: comparando redes con regresiones, ganó la regresión lineal regularizada; todos los métodos fallaban entre 2,7 y 3,3 kg, y además necesitaban medir la velocidad de la barra ([Balsalobre-Fernández y Kipp, 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8002214/)).
- **Aprendizaje por refuerzo**: hay un trabajo de 2026 que prescribe la sesión entera, pero solo con usuarios simulados ([preprint](https://arxiv.org/abs/2608.29409)).
- **Bandidos con una sola persona**: probados en ejercicio para dolor crónico; el resultado es que son viables, no que sean mejores ([Meier, 2023](https://proceedings.mlr.press/v225/meier23a/meier23a.pdf)).
- **Algoritmos evolutivos**: se usan para optimizar planes sobre un modelo simulado, en resistencia y deportes de equipo ([2017](https://reference-global.com/download/article/10.1515/bhk-2017-0013.pdf)). Nada equivalente en hipertrofia.
- **No se encontró ningún ensayo** en el que un sistema de aprendizaje automático supere a la autorregulación simple en fuerza o hipertrofia.
- **Dónde sí ayuda una red**: sensores (velocidad de barra, contar repeticiones, reconocer ejercicios) y modelos con millones de usuarios. Ninguno es nuestro caso.

### Lo que sí funciona
- **Autorregulación** (ajustar según cómo va el día): al menos igual de buena que la progresión fija, quizá algo mejor a corto plazo ([Zhang, 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7994759); [Hickmott, 2022](https://pubmed.ncbi.nlm.nih.gov/35038063/); [Helms, 2018](https://pubmed.ncbi.nlm.nih.gov/29628895/)).
- **Subir repeticiones con el peso fijo vale tanto como subir peso** ([Plotkin, 2022](https://peerj.com/articles/14142)). Es el respaldo de las sesiones de casa con la mancuerna de 10 kg.
- **Cercanía al fallo**: para fuerza da igual en un rango amplio; para hipertrofia conviene acercarse ([Robinson, 2024](https://rke.abertay.ac.uk/en/publications/exploring-the-dose-response-relationship-between-estimated-resist/)). Banca a 2–4 repeticiones del fallo; bíceps y pecho accesorio a 0–2.
- **Serie final al máximo (APRE)**: superó a la periodización lineal en banca en un estudio pequeño ([Mann, 2010](https://read.qxmd.com/read/20543732/the-effect-of-autoregulatory-progressive-resistance-exercise-vs-linear-periodization-on-strength-improvement-in-college-athletes)).
- **1RM estimado**: fiable como tendencia y con series de menos de 10 repeticiones; no como valor absoluto ([revisión](https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf)).
- **El dato que más aporta**: cuántas repeticiones te quedaban en la última serie (RIR). El error típico es de una repetición, y mejora cerca del fallo ([Halperin](https://sportrxiv.org/index.php/server/preprint/view/67)). La sensación de la sesión también es válida ([Lea, 2022](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8742800/)).
- **Volumen**: más series dan más resultado con rendimientos decrecientes; las series indirectas cuentan la mitad ([Pelland, 2024](https://sportrxiv.org/index.php/server/preprint/view/460)).

### Popular pero mal respaldado (no lo usaremos)
- **Modelo fitness-fatiga de Banister**: parámetros inestables y predicción pobre con pocos datos ([Stephens Hemingway](https://rgu-repository.worktribe.com/OutputFile/691845)).
- **Ratio de carga aguda:crónica**: sus propios críticos piden descartarlo ([Impellizzeri, 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7534938)).
- **Descargas fijas cada 4 semanas**: una semana de parón no mejoró nada ([Coleman, 2024](https://peerj.com/articles/16777)). Mejor descargar solo cuando haga falta.
- **Ajustar volumen por agujetas o bombeo**, y los números MEV/MRV: heurística sin validar.
- **Sueño y agujetas** como predictores de fuerza: sin evidencia; no merece la pena pedirlos.
- **«Grease the groove» y programas rusos de dominadas**: ningún ensayo serio. Se pueden usar, sabiendo que es práctica de entrenadores.
- **Meseta**: no hay definición científica; la convención es 3–4 semanas sin mejora (1–2 es ruido).

## 3. Qué se puede ejecutar en el móvil, gratis

| Opción | En Expo Go | Aprende en el móvil | Estado |
|---|---|---|---|
| TypeScript a mano (Kalman, bayesiana, bandido, red pequeña) | Sí | Sí | Propio, sin dependencias |
| ml.js (`ml-matrix`, `ml-regression`) | Sí | Sí | Estable, poco activo |
| TensorFlow.js en React Native | Dudoso | Sí | Adaptador sin mantener |
| react-native-fast-tflite, ONNX Runtime, ExecuTorch | No (necesitan APK) | No, solo ejecutan modelos ya entrenados | Activos |

Fuentes: [fast-tflite](https://github.com/mrousavy/react-native-fast-tflite), [tfjs, incidencia 8640](https://github.com/tensorflow/tfjs/issues/8640), [ONNX Runtime](https://onnxruntime.ai/docs/get-started/training-on-device.html), [ExecuTorch](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started).

Ninguna librería nativa entrena dentro del móvil. Para un modelo de unos cientos de parámetros y unos cientos de datos, el cálculo son milisegundos (estimación; hay que medirlo). No hay ningún conjunto público de registros de entrenamiento de muchas personas para preentrenar; [OpenPowerlifting](https://www.openpowerlifting.org/) (dominio público) solo sirve como referencia de niveles de fuerza.

## 4. Propuesta para Forja

Hoy la app progresa con una escalera fija (`src/domain/progression.ts`): repeticiones → bajada lenta → pausa → una serie más → variante, mirando solo si completaste la sesión y si fue fácil, normal o dura. La propuesta la sustituye por cuatro capas, cada una útil por sí sola.

### Capa 1 · Medir mejor (un toque más por ejercicio)
- Añadir «¿cuántas más habrías podido hacer en la última serie?»: **0 · 1–2 · 3 o más**.
- Se mantiene la sensación de la sesión. No se pide sueño ni agujetas.

### Capa 2 · Tu fuerza real, con su incertidumbre
- Por cada ejercicio, un **filtro de Kalman** que estima dos cosas: tu nivel actual y tu ritmo de mejora. Con peso usa el 1RM estimado de la mejor serie de menos de 10 repeticiones; sin peso, las repeticiones equivalentes al fallo (las hechas más las que quedaban).
- Distingue progreso real de un mal día, detecta la meseta con criterio (ritmo indistinguible de cero durante 3–4 semanas) y da proyecciones con margen: «10 dominadas entre febrero y abril».
- Sustituye a la proyección lineal actual (`src/domain/insights.ts`).

### Capa 3 · Consejo por reglas que se ajustan a ti
- **Doble progresión con RIR**: si llegas al tope del rango con margen, sube el peldaño; si no, una repetición más.
- **Banca**: si te desvías 2 o más del RIR objetivo, la carga cambia un 2,5–5 % la próxima vez; opción de serie final al máximo en un día de gimnasio.
- **Descarga reactiva**: dos sesiones duras seguidas con caída de rendimiento → una semana con la mitad de series.
- **Meseta**: 3–4 semanas sin mejora → cambiar rango o variante; si además te resulta fácil, un 20 % más de series.
- Los umbrales arrancan con los valores de los estudios y se van corrigiendo con tus datos (por ejemplo, cuánto sueles equivocarte al estimar el RIR).
- **Cada consejo explica su porqué** en una frase: «Subes a 9 repeticiones: llevas tres sesiones completas con margen».

### Capa 4 · Probar y quedarse con lo que te funciona
- Un **bandido de Thompson** elige, por bloques de 4 semanas y para cada objetivo, entre 2 o 3 variantes (por ejemplo, en dominadas: series submáximas frecuentes frente a menos series más duras). La recompensa es el ritmo de mejora que mide la capa 2.
- Es la parte que de verdad «aprende». Aprende despacio: unas 12 pruebas al año por objetivo, y eso hay que decirlo en la app.

### ¿Y la red neuronal y lo «evolutivo»?
- **Red neuronal, como experimento con examen**: una red pequeña escrita a mano que prediga las repeticiones de la próxima sesión. Se compara contra el filtro de Kalman con tus propios datos pasados, y solo se usa si acierta más. Lo esperable con menos de un año de datos es que no gane.
- **Algoritmo evolutivo, donde sí encaja**: componer una sesión o semana cuando hay restricciones (viaje, poco tiempo, material limitado) respetando el volumen por músculo. No aprende, optimiza.

### Cómo se construye
- Módulos puros en `src/domain/` con funciones `(estado, observación) → estado`, probados en Node como el resto.
- El estado del modelo se guarda como JSON en una tabla nueva de SQLite y entra en la copia de seguridad. Como el registro completo ya está guardado, el modelo se puede recalcular desde cero.
- Orden: capa 1 y 2 juntas (ya dan valor visible) → capa 3 → capa 4 → experimento de la red.

## 5. Decisiones (20/11/2026)
1. **Enfoque**: núcleo con Kalman, reglas y bandido; la red neuronal, como experimento con examen. (No hubo objeción al enfoque recomendado; se puede cambiar.)
2. **Se apunta lo que quedaba** en la última serie de cada ejercicio.
3. **El entrenador cambia el plan solo**, explicando cada cambio.
4. **Prioridad: tren superior.** Cuando haya que elegir (tiempo, fatiga, variantes), manda el tren superior.
5. **La semana puede tener más sesiones de las previstas.** El entrenador debe contar con sesiones extra y con días de fatiga.

## 6. Estado
- ✅ **Capa 1** (20/11/2026): pregunta «¿cuántas más habrías podido hacer?» en cada ejercicio de las sesiones de casa (opcional); tabla `effort_log`, incluida en la copia de seguridad.
- ✅ **Capa 2** (20/11/2026): `src/domain/coach.ts`, filtro de Kalman de nivel y ritmo por ejercicio. Se ve en la ficha de cada ejercicio como «Tu nivel real», con margen, tendencia y previsión con horquilla de fechas.
- ✅ **Capa 3, primera parte** (20/11/2026):
  - **El plan cambia según lo que quedaba** en cada ejercicio (`progress` en `src/domain/progression.ts`): al límite se repite; con una o dos de margen, una más; con tres o más, dos de golpe; en el tope del rango basta con que quede margen para subir de peldaño. Donde no se contestó, decide la sensación de la sesión, como antes.
  - **Baja un peldaño** tras dos sesiones seguidas sin completar un ejercicio.
  - **Cada cambio lleva su porqué**, que se ve al guardar la sesión.
  - **Sesión ligera** («¿Cómo llegas hoy?» → Cansado): solo tren superior, un tercio menos de series y sin mover el plan. El entrenador la propone si llevas 4 sesiones en 7 días, tres días seguidos o dos sesiones duras recientes.
  - **Sesión extra** en día de descanso (pantalla Hoy): propone la sesión que hace más tiempo que no haces y dice si conviene ligera.
- **Pendiente, por orden**:
  1. Llevar el nivel real a los objetivos (dominadas, flexiones, banca) y a la pantalla Hoy, y pedir la reserva también en el gimnasio.
  2. **Capa 3, segunda parte**: usar el nivel real para detectar mesetas (3–4 semanas sin mejora) y cambiar rango o variante; ajustar el volumen semanal con prioridad al tren superior; ajuste de carga en banca.
  3. **Capa 4**: probar variantes por bloques de 4 semanas.
  4. Experimento de la red neuronal contra el filtro.
