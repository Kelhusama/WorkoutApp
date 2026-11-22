# Dónde viven los datos y cómo se protegen

Estado a 22 de noviembre de 2026. Objetivo: **no perder nunca el avance**, ni por un fallo de la app, ni por una actualización, ni por cambiar de móvil.

## 1. Dónde está cada cosa

| Qué | Dónde | Quién lo ve |
|---|---|---|
| Sesiones, series, mediciones, plan de la prueba, ajustes | Una base de datos SQLite (`forja.db`) dentro de la app, en el móvil | Solo ese móvil |
| Fotos de progreso | Archivos en la carpeta de la app (`fotos/`) | Solo ese móvil |
| Copias automáticas | Archivos JSON en la carpeta de la app (`copias/`) | Solo ese móvil |
| Copia exportada a mano | Donde el usuario la envíe (Google Drive, correo…) | Quien tenga ese archivo |
| El código | GitHub (`Kelhusama/WorkoutApp`) | No contiene ningún dato personal |

**No hay servidor ni cuenta.** La app no envía nada a ningún sitio. Es lo más privado y no cuesta nada, pero implica que **hoy el móvil es el único sitio donde están los datos**.

Mientras se use con Expo Go, la base de datos vive dentro de Expo Go: si se desinstala Expo Go o se borran sus datos, se pierde. Y al pasar a la app instalada (APK) se empieza con una base vacía: hay que exportar antes y restaurar después.

## 2. Qué puede salir mal y qué lo cubre

| Riesgo | Cobertura actual | ¿Suficiente? |
|---|---|---|
| Una actualización de la app estropea la base de datos | Cada paso de migración es atómico y hay copia automática justo antes | Sí |
| Un error de la app borra o corrompe datos | Copia automática diaria dentro del móvil (últimas 7) | Sí, hasta 7 días atrás |
| Se restaura una copia rota | La restauración es todo o nada: si falla, no cambia nada | Sí |
| Se pierde, se rompe o se cambia el móvil | Solo la copia exportada a mano, con aviso semanal | **A medias: depende de acordarse** |
| Se desinstala la app o Expo Go | Igual que el anterior | **A medias** |
| Se pierden las fotos de progreso | Nada: no entran en ninguna copia | **No** |

Lo que falta para cerrar los tres últimos es la copia automática en Google Drive (apartado 5).

## 3. Migraciones de la base de datos

Cada cambio de estructura es un paso numerado en `src/db/schema.ts`. La base guarda en qué paso va (`PRAGMA user_version`).

Garantías, comprobadas con tests (`src/db/migrate.test.ts`):

1. **Cada paso es atómico.** Va en una transacción junto con su número de versión. Si falla a mitad (móvil sin espacio, app cerrada de golpe), se deshace entero y la base queda como antes de ese paso.
2. **Se reanuda donde se quedó.** Al volver a abrir la app continúa desde el paso pendiente; los ya hechos no se repiten.
3. **Repetir un paso no rompe nada.** Las tablas se crean solo si no existen y las columnas se añaden solo si faltan. Está probado pasando todos los pasos otra vez sobre una base al día, y arrancando desde cada versión anterior.
4. **Migrar nunca borra datos.** Los pasos solo añaden tablas y columnas. El único que rehace una tabla (los cambios por día) copia antes sus filas.
5. **Una base más nueva que la app no se toca.** Si se instalara una versión antigua de la app sobre datos nuevos, no los degrada.
6. **Copia previa.** Antes de actualizar una base que ya tiene datos se guarda una copia tal como estaba (`copias/forja-auto-FECHA-antes-vN.json`). Si guardar la copia falla, la actualización sigue: no debe bloquear la app.

Regla para pasos futuros: solo añadir. Si alguna vez hay que quitar o renombrar algo, se hace en dos versiones (primero se deja de usar, mucho después se elimina), nunca en una.

## 4. Copias de seguridad

**Formato**: un único archivo JSON con todas las tablas y la versión del esquema. Es legible y no depende de la app.

**Restaurar** (`importBackup`):
- Todo o nada, en una transacción.
- Acepta copias antiguas: las tablas o columnas que no existían entonces quedan vacías.
- Ignora columnas que no reconoce.
- Rechaza copias de una versión más nueva que la app, en vez de cargarlas a medias.

**Tres niveles**:
1. **Automática diaria**, dentro del móvil, las últimas 7. Se hace sola al abrir la app.
2. **Automática antes de cada actualización** de la base de datos.
3. **Manual, fuera del móvil**: *Perfil y avisos → Exportar copia*. Abre el menú de compartir de Android; eligiendo Google Drive el archivo queda en la nube sin necesidad de iniciar sesión en la app. La pantalla Hoy avisa si hay datos y hace más de 7 días de la última.

Las dos primeras se restauran desde *Perfil y avisos → Volver a la última copia automática*.

Límite conocido: la app marca la copia manual como hecha al abrir el menú de compartir; no puede saber si luego se guardó de verdad.

## 5. Google: inicio de sesión y Drive

**Por qué no se ve en la app**: está programado, pero en una rama aparte (`google-drive`) que no se ha fusionado. El inicio de sesión con Google usa código nativo que **no funciona dentro de Expo Go**; solo en la app instalada (APK). Fusionarlo ahora rompería la app en Expo Go.

**Qué hace esa rama**: inicia sesión con la cuenta de Google y guarda la copia en una carpeta privada de Drive reservada a la app (el usuario no la ve mezclada con sus archivos y la app no puede leer nada más de su Drive).

**Qué falta, por orden**:
1. Cuenta gratuita de Expo, para generar el APK.
2. Proyecto en Google Cloud (gratuito) con la pantalla de consentimiento y las credenciales de Android. Los pasos están en `docs/GOOGLE.md`, dentro de esa rama.
3. Poner la rama al día: se creó antes de muchos cambios de hoy.
4. Probarla en el APK y fusionarla.
5. Hacerla automática: copia a Drive al cerrar una sesión, y restauración al instalar en un móvil nuevo.
6. Incluir las fotos de progreso.

**Riesgo de esa vía**: mientras la app esté «en pruebas» en Google Cloud, el permiso caduca cada 7 días y hay que volver a iniciar sesión. Para evitarlo hay que publicar la pantalla de consentimiento, que para este permiso no requiere revisión de Google (pendiente de confirmar al hacerlo).

Hasta entonces, el nivel 3 (exportar a Drive a mano cada semana) es lo que protege de perder el móvil.
