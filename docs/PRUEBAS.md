# Pruebas pendientes en el móvil

Todo lo de esta lista está construido y pasa los tests automáticos, pero **no se ha visto funcionando en un teléfono**. Marca cada punto al probarlo y apunta al lado lo que falle.

Para probar: `npx expo start` en la carpeta del proyecto y escanear el QR con Expo Go (misma Wi-Fi).

## Probado
- [x] **Estiramientos guiados** (16/11/2026): funcionan bien.

## Por probar, de mayor a menor riesgo
| ✓ | Qué | Dónde | En qué fijarse |
|---|---|---|---|
| [ ] | Temporizador de descanso | Al pie de cualquier sesión de casa | Que vibre al terminar y avise con la app en segundo plano |
| [ ] | Avisos de sesión | Hoy → Perfil y avisos | Que pida permiso y lleguen a las 9:00, 10:00 y 12:00 los días de sesión en casa |
| [ ] | Fotos de progreso | Progreso → Fotos | Cámara, galería, comparador antes/ahora y borrar |
| [ ] | Copia de seguridad | Perfil y avisos | Exportar a un archivo, guardarlo fuera del móvil y restaurarlo |
| [ ] | Pegar datos de la captura | Cuerpo → Registrar medición | Que lea bien el texto copiado de Huawei Salud y ponga la fecha de la medición |
| [ ] | Dibujos de los ejercicios | «Cómo se hace» dentro de una sesión | Que la animación vaya fluida y se entienda la postura |
| [ ] | Registro de una sesión | Hoy → Registrar sesión | Corregir series, guardar, ver récords y lo que cambia para la próxima |
| [ ] | Aviso al salir sin guardar | Sesión y medición | Que pregunte antes de perder lo escrito |
| [ ] | Bloque de pierna | Sesiones A, B y C | Que los dos ejercicios de pierna aparezcan y se entiendan |
| [ ] | Gimnasio | Hoy, un día de gimnasio | Banca, 1RM estimado, discos y calentamiento |
| [ ] | Marcha | Entrenar → Marcha | Empezar el plan, registrar una caminata y que avance al hacer la tirada larga |
| [ ] | Semana tipo y cambio de días | Calendario | Cambiar días de gimnasio y mover un día suelto |
| [ ] | Viajes | Calendario → Viajes | Crear un viaje y ver las sesiones adaptadas |
| [ ] | Calendario mensual | Calendario → Mes | Que se lea bien y se pueda tocar cada día |
| [ ] | Cuerpo | Cuerpo | Perfil, medición, indicadores y sus gráficas |
| [ ] | Progreso | Progreso | Racha, volumen por músculo, ficha de cada ejercicio |
| [ ] | Revisión semanal y proyección | Progreso | Que los números tengan sentido con tus datos |
| [ ] | Flexibilidad | Entrenar → Flexibilidad | Sesión del programa y registrar un test |
| [ ] | Dibujos de los estiramientos de brazos y espalda | Entrenar → Estiramientos → rutinas tras la sesión | Que se entienda cada postura |
| [ ] | Teclado «Siguiente» | Registrar medición y Registrar caminata | Que salte al campo siguiente sin cerrarse y el último lo cierre |
| [ ] | Tocar las gráficas | Cuerpo, Progreso, Marcha | Que al tocar o arrastrar se vea la fecha y el valor del punto, y que la pantalla siga deslizando bien |
| [ ] | Entrenador: lo que quedaba | Cualquier sesión de casa, debajo de las series | Que la pregunta se entienda, se pueda guardar sin contestar y al editar la sesión siga marcada |
| [ ] | Entrenador: tu nivel real | Progreso → Ejercicios → un ejercicio | Que el nivel, la tendencia y la gráfica tengan sentido con lo que has hecho |
| [ ] | Entrenador: sesión ligera | Cualquier sesión de casa → «¿Cómo llegas hoy?» → Cansado | Que quite la pierna y un tercio de las series, y que al guardar no cambie nada del plan |
| [ ] | Entrenador: el porqué de cada cambio | Al guardar una sesión | Que cada ejercicio diga qué cambia y por qué, y que tenga sentido con lo que contestaste |
| [ ] | Entrenador: sesión extra | Hoy, en un día de descanso | Que proponga una sesión, se pueda hacer y el día quede como hecho |
| [ ] | Foto guiada | Progreso → Fotos → Hacer foto | Que pida permiso, se vea la foto anterior encima, funcione el temporizador y la foto se guarde |
| [ ] | Cómo voy | Cuerpo | Que cada objetivo tenga sentido con tus medidas y diga qué falta si no hay datos |
| [ ] | Aviso mensual | Hoy | Que aparezca «Toca revisión mensual» si hace más de un mes de la cinta o las fotos |
| [ ] | Entrenador: banca | Hoy, un día de gimnasio | Que proponga la carga con su motivo, pregunte lo que quedaba y la próxima vez lo tenga en cuenta |
| [ ] | Entrenador: mesetas | Al guardar una sesión tras semanas con lo mismo | Solo se ve con semanas de uso: que añada una serie arriba y lo explique |
| [ ] | Entrenador: bloques de prueba | Objetivos → test de dominadas o flexiones | Que el primer test abra un bloque, que explique qué se está probando y, a las 4 semanas, que el siguiente test lo cierre y elija otro |
| [ ] | Aspecto general | Todas las pantallas | Textos cortados, botones difíciles de pulsar, el teclado tapando campos |

## Solo con la app instalada (APK)
No se pueden probar en Expo Go:
- [ ] Inicio de sesión con Google y copia en Drive (rama `google-drive`, sin fusionar).
- [ ] Avisos puntuales al minuto.
- [ ] Leer la captura eligiendo la imagen; GPS en las caminatas (sin construir).

## Cómo avisar de un fallo
Di en qué pantalla estabas y qué pulsaste. Los errores del móvil aparecen también en la terminal donde corre Expo, así que se pueden leer desde ahí.
