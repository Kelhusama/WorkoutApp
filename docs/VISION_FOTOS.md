# Fotos y visión por computador: investigación y propuesta (20/11/2026)

Pregunta de partida: ¿se pueden usar las fotos de progreso, con visión por computador, para ver cómo voy y recibir recomendaciones con objetivos claros?

**Respuesta corta**: sí para alinear las fotos y medir proporciones (hombros frente a cintura); no para sacar el porcentaje de grasa ni para ver si ha crecido el brazo. Los objetivos claros salen mejor del peso, la cinta y las cargas, que la app ya registra. La parte de visión necesita el APK; en Expo Go solo hay una vía sin probar.

> **Fiabilidad de las fuentes.** Tres estudios se leyeron completos a través de un resumidor; el resto son abstracts o fragmentos. Las cifras hay que comprobarlas en el original antes de fijarlas en la app. Lo no verificado va marcado.

## 1. Qué se puede medir de verdad con fotos

### Porcentaje de grasa: no
- El mejor sistema publicado (Amazon Halo, con modelo propietario entrenado con miles de DXA) falla de media 2,2 puntos, con casos de −5,5 a +4,7, y en condiciones de laboratorio ([Majmudar, 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9243018)).
- Para seguir cambios en 12 semanas, otro sistema acertó la dirección pero con un error de 1,65 puntos ([estudio BodyScan](https://www.cambridge.org/core/product/306E2A25CFCD0BD90694A930073ACB00)).
- Una revisión de 2025 sobre escaneo con móvil da errores de 2,5 a 5,2 ([revisión](https://pmc.ncbi.nlm.nih.gov/articles/PMC12797699)).
- No hay ningún modelo gratuito y local validado. Un cambio real de 1–2 puntos en unas semanas queda dentro del ruido.
- La cinta tampoco es perfecta: la fórmula de la Marina se equivoca 3–4 puntos e infraestima los cambios ([estudio con 926 hombres](https://pmc.ncbi.nlm.nih.gov/articles/PMC10282178)). La báscula es muy sensible a cómo llegas ese día ([Tinsley, 2022](https://www.pubmed.gov/34325758/)). Ambas valen como tendencia suavizada, no como valor exacto.

### Crecimiento del brazo o del pecho: no
- No se encontró ningún estudio que lo detecte con fotos; se usa ecografía o cinta.
- Estimación propia: 1 cm más de perímetro son unos 3 mm de diámetro, es decir, 2–4 píxeles a dos metros. Menos que el error de la pose y de la contracción.
- **Para esto, la cinta**: mismo punto, en frío, media de dos o tres lecturas, una vez al mes.

### Proporciones y alineación: sí
- Las medidas de anchura repetidas con el mismo móvil son tan repetibles como la cinta (error de 0,5–1,1 cm en cintura), aunque no exactas en valor absoluto ([Graybeal, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10442791/)).
- Un **cociente** (hombros/cintura) cancela la distancia a la cámara, así que es lo más defendible. Repetibilidad esperada del 1–2 %, a calibrar con tres tomas el mismo día (estimación propia).
- Lo más valioso es cualitativo: ver dos fotos bien alineadas, lado a lado o superpuestas.

### Postura: poco
- La cabeza adelantada en la foto lateral es lo único bien validado, y solo detecta cambios de 5° o más ([estudio](https://www.mdpi.com/2076-3417/13/6/3910)). Hombros redondeados y pelvis, no.

### Qué estropea la medida
Cambiar de móvil, la distancia y la altura de la cámara, la ropa, la luz, la postura y haber entrenado antes.

**Protocolo de foto** (deducido de los estudios; no hay uno publicado):
- mismo móvil y lente, misma distancia y altura (marca en el suelo, móvil apoyado siempre en el mismo sitio);
- por la mañana, en ayunas, sin haber entrenado;
- misma ropa ajustada, misma luz, pose relajada, tras soltar el aire.

## 2. Objetivos claros (con respaldo)

| Objetivo | Referencia | Cómo se mide |
|---|---|---|
| Cintura / altura | Por debajo de 0,5; vale también en gente musculada ([NICE](https://www.nice.org.uk/guidance/NG246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity)) | Cinta |
| Ritmo de pérdida de peso | 0,5–1 % del peso por semana para conservar músculo ([Helms, 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492)) | Tendencia de peso (ya existe) |
| Brazo y pecho | Subida sostenida de 0,5–1 cm o más | Cinta, mensual |
| Hombros / cintura | Estético, no de salud; el «1,6» popular no tiene fuente sólida | Foto frontal |
| Fuerza | Dominadas, flexiones y banca | Ya existe, con el nivel real del entrenador |

El índice de masa libre de grasa (tope natural hacia 25) depende del porcentaje de grasa, que aquí tiene mucho error: solo orientativo.

## 3. Qué se puede ejecutar en el móvil, gratis

| Opción | Expo Go | APK | Qué da | Pega |
|---|---|---|---|---|
| MediaPipe Pose Landmarker (modo imagen) | No | Sí | 33 puntos del cuerpo y máscara de silueta en una llamada | El paquete de React Native es de un solo autor; quizá haya que escribir un módulo propio en Kotlin (100–150 líneas) |
| MoveNet con react-native-fast-tflite | No | Sí | 17 puntos, sin silueta | Hay que preparar la imagen a mano |
| ML Kit (pose, silueta) | No | Sí | Pose y silueta | Sin paquete de React Native terminado |
| ExecuTorch con YOLO | No | Android 13+ | 17 puntos | Licencia AGPL del modelo |
| WebView con MediaPipe web | Sí, sin probar | Sí | Lo mismo que la primera | Hay que inyectar unos 15–20 MB; nadie lo ha publicado funcionando |
| Modelos 3D del cuerpo (SMPL y similares) | No | No | Forma 3D | Licencia no comercial y cientos de MB |

Fuentes: [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker), [paquete de React Native](https://socket.dev/npm/package/react-native-mediapipe-posedetection), [fast-tflite](https://github.com/mrousavy/react-native-fast-tflite), [ML Kit](https://developers.google.com/ml-kit/vision/selfie-segmentation/android), [ExecuTorch](https://docs.swmansion.com/react-native-executorch/docs/hooks/computer-vision/usePoseEstimation), [licencia SMPL](https://smpl.is.tue.mpg.de/license.html).

No se encontró ningún proyecto abierto que alinee fotos de progreso: habría que hacerlo propio (una transformación a partir de hombros y caderas).

## 4. Cautela
Las apps que puntúan el cuerpo se asocian con preocupación por la imagen corporal, y revisarse el cuerpo a menudo, con dismorfia muscular en hombres que entrenan ([revisión, 2025](https://pubmed.ncbi.nlm.nih.gov/39671845/); [estudio](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8497756/)). Por eso: **sin nota global del físico**, tendencias con su margen, y fotos cada dos semanas o un mes.

## 5. Propuesta para Forja

### Fase A · Sin visión, funciona ya en Expo Go
1. **Foto guiada**: al hacer la foto, la anterior aparece semitransparente encima de la cámara para repetir el encuadre, con el protocolo en pantalla.
2. **Panel «Cómo voy»** con los objetivos de la tabla: cintura/altura, ritmo de peso, brazo y pecho con cinta, y fuerza. Cada uno con su estado y una recomendación en una frase.
3. **Aviso mensual** de cinta y fotos el mismo día.

### Fase B · Con visión, cuando haya APK
4. **Alineación automática**: detectar hombros y caderas y cuadrar escala y posición entre fechas; comparador con cortinilla y superposición.
5. **Hombros / cintura** desde la silueta de la foto frontal, con su gráfica y su margen, calibrado con tres tomas el mismo día.
6. Opcional: cabeza adelantada en la foto lateral.

### Lo que no se hará
Porcentaje de grasa desde fotos, perímetros absolutos, detección de hipertrofia y cualquier puntuación del físico.
