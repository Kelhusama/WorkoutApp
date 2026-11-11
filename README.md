# Forja (WorkoutApp)

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

**Fase 2 (parcial)** ✅
- Calendario con vista de semana y de mes
- Avisos de sesión en casa a las 9:00, 10:00 y 12:00 (ajustables)
- Semana tipo configurable y cambio de días sueltos
- Valores de la báscula Huawei Scale 3 (registro manual) con indicadores e historial
- Sección Cuerpo: perfil, peso y medidas, e indicadores (IMC, cintura/altura, % grasa, masa magra, FFMI, ritmo semanal, metabolismo basal, gasto diario) con rangos e historial

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
  illustrations/  dibujos animados de los ejercicios (figura con cinemática inversa)
  db/         SQLite: esquema y consultas
  hooks/      useWeek
  ui/         tema y componentes
```
