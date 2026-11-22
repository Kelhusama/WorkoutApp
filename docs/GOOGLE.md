# Google: inicio de sesión y copia en Drive

Estado (16/11/2026): **código escrito y probado en el ordenador; sin probar en un móvil**. Para usarlo hacen falta tres cosas que solo puede hacer el usuario: el proyecto de Google Cloud, el APK instalado (no funciona en Expo Go) y pegar un ID en `app.json`. Al final se detalla qué queda sin verificar.

## 1. Qué hay hecho y cómo funciona

En **Perfil y avisos → Tus datos** hay una tarjeta nueva, «Copia en Google Drive», debajo de la copia en archivo (que sigue igual).

| Estado | Qué muestra |
|---|---|
| Expo Go (sin módulo nativo) | «Disponible en la app instalada». Nada más; la app sigue funcionando igual. |
| App instalada sin configurar | Aviso de que falta el ID de cliente web en `app.json`. |
| Sin sesión | Botón **Iniciar sesión con Google**. |
| Con sesión | Correo de la cuenta, fecha de la última copia, **Guardar copia en Drive**, **Restaurar desde Drive** (pide confirmación: sustituye todos los datos) y **Cerrar sesión**. |

- **Dónde se guarda**: un único archivo, `forja-copia.json`, en la carpeta privada de la app en Drive (`appDataFolder`). No aparece en tu Drive ni la ven otras apps, y la app no puede ver el resto de tu Drive: el único permiso que pide es `https://www.googleapis.com/auth/drive.appdata`. Cada copia sustituye a la anterior. Contiene lo mismo que «Exportar copia» (sin fotos).
- **Copia semanal automática**: al abrir la app o al volver a ella, si hay sesión y la última copia tiene 7 días o más, se guarda otra en silencio. Si falla (sin internet…), no avisa y lo reintenta la siguiente vez.
- **Protecciones para no pisar una copia buena** (pensadas para el cambio de móvil):
  - La copia automática nunca se hace con la app vacía.
  - En una instalación nueva, la automática no empieza hasta que guardes o restaures una copia a mano desde ese móvil.
  - Si al iniciar sesión ya hay una copia en Drive y ese móvil no ha guardado ninguna, «Guardar copia en Drive» pregunta antes de sustituirla.
  - Si al iniciar sesión no hay ninguna copia en Drive y la app tiene datos, se guarda la primera sin preguntar.
- **Sin servidor y sin coste**: la app habla directamente con Google. No hay ninguna clave secreta en el repositorio; el ID de cliente no es un secreto.

### Librería elegida

`react-native-nitro-google-signin` (licencia MIT, gratis) con `react-native-nitro-modules`.

- La [guía de Expo](https://docs.expo.dev/guides/google-authentication/) dice que el SDK antiguo de Google Sign-In para Android está obsoleto y que Google recomienda **Credential Manager**. De las dos librerías que cita, esta lo incluye gratis; `@react-native-google-signin/google-signin` solo lo ofrece en su versión de pago (la gratuita usa el SDK obsoleto).
- `expo-auth-session` abriría el navegador y la guía de Expo para Google no lo menciona; solo cita las dos librerías nativas.
- Riesgo asumido: es una librería joven (junio de 2026, ~160.000 descargas semanales frente a 1,8 millones de la otra) y su tabla de compatibilidad publicada llega a React Native 0.87; la app usa 0.88. Todo el uso está aislado en `src/google/auth.ts`, así que cambiarla por la otra tocaría un solo archivo.
- **No está en `plugins` de `app.json` a propósito**: su plugin de configuración solo hace cosas para iOS o Firebase y, sin esos datos, da error y rompería `expo start`. En Android sin Firebase no hace falta; el módulo nativo se enlaza solo al compilar (comprobado con el autoenlazado de Expo, no con una compilación real).

### Archivos

| Archivo | Qué hace |
|---|---|
| `src/google/drive.ts` | Llamadas REST a Drive (buscar, crear, sustituir, descargar). Recibe `fetch` y el token. |
| `src/google/driveBackup.ts` | Copia y restauración con `exportBackup`/`parseBackup`, reintento al caducar el token y la decisión «¿toca copia semanal?». |
| `src/google/errors.ts`, `config.ts` | Mensajes de error en español y lectura del ID de cliente. |
| `src/google/drive.test.ts` | 12 pruebas con un Drive simulado. |
| `src/google/auth.ts` | Único archivo que usa la librería nativa; la carga solo si existe. |
| `src/google/sync.ts`, `DriveAutoBackup.tsx` | Unen lo anterior con la base de datos; copia automática. |
| `src/ui/DriveBackupCard.tsx` | La tarjeta de Perfil. |
| `eas.json` | Perfil `preview` para generar el APK. |

## 2. Lo que tienes que hacer en Google Cloud

Todo es gratis y no pide tarjeta. Los nombres de menú son los de la documentación de Google a 16/11/2026; la consola puede mostrarlos en español. Cada paso indica si está **[verificado]** contra la documentación actual o **[sin verificar]**.

Necesitas antes la **huella SHA-1** del APK, así que haz primero el apartado 3 hasta tener el primer APK (o al menos el almacén de claves creado) y vuelve aquí.

1. **Crear el proyecto.** Entra en <https://console.cloud.google.com> con tu cuenta de Google, abre el selector de proyectos de la barra superior y elige **Proyecto nuevo**; nombre, por ejemplo, «Forja». **[sin verificar]** el texto exacto de los botones.
2. **Activar la API de Drive.** Menú **APIs y servicios → Biblioteca → Google Workspace → Google Drive API → Habilitar**. **[verificado]** ([guía](https://developers.google.com/workspace/guides/enable-apis))
3. **Pantalla de consentimiento.** Menú **Google Auth Platform → Branding → Comenzar** ([guía](https://developers.google.com/workspace/guides/configure-oauth-consent)): **[verificado]**
   1. *Información de la app*: nombre («Forja») y tu correo como correo de asistencia.
   2. *Público*: **Externo**.
   3. *Información de contacto*: tu correo.
   4. *Finalizar*: aceptar la política de datos y **Crear**.
   5. En **Público (Audience) → Usuarios de prueba → Añadir usuarios**, añade tu propia cuenta de Google y guarda. El estado de publicación queda en **Prueba (Testing)**.
   6. En **Acceso a los datos (Data Access) → Añadir o quitar permisos**, añade `https://www.googleapis.com/auth/drive.appdata` (si no sale en la lista, pégalo en el cuadro de permisos manuales) y guarda. Google lo clasifica como permiso **no sensible**. **[verificado]** el menú; **[sin verificar]** que sea imprescindible declararlo aquí para que funcione.
4. **Cliente OAuth de Android.** Menú **Google Auth Platform → Clientes → Crear cliente → Tipo de aplicación: Android** ([guía](https://developers.google.com/workspace/guides/create-credentials)): **[verificado]**
   - *Nombre*: el que quieras (solo se ve en la consola).
   - *Nombre del paquete*: `com.kelhusama.forja` (es `android.package` de `app.json`).
   - *Huella digital del certificado SHA-1*: la del apartado 3.
   - **Crear**. Este ID **no se pega en ningún sitio**; solo tiene que existir en el mismo proyecto.
5. **Cliente OAuth web.** En **Clientes → Crear cliente → Tipo de aplicación: Aplicación web**, ponle un nombre y **Crear** sin rellenar orígenes ni URIs de redirección. **[verificado]** los pasos; la necesidad de este cliente sale de la librería: Credential Manager exige el ID de un cliente *web* aunque la app sea de Android, y usar aquí el de Android da el error `DEVELOPER_ERROR`.
6. **Pegar el ID.** Copia el ID del cliente **web** (acaba en `.apps.googleusercontent.com`) en `app.json`:

   ```json
   "extra": {
     "google": {
       "webClientId": "PEGA_AQUI_EL_ID_DEL_CLIENTE_WEB.apps.googleusercontent.com"
     }
   }
   ```

   Es el único dato que hay que pegar. Después hay que **volver a generar el APK** (apartado 3): `app.json` va dentro de la app.

### Aviso importante: el modo «Prueba» caduca cada 7 días

Con la pantalla de consentimiento en **Prueba**, Google hace caducar la autorización de los usuarios de prueba **a los siete días** cuando la app pide algo más que nombre y correo ([documentación](https://support.google.com/cloud/answer/15549945)) **[verificado]**. En la práctica: cada semana la app volvería a pedirte el permiso o mostraría «La sesión de Google ha caducado», y la copia semanal automática podría no hacerse.

Para evitarlo, cuando compruebes que todo funciona, pulsa **Publicar la app** en **Público (Audience)** para pasar a **En producción**. Como el único permiso es no sensible, no debería exigir la verificación de Google ni tener coste. **[sin verificar]**: no he podido confirmar en la documentación que publicar con solo este permiso no pida ningún trámite, ni cómo se comporta exactamente la caducidad con el sistema de autorización de Android.

## 3. Generar el APK con EAS (cuenta gratuita de Expo)

No se puede probar en Expo Go: hace falta una app instalada que lleve el código nativo de Google. Pasos ([guía de EAS](https://docs.expo.dev/build/setup/), [APK](https://docs.expo.dev/build-reference/apk/)):

```sh
npm install --global eas-cli     # una vez
eas login                        # cuenta gratuita de expo.dev
eas build -p android --profile preview
```

- La primera vez pregunta si crea el proyecto en tu cuenta de Expo (añade `extra.eas.projectId` a `app.json`) y si genera un **almacén de claves (keystore) de Android nuevo**: di que sí a ambas. EAS guarda la clave y la reutiliza en las siguientes compilaciones, así que la huella SHA-1 no cambia. **[verificado]** que se genera y se reutiliza; **[sin verificar]** el texto exacto de las preguntas.
- El perfil `preview` de `eas.json` produce un **APK** instalable (`distribution: internal`, `buildType: apk`) **[verificado]**. Al terminar da un enlace: ábrelo en el móvil e instala el APK.
- Es una app independiente con el código dentro: para ver cambios posteriores hay que compilar otra vez. Para el día a día puedes seguir usando Expo Go (todo menos Drive).
- Si prefieres una *development build* (se conecta al servidor de desarrollo como Expo Go), hay que instalar antes `npx expo install expo-dev-client` y añadir un perfil con `"developmentClient": true`. No lo he añadido para no cambiar más cosas sin poder probarlas.
- El plan gratuito de Expo tiene un número limitado de compilaciones al mes y cola de espera; la documentación consultada no da la cifra. **[sin verificar]**

**Huella SHA-1** (para el paso 4 del apartado 2):

```sh
eas credentials
```

Elige **Android** y el perfil `preview`: muestra el almacén de claves con su **SHA1 Fingerprint**. La [documentación de la otra librería](https://react-native-google-signin.github.io/docs/setting-up/get-config-file) confirma que `eas credentials` muestra la SHA-1 **[verificado]**; el recorrido exacto del menú está **[sin verificar]**.

Orden práctico: compilar una vez (crea la clave) → `eas credentials` → apartado 2 completo → pegar el ID web en `app.json` → compilar de nuevo → instalar y probar.

## 4. Si algo falla

| Lo que ves | Causa probable |
|---|---|
| «Google no reconoce esta app…» (`DEVELOPER_ERROR`) | SHA-1 o nombre de paquete mal en el cliente de Android, clientes en proyectos distintos, o se pegó el ID de Android en vez del web. |
| Eliges la cuenta y no pasa nada («Inicio de sesión cancelado») | Lo mismo: con una configuración incorrecta, Google a veces solo cierra el diálogo. Revisa la SHA-1. |
| «Acceso bloqueado» en la pantalla de Google | Tu cuenta no está en **Usuarios de prueba**. |
| «Google Drive ha rechazado la petición… (accessNotConfigured)» | La API de Drive no está habilitada en el proyecto. |
| «La sesión de Google ha caducado» cada semana | El modo Prueba (ver el aviso del apartado 2). |
| La tarjeta dice «Disponible en la app instalada» en el APK | El APK es anterior a este cambio; vuelve a compilar. |

## 5. Qué NO está verificado

Comprobado en el ordenador: `npx tsc --noEmit`, `npm test` (100 pruebas, 12 nuevas), `npx expo export --platform android`, `npx expo-doctor` y que el autoenlazado de Android detecta los dos módulos nativos.

Sin comprobar, porque requiere un móvil, el APK y credenciales reales:

1. Que el proyecto **compila en EAS** con `react-native-nitro-google-signin` 2.3.1 y React Native 0.88 (la librería declara compatibilidad hasta 0.87).
2. Que la app **sigue arrancando en Expo Go**. El código no carga la librería si falta el módulo nativo y el paquete de JavaScript se genera bien, pero no se ha abierto en Expo Go tras el cambio.
3. Todo el **flujo real de Google**: selector de cuentas, pantalla del permiso de Drive, obtención y renovación del token, cierre de sesión.
4. Las **llamadas reales a Drive**. Están probadas contra un Drive simulado escrito a partir de la documentación (subida multipart, `appDataFolder`, `alt=media`), no contra Google.
5. La **copia automática** en el móvil (al abrir y al volver a primer plano) y qué ocurre si Google necesita volver a pedir permiso en ese momento.
6. El aspecto de la tarjeta en pantalla.
7. Los pasos de consola marcados **[sin verificar]** y el `eas.json` (escrito a mano según la documentación; no se ha ejecutado `eas build`).

## Probarlo en el navegador, sin APK (22/11/2026)

La copia en Drive se puede probar en el ordenador antes de tener la app instalada. Todo lo que habla con Drive es común; solo cambia el inicio de sesión (`src/google/auth.web.ts`, que Metro usa en lugar de `auth.ts` al compilar para web).

**Qué se prueba así**: guardar la copia en Drive, restaurarla, las protecciones para no pisar una copia buena y los mensajes de error. **Qué no**: el inicio de sesión de Android, que solo existe en el APK.

**Diferencias con el móvil**: el permiso dura una hora y no se renueva solo (hay que volver a iniciar sesión), y se guarda solo mientras la pestaña esté abierta.

### Lo que hay que crear en Google Cloud (gratis, sin tarjeta)

1. Entrar en <https://console.cloud.google.com> con la cuenta de Google y crear un proyecto («Forja del Canario»).
2. **APIs y servicios → Biblioteca → Google Drive API → Habilitar.**
3. **Google Auth Platform → Branding → Comenzar**: nombre de la app, correo de asistencia, público **Externo**, correo de contacto, aceptar y crear.
4. **Público (Audience) → Usuarios de prueba → Añadir usuarios**: la propia cuenta de Google.
5. **Clientes (Clients) → Crear cliente → Aplicación web**, con:
   - Orígenes de JavaScript autorizados: `http://localhost:8099`
   - URI de redireccionamiento autorizados: `http://localhost:8099/perfil`
6. Copiar el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pegarlo en `app.json`, en `expo.extra.google.webClientId`. No es un secreto. El «secreto de cliente» que Google muestra al lado **no hace falta y no debe copiarse a ningún sitio**.

Ese mismo ID de cliente web es el que usará después la app de Android, así que el trabajo no se repite.

### Probar

1. Estar en la rama `google-drive-web` y ejecutar `npx expo start --web --port 8099`.
2. Abrir <http://localhost:8099/perfil>, bajar hasta «Copia en Google Drive» y pulsar **Iniciar sesión con Google**.
3. Google avisará de que la app no está verificada (es normal en modo de prueba): **Configuración avanzada → Ir a la app**. Aceptar el permiso de Drive.
4. De vuelta en Perfil, **Guardar copia en Drive** y luego **Restaurar desde Drive**.

**Sin verificar**: no se ha podido probar el inicio de sesión real porque aún no existe el ID de cliente. Los nombres de los menús de Google Cloud pueden haber cambiado.
