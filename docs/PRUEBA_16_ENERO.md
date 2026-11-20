# Prueba del 16 de enero de 2027

Prueba de equipo, a **tres repeticiones**. Al usuario le tocan dos levantamientos; el press de banca lo hace otro compañero.

| Prueba | Objetivo | Punto de partida (20/11/2026) | Estimación para el día |
|---|---|---|---|
| Peso muerto | 100 kg × 3 | 80 kg × 8, que equivale a unos 92 kg × 3 | 100–105 kg × 3: **alcanzable** |
| Dominadas con lastre | 12 kg × 3 | 4 estrictas sin lastre (medidas el 20/11), unos 2,5 kg × 3 | 3 con 6–10 kg; **12 kg, solo si todo sale bien y baja 2–3 kg de peso** |
| Colgarse (si cae) | — | — | Se entrena al final de las sesiones de dominadas |

Las cifras son estimaciones con la fórmula de Epley a partir de las series que contó el usuario, no medidas. El punto débil del equipo son las dominadas.

**Reglas de la dominada**: estricta, sin balanceo, bajando hasta abajo con los brazos estirados. El agarre no tiene que ser ancho.

## El plan (8 semanas, contando hacia atrás desde el 16 de enero)

| Semana | Fechas | Dominadas | Peso muerto (1 día) |
|---|---|---|---|
| 1 · Coger práctica | 21–27 nov | 4 días, 6 × 1 sin lastre | 4 × 5 con 80 kg |
| 2 · Más repeticiones | 28 nov – 4 dic | 4 días, 5 × 2 sin lastre | 4 × 4 con 85 kg |
| 3 · Volumen sin lastre | 5–11 dic | 4 días, 6 × 2 sin lastre; test de máximo el último día | 4 × 3 con 87,5 kg |
| 4 · Empieza el lastre | 12–18 dic | 3 días, 5 × 2 con 2 kg | 3 × 3 con 90 kg |
| 5 · Series de tres | 19–25 dic | 3 días, 4 × 3 con 2 kg | 3 × 3 con 92,5 kg |
| 6 · Más lastre | 26 dic – 1 ene | 3 días, 4 × 3 con 4 kg | 3 × 3 con 95 kg |
| 7 · Buscar el tope | 2–8 ene | 3 días, 4 × 3 con 6 kg o lo que salga limpio | 2 × 3 con 97,5 kg |
| 8 · Descarga | 9–15 ene | 2 días (lunes 11 y miércoles 13), 3 × 2 con 4 kg; descanso el 14 y el 15 | 2 × 2 con 85 kg |

- En dominadas, nunca al fallo y 2–3 minutos entre series. El lastre sube de 2 en 2 kg, solo si todas las series salieron limpias y sobraba una.
- En peso muerto, solo se sube si todas las repeticiones salieron con la espalda recta.
- Cada kilo de peso corporal que se pierda es un kilo menos que subir en la dominada.
- El día de la prueba: nada que no se haya hecho entrenando, o como mucho 2,5–5 kg más.

No hay ensayos serios sobre programas de dominadas de este tipo: es práctica de entrenadores. El test de la semana 3 dirá si va en camino (lo esperable son 4–5 estrictas).

## En la app (20/11/2026)

- **Apartado propio** en *Entrenar → Prueba del 16 de enero* (`src/app/prueba.tsx`): cuenta atrás, dónde está hoy cada levantamiento, lo que toca esta semana con sus días hechos, las reglas, la gráfica y el plan entero.
- **Apuntar cada sesión**: kilos, repeticiones, series y lo que quedaba (tabla `trial_log`, incluida en la copia de seguridad).
- **El plan se ajusta a lo apuntado** (`prescription` en `src/domain/event.ts`): en dominadas el lastre no pasa del demostrado más 2 kg; en peso muerto se repite el peso si la última vez fue al límite.
- **Hoy** muestra una fila con lo que falta esta semana.
- **Días de dominadas**, siempre entre semana: con cuatro días, lunes, martes, jueves y viernes; con tres, lunes, miércoles y viernes; con dos, lunes y miércoles.
- **Plan activo** (interruptor en el apartado): avisos los días de dominadas a las horas de *Perfil y avisos* (por defecto 9:00, 10:00 y 12:00), hasta tres al día y solo mientras no se hayan apuntado.
- **Sesión guiada** (`src/app/dominadas.tsx`): calentamiento de 3–4 minutos, series de una en una con 2:30 de descanso cronometrado y vibración, registro al terminar y enlace a los estiramientos de dorsal, bíceps y antebrazo. Martes y viernes (o miércoles y viernes) añade 3 minutos de cuidado de codos.
- **Sin doble carga**: con el plan activo, las sesiones de casa no traen dominadas ni negativas (`TRIAL_COVERS`), y tampoco se pide el test de dominadas del entrenador. Se quedan flexiones, curl y el resto. Al desactivar el plan o pasar la prueba, vuelven.
- **Las dominadas mandan** (revisión de coherencia, 20/11/2026): en Hoy y en Entrenar la prueba va lo primero; los días de dominadas solo avisan de las dominadas, no de la sesión de casa; si ese día hay sesión de casa, se abre en ligera; y con el plan activo no se propone sesión extra salvo que la semana esté marcada como «Más».
- **Agarres** (20/11/2026): cada día de dominadas tiene el suyo. Con cuatro días: lunes prono, martes supino, jueves neutro y viernes prono. Con tres: prono, supino o neutro (alternan por semanas) y prono. En la descarga, solo prono. El agarre de la prueba es prono, con las palmas hacia fuera (`TEST_GRIP`), confirmado por el usuario el 20/11/2026. El agarre se puede cambiar en la sesión guiada y se guarda con cada sesión.
- **Sesión de casa con el plan activo**: la sesión enfocada pasa a ser tres flexiones (estrictas, inclinadas y en pica) y tres ejercicios con la mancuerna (curl, martillo y press), sin dominadas.
- **Fecha y objetivos editables** desde el apartado («Cambiar fecha u objetivos»): el plan se recalcula hacia atrás desde la nueva fecha y los kilos de peso muerto se escalan con el objetivo. Los días de dominadas están pensados para una prueba en sábado.
- **Colgarse** con progresión propia al final de la sesión guiada: intento al máximo si no hay marca o el último día de dominadas de la semana; el resto, dos series a tres cuartos de la mejor marca de las últimas cuatro semanas (tabla `hang_log`).
- **Gimnasio**: se puede marcar qué se trabajó (tirón, empuje, pierna). Si ayer u hoy hubo tirón, la sesión de dominadas lo avisa.
- **Menos ruido**: con el plan activo, Hoy no pide el test de flexiones ni la revisión mensual. Siguen el aviso de pesarse (hace falta para calcular el lastre) y el de descarga.

## Material

- El usuario tiene **cinturón de lastre pero aún no tiene discos** (20/11/2026). El plan pide lastre desde la semana 4 (12 de diciembre), en saltos de 2 kg: hacen falta discos pequeños o un sustituto antes de esa fecha. Dónde comprarlos: [DISCOS.md](DISCOS.md) (recomendación: tres discos de hierro de 2 kg de Decathlon, 14,97 €).
- Sustitutos válidos mientras tanto: botellas de agua en una bolsa colgada del cinturón (1,5 kg cada una). La mancuerna de 10 kg es un salto demasiado grande para empezar.

- **El plan tiene en cuenta los discos** (20/11/2026): en *Tu lastre* se indica cuántos discos de 1, 1,25, 2, 2,5 y 5 kg hay. El plan solo pide pesos que se puedan montar (admite medio kilo de diferencia). Lo que no se pueda montar se cambia por repeticiones equivalentes: sin discos, 3 con 2 kg pasan a 4 sin lastre, y 3 con 4 kg a 5. Hoy avisa de que faltan discos desde cuatro semanas antes de la primera semana con lastre.

## Riesgos

- El mayor riesgo es perseguir los 12 kg de lastre subiendo más rápido de lo que aguantan los codos.
- El usuario venía de una semana de 4 días de gimnasio y algo fatigado: mientras dure el plan conviene recortar remos y jalones pesados y mantener los días de movilidad.
- Parar o aflojar ante dolor punzante en una articulación, dolor que sigue al día siguiente en el mismo punto, o una repetición que solo sale deformando la técnica.
