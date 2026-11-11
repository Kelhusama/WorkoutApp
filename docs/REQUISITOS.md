# Requisitos — WorkoutApp (nombre provisional: "Forja")

App Android personal para seguir el rendimiento, ganar músculo (bíceps y pecho sobre todo), perder grasa y llegar a 10 dominadas. Combina 2 días de gimnasio con sesiones cortas en casa.

> Estado: en desarrollo · actualizado 12/11/2026

---

## 1. Usuario y punto de partida

| | |
|---|---|
| Usuarios | Uno solo (uso personal) |
| Nivel | Intermedio, varios años entrenando |
| Dispositivo | Móvil Android |
| Dominadas | 3–4 sin lastre |
| Flexiones | ~10 poco estrictas |
| Press banca | 50 kg |
| Material en casa | Barra de dominadas colgada (varios agarres: neutro, supino, prono ancho), mancuerna única de 10 kg, gomas elásticas |
| Fuera del alcance | Piernas (no se planifican) |

### Objetivos

| Objetivo | Actual | Hitos intermedios | Meta |
|---|---|---|---|
| Dominadas estrictas seguidas | 3–4 | 6 → 8 | **10** |
| Flexiones estrictas seguidas | ~6–8 | 15 → 25 → 40 | **50** |
| Press banca (mejor serie / 1RM estimado) | 50 kg | 60 → 70 kg | **80 kg** |
| Grasa corporal | — | tendencia de peso y cintura a la baja | perder grasa sin perder músculo |
| Prioridades musculares | | | Bíceps, pecho, antebrazo; extra: hombro, remo, press vertical |

Los hitos se muestran como progreso y celebran al alcanzarse.

---

## 2. Planificación semanal

### Estructura
- **Semana tipo configurable** ✅ en la app: cada día es gimnasio, casa o descanso (de 1 a 4 días de gimnasio). Por defecto: gimnasio lunes y jueves, casa martes, miércoles y viernes, descanso fin de semana.
- Las sesiones de casa A/B/C se reparten solas. Si hay más de 3 días de casa, se repite el ciclo.
- **Cambiar un día concreto** ✅ solo para esa semana (⇄ en el calendario o «Cambiar lo que hago hoy»), y volver a la semana tipo.
- Cambiar la semana tipo se aplica desde la semana actual; las semanas pasadas no cambian y los días ya registrados conservan lo que se hizo.

### Reglas
- **R1** — Nunca una sesión de tirón fuerte (A) el día siguiente al gimnasio.
- **R2** — Si una sesión no se hace, se marca como **fallada** y el plan **no se reorganiza**.
- **R3** — Los días marcados como **viaje** usan alternativas sin material y no cuentan como fallo si no se entrena.
- **R4** — Si pasan más de 10 días sin registrar press de banca, se recuerda hacerlo al final del gimnasio (3×5).


---

## 3. Sesiones en casa

Sin llegar al fallo salvo en tests. Los ejercicios con mancuerna se hacen a una mano.

### A · Tirón (dominadas + bíceps + espalda)
- Dominadas agarre neutro/supino: 5–6 × 2 (≈ mitad del máximo)
- Negativas lentas (4–5 s): 3
- Remo con mancuerna a una mano: 3 × 10–15 por brazo
- Curl concentrado: 3 × 8–12 por brazo

### B · Empuje (pecho + hombro + antebrazo)
- Flexiones estrictas: 4 × 4–6
- Flexiones inclinadas (manos en silla/banco): 3 × 10–12
- Flexiones en pica: 3 × 5–8
- Curl de muñeca: 2 × 15–20 por brazo
- Curl de muñeca inverso: 2 × 15–20 por brazo

### C · Mixta suave
- Dominadas (neutro, o con goma): 3–4 × 2
- Press militar a una mano: 3 × 8–12 por brazo
- Curl martillo: 3 × 10–12 por brazo
- Pájaros o separación de goma: 2 × 15
- Colgarse de la barra: 2 × 30 s

### Progresión automática
Basada en reps completadas + sensación (fácil / normal / dura):
- **Fácil** y todo completado → sube la dificultad la próxima vez.
- **Normal** → mantiene o sube ligeramente.
- **Dura** o incompleta → mantiene.

Escalera de dificultad (con peso fijo de 10 kg):
1. Más repeticiones hasta el tope del rango
2. Fase excéntrica lenta (3–4 s)
3. Pausa de 1–2 s en contracción
4. Una serie más
5. Variante más difícil

Variantes por familia:
- **Flexiones**: inclinadas → estrictas → pies elevados → déficit → con mochila → arqueras. Las pies elevados y diamante se desbloquean con 15 estrictas.
- **Dominadas**: con goma → negativas → series cortas frecuentes → más reps por serie → lastre con mochila.
- **Press vertical**: pica → pica con pies elevados.

### Tests periódicos
Cada 4 semanas, test de máximo de dominadas y flexiones estrictas (alimentan los objetivos).

---

## 4. Gimnasio

El usuario tiene su rutina (halterofilia y ejercicios compuestos, sin trabajo aislado de bíceps). No se planifica, solo se registra de forma **mínima (~20 s)**:
- ✅ Hecho + sensación
- ¿Press de banca hoy? → mejor serie: peso × reps (calcula 1RM estimado)
- 📷 Foto opcional de la pizarra o rutina del día

---

## 5. Modo viaje

- Marcar rango de días en el calendario (mantener pulsado y arrastrar) o con el botón rápido **"Hoy estoy fuera"**.
- Equipo disponible por viaje: nada / mochila / mesa / gimnasio de hotel.
- Sustituciones:

| Sin… | Alternativa |
|---|---|
| Barra | Remo invertido bajo mesa, toalla en puerta |
| Mancuerna | Mochila con libros o botellas |
| Nada | Flexiones (variantes) + curl isométrico con toalla |
| Gym de hotel | Registro libre |

---

## 6. Registro y seguimiento

- **Registro al final de la sesión**, no serie a serie. Se precarga lo planificado y solo se corrigen las reps reales.
- **Sensación** obligatoria tras cada sesión: fácil / normal / dura.
- **Peso y medidas** semanales: peso corporal, cintura, brazo, pecho.
- **Fotos de progreso** (frente / lado / espalda), opcional y periódico.

### Pantallas de seguimiento
- Gráfica de evolución por ejercicio
- Récords personales, con aviso al batirlos
- Racha de días cumplidos (viaje y descanso no la rompen)
- Evolución de peso y medidas
- Galería de fotos con comparador antes/después
- Progreso hacia los objetivos e hitos

---

## 7. Calendario y recordatorios

- Vista calendario mensual: gimnasio, casa A/B/C, descanso, viaje, hecho/fallado.
- Marcar el día de gimnasio de la semana con un toque.
- **Recordatorios** ✅: hasta **3 avisos** el día de sesión en casa, por defecto a las **09:00, 10:00 y 12:00** (ajustables de media en media hora en Perfil y avisos). Se detienen al registrar la sesión o al pulsar **"Hoy no"**. Se programan los próximos 14 días y se recalculan al abrir la app.

---

## 8. Fichas de ejercicios

Cada ejercicio incluye:
- **Dibujo animado propio** (figura que va de la posición inicial a la final en bucle). Sin vídeos de YouTube: no son fiables.
- 3–4 claves de técnica
- Errores típicos

---

## 8b. Cuerpo: peso, medidas e indicadores

**Perfil**: altura, fecha de nacimiento, sexo y nivel de actividad.

**Medición** (semanal, por la mañana en ayunas): peso; medidas con cinta (cintura, cuello, cadera en mujeres, brazo, pecho); y, opcionalmente, los valores de la **Huawei Scale 3** copiados de Huawei Salud: % de grasa, músculo esquelético, masa libre de grasa, % de agua, % de proteína, masa ósea, grasa visceral, metabolismo basal, edad corporal y puntuación. ✅

Los valores de la báscula tienen su propio apartado de indicadores, con historial. Si se apuntan el % de grasa y la masa libre de grasa de la báscula, se usan en lugar de las fórmulas.

**Indicadores**, cada uno con su fórmula, rangos de referencia e historial con gráfica:

| Indicador | Fórmula | Rangos |
|---|---|---|
| IMC | peso ÷ altura² | <18,5 bajo · 18,5–25 normal · 25–30 sobrepeso · ≥30 obesidad |
| Cintura / altura | cintura ÷ altura | <0,4 muy bajo · 0,4–0,5 saludable · 0,5–0,6 riesgo aumentado · ≥0,6 alto |
| % de grasa | Marina EE. UU. (cintura, cuello, altura; cadera en mujeres) o báscula | H: <6 esencial · 6–14 atlético · 14–18 en forma · 18–25 medio · ≥25 alto |
| Masa magra | peso × (1 − % grasa) | — (tendencia) |
| FFMI normalizado | masa magra ÷ altura² + 6,1 × (1,8 − altura) | H: <18 bajo · 18–20 medio · 20–22 bueno · 22–23 excelente · ≥23 superior |
| Ritmo semanal | % de cambio de peso respecto a hace ~7 días | <−1 % demasiado rápido · −1 a −0,25 % ideal · ±0,25 % estable · >0,25 % subiendo |
| Metabolismo basal | Mifflin-St Jeor | — |
| Gasto diario | basal × factor de actividad | — |

**Recomendaciones derivadas**: calorías (gasto diario − 300 a 500 kcal) y proteína (1,6–2,2 g/kg).

Aviso en **Hoy** si han pasado más de 7 días sin pesarse.

### Pendiente: báscula Huawei
**Modelo del usuario: DBY-B19 = HUAWEI Scale 3 (Bluetooth).** Comprobado el 11/11/2026:

- **Bluetooth directo (vía openScale):** openScale lee la Scale 3 ([wiki](https://github.com/oliexdev/openScale/wiki/Supported-scales-in-openScale)), pero solo tras un *handshake* "Hagrid" con tres claves (CAK, C1, C2). openScale no las incluye ni explica cómo obtenerlas ([issue #1539](https://github.com/oliexdev/openScale/issues/1539)). Tampoco está claro si son iguales para todas las básculas. → **Descartado de momento**: sacar las claves supondría hacer ingeniería inversa de la app de Huawei. Además, su código es GPLv3.
- **Health Connect directo:** Huawei Salud no escribe en Health Connect de forma nativa (según fuentes de terceros, sin confirmación oficial).
- **Puente con una app de terceros — descartado:** *Health Sync* es de pago (prueba de una semana) y no queremos pagar. Funcionaría así: una app puente como *Health Sync* pasaría los datos de Huawei Salud a Health Connect, y Forja los leería con `react-native-health-connect`. Esto requiere *development build*. Falta confirmar si pasa el % de grasa además del peso.
- **Huawei Health Kit (API de Huawei) — descartado:** Huawei solo da acceso al peso y a los datos de salud a **empresas**; las cuentas individuales solo pueden leer actividad ([ejemplo de solicitud rechazada](https://github.com/ucsky/ha-huawei-health-kit)).
- **Decisión:** **registro manual** de todos los valores de la báscula ✅. Pendiente opcional: importar una vez la exportación de datos de la cuenta Huawei para cargar el historial.

---

## 9. Tecnología

| Aspecto | Decisión |
|---|---|
| Plataforma | Android (APK instalable, sin Play Store) |
| Framework | React Native + Expo (TypeScript), *development build* |
| Diseño | Tema oscuro, tarjetas, animaciones suaves, pensado para usar con una mano |
| Datos | SQLite local (funciona sin conexión) |
| Gráficas | Librería nativa de gráficas |
| Notificaciones | Locales programadas (expo-notifications) |
| Inicio de sesión | Google Sign-In |
| Copia | Google Drive, carpeta privada de la app (`appDataFolder`): copia automática semanal + manual y restauración |
| Código | https://github.com/Kelhusama/WorkoutApp |

Requisito externo: proyecto en Google Cloud Console con un cliente OAuth Android (SHA-1 del APK) y la Drive API habilitada.

---

## 10. Fases de implementación

1. **Núcleo**: datos, plan semanal, sesiones A/B/C, registro y sensación, progresión.
2. **Calendario**: vista semana/mes ✅, día de gimnasio ✅, fallos ✅ y modo viaje.
3. **Seguimiento**: peso, medidas e indicadores ✅; gráficas de ejercicios, récords, racha, fotos.
4. **Fichas**: dibujos animados ✅, técnica ✅.
5. **Recordatorios** ✅.
6. **Google**: inicio de sesión y copia en Drive.
7. **Báscula Huawei** (Scale 3, DBY-B19): registro manual de todos sus valores ✅; integración automática descartada (de pago o solo para empresas).

---

## Ideas pendientes (de apps libres en GitHub)

Revisadas: wger, Liftosaur, LiftLog (Expo/React Native), Flexify, FitoTrack, MyFit y openScale. Ordenadas por prioridad:

| # | Idea | Inspirada en | Esfuerzo |
|---|---|---|---|
| 1 | Temporizador de descanso entre series con vibración | Flexify, Liftosaur | Bajo |
| 2 | Repeticiones en reserva (RIR) por serie para afinar la progresión | MyFit | Bajo-medio |
| 3 | Récords por ejercicio (más reps, mejor 1RM, más volumen) con aviso | Flexify, Liftosaur | Medio |
| 4 | Volumen semanal por músculo (series de pecho y bíceps) frente a un objetivo de hipertrofia | Liftosaur | Medio |
| 5 | Series de calentamiento automáticas para la banca (% del peso de trabajo) | Liftosaur | Bajo |
| 6 | Calculadora de discos para la barra | Liftosaur | Bajo |
| 7 | Semana de descarga automática si se acumulan sesiones «dura» o se estanca la banca | Liftosaur | Medio |
| 8 | Sustituir un ejercicio por otro del mismo músculo (útil en viajes) | Liftosaur | Medio |
| 9 | Fotos de progreso con comparación antes/después | wger | Medio |
| 10 | Gráfica de rendimiento junto al peso corporal (p. ej. dominadas frente a kg) | Liftosaur | Medio |
| 11 | Registro rápido de cardio o pasos | FitoTrack, Flexify | Medio |
| 12 | Registro sencillo de calorías y proteína frente al objetivo | wger | Bajo (solo totales) / Alto (con base de alimentos) |
| 13 | Exportar e importar CSV/JSON | wger, Flexify | Bajo |
| 14 | Programas predefinidos («Camino a 10 dominadas», «50 flexiones») | Liftosaur | Medio |

## Debes (lo que tiene que hacer el usuario)

- [ ] **Capturas de Huawei Salud**: 1–2 capturas en español del detalle de una pesada, con todos los valores visibles. Si hace falta desplazarse, varias. Son necesarias para la lectura automática de capturas.
- [ ] **Cuenta gratuita de Expo** (expo.dev), para compilar el APK en la nube.
- [ ] **Nombre definitivo** de la app («Forja» es provisional).
- [ ] Confirmar si es viable hacer **press de banca 3×5 al final del gimnasio** cuando no toque.
- [ ] (Opcional) Pedir la **copia de datos de la cuenta Huawei** para importar el historial de peso.

## Pendientes de desarrollo (orden propuesto)

1. **Generar el APK** con EAS Build (development build). Es necesario para la lectura de capturas, los avisos puntuales al minuto y cualquier función nativa que no está en Expo Go.
2. **Leer captura de Huawei Salud**: botón «Leer captura» en *Registrar medición*. Eliges la imagen de la galería, el móvil lee el texto con ML Kit de Google (gratis, sin internet, la imagen no sale del teléfono) y se rellenan los campos de la báscula buscando cada valor por su nombre. El usuario revisa antes de guardar. Requiere el APK y capturas reales.
3. **Rediseñar los dibujos de los ejercicios con Fable**: sustituir las figuras de palitos por ilustraciones más vistosas, manteniendo la animación de inicio a fin y que el brazo que trabaja vaya resaltado. Usar el modelo Claude Fable 5.2 para el diseño.
4. **Modo viaje** (sección 5).
5. **Seguimiento de ejercicios**: gráficas por ejercicio, récords, racha y fotos de progreso.
6. **Copia en Google Drive** con inicio de sesión de Google (sección 9).
7. **Icono y pantalla de inicio** propios (ahora son los de la plantilla de Expo).
8. **Ideas de apps libres** (tabla anterior), empezando por el temporizador de descanso y el RIR por serie.
9. (Opcional) **Importar la exportación de Huawei** para cargar el historial de peso.

Restricción: **no usar servicios ni apps de pago**.

## Pendiente de confirmar
- Nombre definitivo de la app ("Forja" es provisional).
- Si es viable hacer press de banca 3×5 al final del gimnasio cuando no toque.
