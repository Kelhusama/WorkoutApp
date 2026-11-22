# Puntos flacos conocidos

Estado a 22 de noviembre de 2026. Lista viva: lo que está flojo, por qué importa y qué lo arreglaría. Se revisa antes de añadir funciones nuevas.

## 1. Lo que más pesa

| Punto flaco | Por qué importa | Qué lo arregla |
|---|---|---|
| **Casi nada probado en el móvil.** Solo los estiramientos. Todo lo demás se ha comprobado en el navegador del ordenador. | Avisos, vibración, cámara, teclado y exportar copia solo existen en el móvil. Puede haber fallos que aquí no se ven. | Una semana de uso real siguiendo `docs/PRUEBAS.md`. **No añadir funciones hasta entonces.** |
| **Los minutos de cada rutina son una estimación** (3 s por repetición, más descansos y 20 s por ejercicio). | La rutina «de 20 minutos» puede ser de 17 o de 25. | Las sesiones guiadas ya apuntan lo que duran de verdad; falta usar ese dato para corregir la estimación. |
| **Google en el móvil sin probar.** En el navegador funciona (iniciar sesión, guardar, restaurar), con una copia vacía. | La copia automática en la nube es lo que protege de perder el móvil. | Generar el APK (cuenta gratuita de Expo y credenciales de Android en Google Cloud). Mientras, exportar copia a mano cada semana. |
| **Las fotos de progreso no entran en ninguna copia.** | Si se pierde el móvil, se pierden. | Incluirlas en la copia de Drive. |

## 2. Entrenamiento

- **La fatiga de tirón depende de que se conteste** «¿cuántas más habrías podido hacer?» al acabar las dominadas. Sin esa respuesta solo ve cuántos días se han hecho.
- **La carga y el «cómo estabas» de cada entrenamiento se guardan, pero aún no se usan para decidir nada.** El aviso de fatiga sigue mirando solo sesiones de casa, gimnasio y dominadas. Lo lógico es que la carga semanal y los días «cansado» o «con molestias» lo alimenten.
- **Gimnasio y sesiones de casa con detalle siguen siendo una vez al día cada una.** Una segunda se apunta en modo rápido, sin series.
- **La duración solo se mide en las sesiones guiadas** de casa y de dominadas; en el resto se pone a mano o queda vacía.
- **El gimnasio no cuenta para decidir cargas.** Se apunta qué se trabajó (tirón, empuje, pierna), pero el entrenador no lo usa para el volumen semanal ni para subir o bajar.
- **Con rutinas de 20 minutos, el volumen de pecho y bíceps en casa queda por debajo de la zona de hipertrofia.** Es coherente con priorizar dominadas; el músculo tiene que venir del gimnasio.
- **El plan de dominadas da por hecho que la prueba cae en sábado.** Si se cambia la fecha, los días de la semana no se recolocan bien.
- **La etiqueta «mejorando» tarda unos dos meses en cambiar** tras un parón. El estancamiento se detecta por otra vía (tres semanas sin mejorar), así que no afecta a las decisiones, solo al texto.
- **El experimento de variantes sigue activo** durante el plan de dominadas. Convendría apagarlo hasta enero: ahora no tiene sentido que pruebe cosas.
- **Las superseries cansan más de respiración.** No está medido si las flexiones salen peor alternadas; si pasa, alargar el descanso de 40 s.
- **De viaje no hay sustituto de las dominadas** (decisión tomada: se paran y se retoman). En viajes de más de una semana habría que volver con una serie menos; no está programado.

## 3. Datos y técnica

- **En el navegador la app solo puede estar abierta en una pestaña** y la sesión de Google dura una hora. Es un entorno de pruebas, no para uso diario.
- **Paso de la base antigua a la nueva (v22)** comprobado con tests, no con una base real con viajes guardados.
- **Sesiones de viaje antiguas** (con ejercicios de toalla o mesa, ya quitados): si existiera alguna guardada, al editarla se verían los ejercicios actuales, no los que se hicieron. Solo podría pasar en el navegador de pruebas.
- **Las pantallas interiores** todavía usan el diseño de tarjetas anterior; solo Hoy, Entrenar y la barra inferior tienen el nuevo.

## 4. Aparcado a propósito

- **Press banca a 80 kg**: hasta que haya material. En la prueba del 16 de enero lo hace un compañero.
- **Fecha de la Marcha del Mamut**: se rellenará más adelante.
- **Comprar mancuernas**: de momento no. Sí hacen falta los discos para el cinturón (pedir antes del 3 de diciembre).

## 5. Reglas que nos hemos puesto

- Sesiones de casa de 20 minutos como mucho en la rutina media; la corta, unos 10.
- Las dominadas mandan: nunca en superserie, y lo que las ayuda va siempre en la rutina media.
- Nunca un banco. Nada de pago.
- La base de datos solo añade: no se quita ni se renombra nada.
- Antes de dar algo por bueno, verlo en el navegador a tamaño de móvil.
