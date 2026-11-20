# Forja del Canario (WorkoutApp)

App Android personal para seguir el entrenamiento: 2 días de gimnasio + sesiones cortas en casa, con progresión automática hacia 10 dominadas, 50 flexiones y 80 kg en press de banca.

Requisitos completos en [docs/REQUISITOS.md](docs/REQUISITOS.md).

## Estado

**Fase 1 — núcleo** ✅
- Semana tipo configurable (1–4 días de gimnasio) y cambios de días sueltos; sesiones A/B/C repartidas solas
- Registro de sesiones al final, con sensación (fácil/normal/dura)
- Progresión automática: reps → tempo lento → pausa → series → variante
- Registro rápido de gimnasio con press de banca y 1RM estimado
- Objetivos con hitos y tests de máximo
- Dibujos animados propios de cada ejercicio, con claves de técnica y errores típicos

**Fase 2** ✅
- Calendario con vista de semana y de mes; semana tipo configurable y cambio de días sueltos
- Avisos de sesión en casa a las 9:00, 10:00 y 12:00 (ajustables)
- Sección Cuerpo: perfil, peso, medidas, valores de la báscula Huawei Scale 3 e indicadores con rangos e historial
- Modo viaje: sesiones adaptadas al material disponible; los días de viaje no cuentan como fallo
- Bloque de pierna en cada sesión de casa (tibial, gemelo, aductores, glúteo medio, muslo)
- Plan de marcha de 50 km por escalones, con registro de caminatas y gráficas
- Estiramientos guiados con cuenta atrás y voz, y minutos semanales por zona
- Seguimiento: ficha de cada ejercicio con récords y gráfica, racha, cumplimiento y fotos de progreso

Siguientes pasos y tareas pendientes: ver «Debes» y «Pendientes de desarrollo» en [docs/REQUISITOS.md](docs/REQUISITOS.md).

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm install
npm start          # abre Metro; escanea el QR con Expo Go en Android
npm test           # tests de la lógica y de la base de datos (SQLite de Node)
npm run typecheck
```

## Estructura

```
src/
  app/        pantallas (Expo Router)
  domain/     lógica pura: fechas, plan, ejercicios, progresión, objetivos, indicadores corporales
  illustrations/  dibujos animados: esqueleto con cinemática inversa (skeleton), formas puras (draw) y posturas (library)
  db/         SQLite: esquema y consultas
  hooks/      useWeek
  ui/         tema y componentes
```

## Probarla en el ordenador (navegador)

La app también se abre en un navegador, sin móvil. Sirve para revisar pantallas y flujos; no sirve para avisos, cámara ni vibración, que son del teléfono.

```bash
npx expo start --web
```

Usa su propia base de datos dentro del navegador: lo que apuntes ahí no llega al móvil. La configuración que lo permite está en `metro.config.js`.
