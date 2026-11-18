# FitTracker

Web estática para registrar comidas, peso y medidas en una recomposición corporal, usando **Google Sheets como base de datos**. No requiere instalar dependencias.

Archivos: `index.html` (estructura), `styles.css` (estilos), `app.js` (lógica) y `Code.gs` (backend en Apps Script).

## Empezar

Abre `index.html` en el navegador. Sin conexión a Sheets funciona en modo local: los cambios quedan en este navegador y se suben al conectar.

## Google Sheets

1. Crea una hoja de cálculo vacía en Google Sheets.
2. En **Extensiones > Apps Script**, pega `Code.gs`.
3. En **Configuración del proyecto > Propiedades de secuencia de comandos**, crea `FITTRACKER_SECRET` con una clave larga aleatoria.
4. (Opcional) Ejecuta `setup()` para crear las hojas; si no, se crean en la primera sincronización.
5. En **Implementar > Nueva implementación**, elige **Aplicación web**, ejecutar como **Yo**, acceso **Cualquier persona**. Copia la URL terminada en `/exec`.
6. En la web, pega la URL y la clave y pulsa **Guardar y conectar**.

Si actualizas `Code.gs`, crea una nueva versión en **Implementar > Gestionar implementaciones** para que la URL use el código nuevo.

## Estructura de la base de datos

Cada hoja es una tabla: la fila 1 tiene los encabezados y cada fila siguiente es un registro. Las columnas se buscan por nombre, así que puedes reordenarlas o añadir columnas propias (por ejemplo, fórmulas).

| Hoja | Clave | Columnas |
|------|-------|----------|
| `Registros` | `ID` | ID, Fecha (AAAA-MM-DD), Comida, AlimentoID, Alimento, Cantidad, Unidad, Kcal, Proteína (g), Carbohidratos (g), Grasas (g), Notas, CreadoEn, ActualizadoEn, Eliminado |
| `Alimentos` | `ID` | ID, Nombre, Unidad (`g` o `unidad`), Kcal, Proteína (g), Carbohidratos (g), Grasas (g), Activo, ActualizadoEn |
| `Peso` | `Fecha` | Fecha, Peso (kg), Cintura (cm), Grasa (%), Nota, ActualizadoEn, Eliminado |
| `Config` | `Clave` | Clave, Valor, Descripción |

- **Alimentos:** los valores son por 100 g si la unidad es `g`, o por unidad si es `unidad`. Puedes añadir alimentos desde la web o directamente en la hoja. `Activo = FALSE` oculta un alimento sin afectar los registros anteriores.
- **Registros:** guardan una copia de las kcal y macros del momento, así que editar un alimento no altera el historial.
- **Borrado lógico:** eliminar un registro o un peso marca `Eliminado = TRUE` y conserva la fila.
- **Config:** contiene `meta_kcal`, `meta_proteina`, `meta_carbohidratos`, `meta_grasas`, `altura_m`, `peso_inicial_kg` y `version_esquema` (no la edites).

## Sincronización

- Al abrir la web, primero sube los cambios pendientes y después descarga los datos de Sheets.
- Cada cambio se guarda en Sheets unos instantes después. Sin conexión queda pendiente en el navegador y se sube al reconectar o al pulsar **Sincronizar**.
- Si editas la hoja a mano, pulsa **Sincronizar** para ver los cambios en la web.
- Cada fila se actualiza por su clave (ID o Fecha), nunca se reescribe la hoja completa. Si dos dispositivos modifican el mismo registro, prevalece el último que se guarda.

**Migración desde v1:** los datos guardados en el navegador y las filas antiguas de `Registros` (sin ID) se convierten automáticamente con IDs `v1-<fecha>-<n>`, para no duplicarlos. Las kcal y macros de alimentos en gramos se recalculan, porque la v1 las guardaba 100 veces menores. En el navegador se conserva una copia en `fittracker-v1-respaldo`.

**Seguridad:** está pensado para uso personal. Cualquiera que tenga la URL y la clave puede leer y escribir en la hoja. No las compartas. Para una app multiusuario, usa un backend con OAuth.

**Nota:** los valores nutricionales son estimaciones; revisa etiquetas y porciones reales.
