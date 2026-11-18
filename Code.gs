// 1. Crea una hoja de Google Sheets y abre Extensiones > Apps Script.
// 2. Pega este código. En Configuración del proyecto > Propiedades de secuencia
//    de comandos, crea FITTRACKER_SECRET con una clave larga y aleatoria.
// 3. Implementar > Nueva implementación > Aplicación web > Ejecutar como: Yo.
//    Acceso: Cualquier persona (necesario para llamadas directas desde esta web).
//    Trata la URL y la clave como secretos; para uso público usa OAuth.
function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('FITTRACKER_SECRET');
  if (!secret) return ContentService.createTextOutput('Not configured');
  let data;
  try { data = JSON.parse(e.postData.contents); } catch (_) { return ContentService.createTextOutput('Invalid JSON'); }
  if (data.secret !== secret) return ContentService.createTextOutput('Unauthorized');
  if (!Array.isArray(data.records) || data.records.length > 5000) return ContentService.createTextOutput('Invalid records');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Registros') || ss.insertSheet('Registros');
  const headers = ['Fecha','Comida','Alimento','Cantidad','Unidad','Kcal','Proteína (g)','Carbohidratos (g)','Grasas (g)'];
  const rows = data.records.map(r => [r.date,r.meal,r.food,Number(r.amount),r.unit,Number(r.k),Number(r.p),Number(r.c),Number(r.f)]);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    sh.clearContents(); sh.getRange(1,1,1,headers.length).setValues([headers]);
    if (rows.length) sh.getRange(2,1,rows.length,headers.length).setValues(rows);
    sh.setFrozenRows(1);
  } finally { lock.releaseLock(); }
  return ContentService.createTextOutput('OK: '+rows.length);
}
