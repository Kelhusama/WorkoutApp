# Requisitos — WorkoutApp (nombre provisional: "Forja")

App Android personal para seguir el rendimiento, ganar músculo (bíceps y pecho sobre todo), perder grasa y llegar a 10 dominadas. Combina 2 días de gimnasio con sesiones cortas en casa.

> Estado: en desarrollo · actualizado 11/11/2026

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

**Medición** (semanal, por la mañana en ayunas): peso, cintura, cuello, cadera (mujeres), brazo, pecho y, opcionalmente, % de grasa de una báscula.

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

### Pendiente: báscula Huawei por Bluetooth
Leer automáticamente peso y % de grasa de la báscula Huawei del usuario.
- Huawei no publica el protocolo Bluetooth de sus básculas; los datos van a la app Huawei Salud.
- **openScale** (app libre, GPLv3) ya lee varias básculas Huawei por BLE GATT ([wiki](https://github.com/oliexdev/openScale/wiki/Supported-scales-in-openScale), verificado 11/11/2026):
  - Honor Smart Scale CH100S: peso en vivo y composición corporal.
  - Huawei AH100 / CH100: peso en vivo; la composición corporal está sin descifrar.
  - HUAWEI Scale 2 Pro / Scale 3 / Scale 3 Pro: peso, composición e historial, pero solo responden tras un *handshake* "Hagrid" que necesita tres claves (CAK, C1, C2) de la báscula. Cómo obtenerlas: sin verificar.
- Alternativas: Health Connect de Android (si Huawei Salud exporta el peso) o Huawei Health Kit (HMS).
- Si se reutiliza código de openScale, su licencia GPLv3 obliga a publicar este proyecto con la misma licencia.
- Necesario: modelo exacto de la báscula. Requiere *development build* con `react-native-ble-plx` (Bluetooth no funciona en Expo Go).
- La base de datos ya guarda el origen de cada medición (`source`) y el % de grasa de báscula.

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
7. **Báscula Huawei** por Bluetooth (pendiente de investigar).

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

## Pendiente de confirmar
- Nombre definitivo de la app ("Forja" es provisional).
- Modelo exacto de la báscula Huawei.
- Si es viable hacer press de banca 3×5 al final del gimnasio cuando no toque.
