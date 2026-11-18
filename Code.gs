// FitTracker · backend en Google Apps Script (Google Sheets como base de datos).
//
// 1. Crea una hoja de Google Sheets y abre Extensiones > Apps Script.
// 2. Pega este código. En Configuración del proyecto > Propiedades de secuencia
//    de comandos, crea FITTRACKER_SECRET con una clave larga y aleatoria.
// 3. (Opcional) Ejecuta la función setup() una vez para crear las hojas.
//    Si no lo haces, se crean solas en la primera sincronización.
// 4. Implementar > Nueva implementación > Aplicación web > Ejecutar como: Yo.
//    Acceso: Cualquier persona. Trata la URL y la clave como secretos.
//
// Cada hoja es una tabla: fila 1 = encabezados, cada fila siguiente = 1 registro.
// Las columnas se localizan por nombre de encabezado, así que puedes reordenarlas
// o añadir columnas propias (fórmulas, comentarios) sin romper nada.

const SCHEMA_VERSION = 2;
const MEALS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'];
const UNITS = ['g', 'unidad'];
const MAX_RECORDS_PER_REQUEST = 500;

const TABLES = {
  Alimentos: {
    key: 'id',
    text: ['id', 'updatedAt'],
    fields: [['id', 'ID'], ['name', 'Nombre'], ['unit', 'Unidad'], ['k', 'Kcal'], ['p', 'Proteína (g)'],
      ['c', 'Carbohidratos (g)'], ['f', 'Grasas (g)'], ['active', 'Activo'], ['updatedAt', 'ActualizadoEn']]
  },
  Registros: {
    key: 'id',
    text: ['id', 'date', 'foodId', 'createdAt', 'updatedAt'],
    fields: [['id', 'ID'], ['date', 'Fecha'], ['meal', 'Comida'], ['foodId', 'AlimentoID'], ['food', 'Alimento'],
      ['amount', 'Cantidad'], ['unit', 'Unidad'], ['k', 'Kcal'], ['p', 'Proteína (g)'], ['c', 'Carbohidratos (g)'],
      ['f', 'Grasas (g)'], ['notes', 'Notas'], ['createdAt', 'CreadoEn'], ['updatedAt', 'ActualizadoEn'],
      ['deleted', 'Eliminado']]
  },
  Peso: {
    key: 'date',
    text: ['date', 'updatedAt'],
    fields: [['date', 'Fecha'], ['weight', 'Peso (kg)'], ['waist', 'Cintura (cm)'], ['bodyFat', 'Grasa (%)'],
      ['note', 'Nota'], ['updatedAt', 'ActualizadoEn'], ['deleted', 'Eliminado']]
  },
  Config: {
    key: 'key',
    text: ['key'],
    fields: [['key', 'Clave'], ['value', 'Valor'], ['description', 'Descripción']]
  }
};

const NUMERIC = ['amount', 'k', 'p', 'c', 'f', 'weight', 'waist', 'bodyFat'];

// Valores de Kcal/macros: por 100 g si Unidad = g, por unidad si Unidad = unidad.
const DEFAULT_FOODS = [
  ['pollo-crudo', 'Pechuga de pollo cruda', 'g', 120, 23, 0, 2.6],
  ['arroz-cocido', 'Arroz blanco cocido', 'g', 130, 2.7, 28.2, 0.3],
  ['lentejas-cocidas', 'Lentejas sancochadas', 'g', 116, 9, 20.1, 0.4],
  ['avena-seca', 'Avena seca', 'g', 389, 16.9, 66.3, 6.9],
  ['huevo', 'Huevo entero', 'unidad', 72, 6.3, 0.4, 4.8],
  ['clara-huevo', 'Clara de huevo', 'unidad', 17, 3.6, 0.2, 0],
  ['pan-frances', 'Pan francés', 'g', 275, 9, 57, 1.5],
  ['platano-seda', 'Plátano de seda', 'g', 89, 1.1, 22.8, 0.3],
  ['atun-agua', 'Atún al agua escurrido', 'g', 116, 25.5, 0, 0.8],
  ['aceite-oliva', 'Aceite de oliva', 'g', 884, 0, 0, 100],
  ['verduras', 'Verduras variadas', 'g', 30, 2, 5, 0.3]
];

const DEFAULT_CONFIG = [
  ['meta_kcal', 2200, 'Meta diaria de calorías (kcal)'],
  ['meta_proteina', 160, 'Meta diaria de proteína (g)'],
  ['meta_carbohidratos', 220, 'Meta diaria de carbohidratos (g)'],
  ['meta_grasas', 73, 'Meta diaria de grasas (g)'],
  ['altura_m', 1.7, 'Altura en metros'],
  ['peso_inicial_kg', 87, 'Peso al iniciar el plan (kg)'],
  ['version_esquema', SCHEMA_VERSION, 'No editar: versión de la estructura de la hoja']
];

function doGet() {
  return ContentService.createTextOutput('FitTracker API OK');
}

function doPost(e) {
  let result;
  try {
    result = handle(e);
  } catch (err) {
    result = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  ensureSchema(SpreadsheetApp.getActiveSpreadsheet());
}

function handle(e) {
  const secret = PropertiesService.getScriptProperties().getProperty('FITTRACKER_SECRET');
  if (!secret) throw new Error('Falta configurar FITTRACKER_SECRET en Apps Script');
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (_) { throw new Error('JSON inválido'); }
  if (!req || req.secret !== secret) throw new Error('Clave incorrecta');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (req.action === 'load') return load(ss);
    if (req.action === 'upsert') return upsert(ss, req.table, req.records);
    throw new Error('Acción desconocida');
  } finally {
    lock.releaseLock();
  }
}

// ---------- Acceso a tablas ----------

function openTable(ss, name) {
  const def = TABLES[name];
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const lastCol = sh.getLastColumn();
  let headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  if (headers.every(h => !h)) headers = [];

  const missing = def.fields.map(f => f[1]).filter(h => headers.indexOf(h) === -1);
  if (missing.length) {
    sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }

  const col = {};
  def.fields.forEach(([field, header]) => { col[field] = headers.indexOf(header); });
  if (missing.length) {
    // Texto plano para que Sheets no convierta fechas/IDs a otros tipos.
    def.text.forEach(field => sh.getRange(1, col[field] + 1, sh.getMaxRows(), 1).setNumberFormat('@'));
  }

  const lastRow = sh.getLastRow();
  const values = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, headers.length).getValues() : [];
  return { name, def, sh, headers, col, values };
}

function normalize(field, v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return field === 'date'
      ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : v.toISOString();
  }
  if (field === 'deleted') return v === true || String(v).toUpperCase() === 'TRUE';
  if (field === 'active') return !(v === false || String(v).toUpperCase() === 'FALSE');
  if (NUMERIC.indexOf(field) !== -1) return v === '' || v === null ? null : Number(v);
  return v;
}

function toObj(t, row) {
  const o = {};
  t.def.fields.forEach(([field]) => { o[field] = normalize(field, row[t.col[field]]); });
  return o;
}

function fromObj(t, obj, existing) {
  const row = existing ? existing.slice() : new Array(t.headers.length).fill('');
  Object.keys(obj).forEach(field => {
    const i = t.col[field];
    if (i === undefined || i < 0) return;
    const v = obj[field];
    row[i] = v === null || v === undefined ? '' : v;
  });
  return row;
}

function keyOf(t, row) {
  return String(normalize(t.def.key, row[t.col[t.def.key]]) || '');
}

// ---------- Esquema, datos iniciales y migración ----------

function ensureSchema(ss) {
  const foods = openTable(ss, 'Alimentos');
  if (!foods.values.length) {
    const now = new Date().toISOString();
    const rows = DEFAULT_FOODS.map(([id, name, unit, k, p, c, f]) =>
      fromObj(foods, { id, name, unit, k, p, c, f, active: true, updatedAt: now }));
    foods.sh.getRange(2, 1, rows.length, foods.headers.length).setValues(rows);
    foods.values = rows;
  }

  const config = openTable(ss, 'Config');
  const existingKeys = config.values.map(r => keyOf(config, r));
  const newConfig = DEFAULT_CONFIG.filter(([key]) => existingKeys.indexOf(key) === -1)
    .map(([key, value, description]) => fromObj(config, { key, value, description }));
  if (newConfig.length) {
    config.sh.getRange(config.values.length + 2, 1, newConfig.length, config.headers.length).setValues(newConfig);
    config.values = config.values.concat(newConfig);
  }

  const registros = openTable(ss, 'Registros');
  migrateLegacyEntries(registros, foods);

  return { Alimentos: foods, Config: config, Registros: registros, Peso: openTable(ss, 'Peso') };
}

// Filas creadas por la versión 1 (sin ID). Sus kcal/macros en gramos estaban
// mal calculados (100 veces menores), así que se recalculan con el catálogo.
function migrateLegacyEntries(registros, foods) {
  const byName = {};
  foods.values.forEach(r => { const f = toObj(foods, r); byName[f.name] = f; });
  const perDate = {};
  const now = new Date().toISOString();
  let changed = false;

  registros.values.forEach((row, i) => {
    const e = toObj(registros, row);
    if (e.id || !e.date) return;
    perDate[e.date] = (perDate[e.date] === undefined ? -1 : perDate[e.date]) + 1;
    // Mismo formato de ID que usa la web al migrar localStorage, para no duplicar.
    const update = { id: 'v1-' + e.date + '-' + perDate[e.date], date: e.date, createdAt: now, updatedAt: now, deleted: false };
    const food = byName[e.food];
    if (food && e.amount > 0) {
      const factor = food.unit === 'unidad' ? e.amount : e.amount / 100;
      Object.assign(update, { foodId: food.id, unit: food.unit });
      ['k', 'p', 'c', 'f'].forEach(m => { update[m] = Math.round(food[m] * factor * 10) / 10; });
    }
    registros.values[i] = fromObj(registros, update, row);
    changed = true;
  });

  if (changed) {
    registros.sh.getRange(2, 1, registros.values.length, registros.headers.length).setValues(registros.values);
  }
}

// ---------- Acciones ----------

function load(ss) {
  const t = ensureSchema(ss);
  const config = {};
  t.Config.values.forEach(r => { const o = toObj(t.Config, r); if (o.key) config[o.key] = o.value; });
  return {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    foods: t.Alimentos.values.map(r => toObj(t.Alimentos, r)).filter(f => f.id && f.name),
    entries: t.Registros.values.map(r => toObj(t.Registros, r)).filter(e => e.id && e.date && !e.deleted),
    weights: t.Peso.values.map(r => toObj(t.Peso, r)).filter(w => w.date && w.weight && !w.deleted),
    config
  };
}

function upsert(ss, name, records) {
  if (!TABLES[name]) throw new Error('Tabla desconocida: ' + name);
  if (!Array.isArray(records) || records.length > MAX_RECORDS_PER_REQUEST) throw new Error('Registros inválidos');

  const t = openTable(ss, name);
  const index = {};
  t.values.forEach((row, i) => { const k = keyOf(t, row); if (k) index[k] = i; });
  const appends = {};
  let updated = 0;

  records.forEach(raw => {
    const obj = sanitize(name, raw);
    const key = String(obj[t.def.key]);
    if (index[key] !== undefined) {
      const i = index[key];
      const row = fromObj(t, obj, t.values[i]);
      t.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
      t.values[i] = row;
      updated++;
    } else {
      if (name === 'Registros') obj.createdAt = obj.updatedAt;
      appends[key] = fromObj(t, obj, appends[key]);
    }
  });

  const rows = Object.keys(appends).map(k => appends[k]);
  if (rows.length) t.sh.getRange(t.values.length + 2, 1, rows.length, t.headers.length).setValues(rows);
  return { ok: true, inserted: rows.length, updated };
}

// ---------- Validación ----------

function text(v, max) {
  let s = String(v === null || v === undefined ? '' : v).trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // evita que el texto se interprete como fórmula
  return s;
}

function num(v, label, min, max, required) {
  if (v === '' || v === null || v === undefined) {
    if (required) throw new Error(label + ' es obligatorio');
    return null;
  }
  const n = Number(v);
  if (!isFinite(n) || n < min || n > max) throw new Error(label + ' fuera de rango');
  return Math.round(n * 100) / 100;
}

function isoDate(v) {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Fecha inválida: ' + s);
  return s;
}

function id(v) {
  const s = String(v || '');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(s)) throw new Error('ID inválido');
  return s;
}

function sanitize(name, r) {
  if (!r || typeof r !== 'object') throw new Error('Registro inválido');
  const now = new Date().toISOString();
  if (name === 'Registros') {
    if (MEALS.indexOf(r.meal) === -1) throw new Error('Comida inválida');
    if (UNITS.indexOf(r.unit) === -1) throw new Error('Unidad inválida');
    return {
      id: id(r.id), date: isoDate(r.date), meal: r.meal, foodId: text(r.foodId, 64), food: text(r.food),
      amount: num(r.amount, 'Cantidad', 0.01, 100000, true), unit: r.unit,
      k: num(r.k, 'Kcal', 0, 100000, true), p: num(r.p, 'Proteína', 0, 10000, true),
      c: num(r.c, 'Carbohidratos', 0, 10000, true), f: num(r.f, 'Grasas', 0, 10000, true),
      notes: text(r.notes), updatedAt: now, deleted: r.deleted === true
    };
  }
  if (name === 'Alimentos') {
    if (UNITS.indexOf(r.unit) === -1) throw new Error('Unidad inválida');
    const nameText = text(r.name, 100);
    if (!nameText) throw new Error('Nombre obligatorio');
    return {
      id: id(r.id), name: nameText, unit: r.unit,
      k: num(r.k, 'Kcal', 0, 10000, true), p: num(r.p, 'Proteína', 0, 1000, true),
      c: num(r.c, 'Carbohidratos', 0, 1000, true), f: num(r.f, 'Grasas', 0, 1000, true),
      active: r.active !== false, updatedAt: now
    };
  }
  if (name === 'Peso') {
    return {
      date: isoDate(r.date), weight: num(r.weight, 'Peso', 20, 400, true), waist: num(r.waist, 'Cintura', 0, 300),
      bodyFat: num(r.bodyFat, 'Grasa corporal', 0, 80), note: text(r.note), updatedAt: now, deleted: r.deleted === true
    };
  }
  // Config
  const key = String(r.key || '');
  if (!/^[a-z0-9_]{1,50}$/.test(key) || key === 'version_esquema') throw new Error('Clave de configuración inválida');
  const value = typeof r.value === 'number' ? num(r.value, key, -1e9, 1e9, true) : text(r.value);
  return { key, value };
}
