# FitTracker

Web estática para registrar comidas, entrenamientos, peso y medidas en una recomposición corporal, usando **Google Sheets como base de datos**. No requiere instalar dependencias.

Cada persona inicia sesión con su cuenta de Google y sus datos se guardan en una hoja **FitTracker** de **su propio Google Drive**. No hay servidor: la web habla directamente con las APIs de Google.

Archivos: `index.html` (estructura), `styles.css` (estilos), `app.js` (lógica), `sheets.js` (login y acceso a Google Sheets/Drive), `config.js` (Client ID de Google), `manifest.webmanifest` + `sw.js` + `icons/` (PWA).

## Configurar Google (una sola vez, gratis)

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto (ej. `FitTracker`).
2. En **APIs y servicios > Biblioteca**, habilita **Google Sheets API** y **Google Drive API**.
3. En **APIs y servicios > Pantalla de consentimiento de OAuth** (Google Auth Platform):
   - Tipo de usuario: **Externo**.
   - Nombre de la app, correo de soporte y correo del desarrollador.
   - Permisos (scopes): añade `.../auth/drive.file`.
   - **Usuarios de prueba:** añade el correo de cada persona que vaya a usar la app (máx. 100 mientras esté en modo prueba).
4. En **APIs y servicios > Credenciales > Crear credenciales > ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **Orígenes de JavaScript autorizados:** `https://fittraker-blush.vercel.app` y `http://localhost:8080` (sin `/` final).
5. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) en `config.js`. No es secreto: Google solo lo acepta desde los orígenes autorizados.

## Publicar

Está desplegada en Vercel: `https://fittraker-blush.vercel.app`. Al importar el repo, usa el preset **Other**, sin comando de build ni directorio de salida. Cada push a `main` se publica solo.

El login con Google solo funciona en la URL de producción; las URLs de preview de Vercel no están autorizadas en Google Cloud.

Para probar en local (Google no acepta `file://`):

```bash
python3 -m http.server 8080
```

y abre `http://localhost:8080`.

## Instalar como app (PWA)

- **Android (Chrome):** menú ⋮ → **Instalar app** / **Agregar a pantalla principal**.
- **iPhone (Safari):** botón Compartir → **Agregar a pantalla de inicio**.

Se abre a pantalla completa y carga sin conexión. El service worker pide siempre la última versión cuando hay internet, así que cada deploy llega solo. Si cambias la lista de archivos, sube la versión de `CACHE` en `sw.js`.

## Uso

- La primera vez se muestra una bienvenida con **Continuar con Google** o **Probar sin cuenta**. En modo local, un aviso arriba recuerda que los datos están solo en ese navegador.
- Cada sección muestra un tip la primera vez; desaparece al tocar **Entendido**.

- Pulsa **Continuar con Google** en el panel **☁️ Cuenta de Google**. La primera vez se crea la hoja `FitTracker` en tu Drive con todas las pestañas, los alimentos y la rutina iniciales. En otros dispositivos se reutiliza la misma hoja.
- La app solo puede ver los archivos que ella misma crea (`drive.file`); no tiene acceso al resto de tu Drive.
- Sin sesión, funciona en modo local: los datos quedan solo en este navegador. Al iniciar sesión por primera vez te ofrece subirlos a tu hoja.
- Google entrega sesiones de 1 hora. Cuando caduca, los cambios se guardan en el navegador y se suben al pulsar **Sincronizar** o **Reconectar**.
- Cada cuenta tiene su propia copia local, así que en el mismo navegador pueden alternar varias personas con **Cerrar sesión**.

## Estructura de la base de datos

Cada hoja es una tabla: la fila 1 tiene los encabezados y cada fila siguiente es un registro. Las columnas se buscan por nombre, así que puedes reordenarlas o añadir columnas propias (por ejemplo, fórmulas).

| Hoja | Clave | Columnas |
|------|-------|----------|
| `Registros` | `ID` | ID, Fecha (AAAA-MM-DD), Comida, AlimentoID, Alimento, Cantidad, Unidad, Kcal, Proteína (g), Carbohidratos (g), Grasas (g), Notas, CreadoEn, ActualizadoEn, Eliminado, Fibra (g), Azúcares (g) |
| `Alimentos` | `ID` | ID, Nombre, Unidad (`g` o `unidad`), Kcal, Proteína (g), Carbohidratos (g), Grasas (g), Activo, ActualizadoEn, Fibra (g), Azúcares (g), Fuente |
| `Peso` | `Fecha` | Fecha, Peso (kg), Cintura (cm), Grasa (%), Nota, ActualizadoEn, Eliminado |
| `Rutina` | `ID` | ID, Sesión, Día, Orden, Ejercicio, Músculo, Series, Reps mín, Reps máx, RIR objetivo, Aproximación, Descanso / Técnica, Activo, ActualizadoEn |
| `Series` | `ID` | ID, Fecha, Sesión, EjercicioID, Ejercicio, Serie, Peso (kg), Reps, RIR, Notas, CreadoEn, ActualizadoEn, Eliminado |
| `Config` | `Clave` | Clave, Valor, Descripción |

- **Alimentos:** los valores son por 100 g si la unidad es `g`, o por unidad si es `unidad`. Puedes añadir alimentos desde la web o directamente en la hoja. El botón 🗑 elimina un alimento marcando `Activo = FALSE` (la fila no se borra para no romper la sincronización entre dispositivos); los registros anteriores se conservan y puedes recuperarlo desde **🗑 Eliminados**.
- **Fibra y azúcares:** opcionales y sin meta. Se suman en el día solo para los alimentos que tienen el dato; el resto cuenta como "sin dato". El azúcar es parte de los carbohidratos, no se suma aparte.
- **Tabla Peruana:** en **🥗 Alimentos** puedes buscar entre los 1 125 alimentos de las *Tablas Peruanas de Composición de Alimentos* (INS/CENAN, `data/tabla-peruana.json`) y agregarlos con un toque (`Fuente = Tabla Peruana INS · <código>`). La tabla trae fibra pero no azúcares; complétalos desde la etiqueta si te interesan.
- **Editar alimentos:** con ✎ en la lista cambias nombre o valores. Al guardar te pregunta si quieres recalcular también los registros anteriores de ese alimento (si no, conservan los valores con que se registraron).
- **Registros:** guardan una copia de las kcal y macros del momento, así que editar un alimento no altera el historial.
- **Rutina:** se crea con la rutina PPL + Torso/Pierna. Edítala en la hoja (ejercicios, series, rango de reps) y pulsa **Sincronizar**. `Activo = FALSE` quita un ejercicio. `Aproximación` usa el formato `50%×8 · 80%×3-4` (% del peso efectivo × reps) y la web calcula los kilos redondeando a 2.5 kg. Para añadir una sesión nueva, usa un nombre nuevo en `Sesión`.
- **Series:** una fila por serie efectiva. La web sugiere la sesión según la semana (la primera que aún no hiciste), muestra lo que hiciste la última vez y aplica doble progresión: si todas las series llegaron al tope del rango de reps, sugiere subir 2.5 kg; si no, mantener el peso y sumar reps.
- **Borrado lógico:** eliminar un registro, una serie o un peso marca `Eliminado = TRUE` y conserva la fila.
- **Config:** contiene `meta_kcal`, `meta_proteina`, `meta_carbohidratos`, `meta_grasas`, `altura_m`, `peso_inicial_kg` y `meta_sesiones_semana`.
- **Rachas:** entreno = semanas seguidas (lunes a domingo) con al menos `meta_sesiones_semana` días entrenados, sin importar qué día; proteína = días seguidos llegando a `meta_proteina`. La semana o el día en curso no rompen la racha hasta que terminan.

## Sincronización

- Al abrir la web (con sesión activa), primero sube los cambios pendientes y después descarga los datos de Sheets.
- Cada cambio se guarda en Sheets unos instantes después. Sin conexión queda pendiente en el navegador y se sube al reconectar o al pulsar **Sincronizar**.
- Si editas la hoja a mano, pulsa **Sincronizar** para ver los cambios en la web.
- Cada fila se actualiza por su clave (ID o Fecha), nunca se reescribe la hoja completa. Si dos dispositivos modifican el mismo registro, prevalece el último que se guarda.

**Migración desde la versión con Apps Script:** la app ya no usa `Code.gs`. Abre la web en el navegador donde la usabas, inicia sesión y acepta subir los datos locales: se copian a tu nueva hoja. La hoja antigua queda intacta como respaldo.

**Privacidad:** cada usuario solo accede a su propia hoja. El token de Google se guarda en `sessionStorage` y se descarta al cerrar la pestaña o la sesión.

**Nota:** los valores nutricionales son estimaciones; revisa etiquetas y porciones reales.
