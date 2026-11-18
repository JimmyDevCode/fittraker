# FitTracker

Web estática para registrar comidas de lunes a domingo, con 2,200 kcal y 160 g de proteína como metas. No requiere instalar dependencias.

## Empezar

Abre `index.html` en el navegador. Registra tus alimentos y usa el resumen semanal. Los datos se guardan en localStorage de ese navegador. Puedes exportarlos a CSV.

## Google Sheets

1. Crea una hoja de cálculo vacía en Google Sheets.
2. En **Extensiones > Apps Script**, pega `Code.gs`.
3. En **Configuración del proyecto > Propiedades de secuencia de comandos**, crea `FITTRACKER_SECRET` con una clave larga aleatoria.
4. En **Implementar > Nueva implementación**, elige **Aplicación web**, ejecutar como **Yo**, acceso **Cualquier persona**. Copia la URL terminada en `/exec`.
5. En la web, pega la URL y la clave, guarda ambas y pulsa **Sincronizar Sheets**.
6. Comprueba la pestaña `Registros` en Google Sheets.

**Seguridad:** Esta integración es para uso personal. Apps Script con acceso público acepta solicitudes de cualquiera que conozca la URL; la clave compartida agrega una barrera, pero queda guardada en el navegador y no sustituye autenticación. No compartas la URL ni la clave. No incluyas datos sensibles. Para publicar una app multiusuario, usa un backend con OAuth y acceso restringido.

**Limitación:** La sincronización actual es de ida (web → Sheets) y reemplaza el contenido de la pestaña `Registros` con el historial local. No importa datos de Sheets al navegador. Debido a restricciones CORS de Apps Script, la web no puede verificar automáticamente la respuesta del servidor; confirma en la hoja.

**Nota:** Los valores de alimentos son estimaciones nutricionales; revisa etiquetas y porciones reales. Los datos semanales se agrupan de lunes a domingo de la semana actual.


## Calendario (v2)
Selecciona cualquier fecha desde el calendario mensual. Usa las flechas para navegar entre meses y Hoy para volver a la fecha actual. Cada registro se almacena bajo su fecha ISO (AAAA-MM-DD), por lo que los registros de semanas anteriores permanecen disponibles. El resumen semanal corresponde a la semana de la fecha seleccionada. Los datos existentes de la versión anterior siguen siendo compatibles.
