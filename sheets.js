'use strict';

// Acceso a Google Sheets desde el navegador con la cuenta de Google del usuario.
// Usa el permiso drive.file: la app solo ve las hojas que ella misma creó.

const GSheets = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
  const DRIVE = 'https://www.googleapis.com/drive/v3';
  const TOKEN_KEY = 'fittracker-token';
  const APP_PROP = "appProperties has { key='fittracker' and value='1' }";

  // Cada hoja es una tabla. Las columnas se localizan por el nombre del encabezado.
  const TABLES = {
    Alimentos: {
      key: 'id',
      fields: [['id', 'ID'], ['name', 'Nombre'], ['unit', 'Unidad'], ['k', 'Kcal'], ['p', 'Proteína (g)'],
        ['c', 'Carbohidratos (g)'], ['f', 'Grasas (g)'], ['active', 'Activo'], ['updatedAt', 'ActualizadoEn'],
        ['fiber', 'Fibra (g)'], ['sugar', 'Azúcares (g)'], ['source', 'Fuente']]
    },
    Registros: {
      key: 'id',
      fields: [['id', 'ID'], ['date', 'Fecha'], ['meal', 'Comida'], ['foodId', 'AlimentoID'], ['food', 'Alimento'],
        ['amount', 'Cantidad'], ['unit', 'Unidad'], ['k', 'Kcal'], ['p', 'Proteína (g)'], ['c', 'Carbohidratos (g)'],
        ['f', 'Grasas (g)'], ['notes', 'Notas'], ['createdAt', 'CreadoEn'], ['updatedAt', 'ActualizadoEn'],
        ['deleted', 'Eliminado'], ['fiber', 'Fibra (g)'], ['sugar', 'Azúcares (g)']]
    },
    Peso: {
      key: 'date',
      fields: [['date', 'Fecha'], ['weight', 'Peso (kg)'], ['waist', 'Cintura (cm)'], ['bodyFat', 'Grasa (%)'],
        ['note', 'Nota'], ['updatedAt', 'ActualizadoEn'], ['deleted', 'Eliminado']]
    },
    Rutina: {
      key: 'id',
      fields: [['id', 'ID'], ['session', 'Sesión'], ['day', 'Día'], ['order', 'Orden'], ['name', 'Ejercicio'],
        ['muscle', 'Músculo'], ['sets', 'Series'], ['repsMin', 'Reps mín'], ['repsMax', 'Reps máx'],
        ['rirTarget', 'RIR objetivo'], ['warmup', 'Aproximación'], ['notes', 'Descanso / Técnica'],
        ['active', 'Activo'], ['updatedAt', 'ActualizadoEn']]
    },
    Series: {
      key: 'id',
      fields: [['id', 'ID'], ['date', 'Fecha'], ['session', 'Sesión'], ['exerciseId', 'EjercicioID'],
        ['exercise', 'Ejercicio'], ['setNo', 'Serie'], ['weight', 'Peso (kg)'], ['reps', 'Reps'], ['rir', 'RIR'],
        ['notes', 'Notas'], ['createdAt', 'CreadoEn'], ['updatedAt', 'ActualizadoEn'], ['deleted', 'Eliminado']]
    },
    Config: {
      key: 'key',
      fields: [['key', 'Clave'], ['value', 'Valor'], ['description', 'Descripción']]
    }
  };
  const NUMERIC = new Set(['amount', 'k', 'p', 'c', 'f', 'fiber', 'sugar', 'weight', 'waist', 'bodyFat', 'order', 'sets', 'repsMin',
    'repsMax', 'setNo', 'reps', 'rir']);
  const DATE_FIELDS = new Set(['date']);

  let clientId = '';
  let tokenClient = null;
  let token = null;
  let expiresAt = 0;
  const structureChecked = new Set();

  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    if (saved && saved.expiresAt > Date.now() + 60000) ({ token, expiresAt } = saved);
  } catch { /* sin token guardado */ }

  class AuthError extends Error {}

  // ---------- Autenticación ----------

  function waitForGis() {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      (function check() {
        if (window.google?.accounts?.oauth2) return resolve();
        if (Date.now() - started > 10000) return reject(new Error('no se pudo cargar el inicio de sesión de Google'));
        setTimeout(check, 100);
      })();
    });
  }

  // Debe llamarse desde un clic del usuario: Google abre una ventana emergente.
  async function signIn(loginHint) {
    if (!clientId) throw new Error('falta configurar googleClientId en config.js');
    await waitForGis();
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: () => {} });
    }
    return new Promise((resolve, reject) => {
      tokenClient.callback = resp => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        if (!google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) {
          return reject(new Error('debes permitir el acceso a las hojas creadas por FitTracker'));
        }
        token = resp.access_token;
        expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
        resolve();
      };
      tokenClient.error_callback = err => reject(new Error(err?.type === 'popup_closed' ? 'se cerró la ventana de Google' : (err?.message || 'inicio de sesión cancelado')));
      tokenClient.requestAccessToken({ prompt: '', login_hint: loginHint || undefined });
    });
  }

  function signOut() {
    if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {});
    token = null;
    expiresAt = 0;
    sessionStorage.removeItem(TOKEN_KEY);
    structureChecked.clear();
  }

  const hasToken = () => Boolean(token && Date.now() < expiresAt - 60000);

  async function request(url, options = {}) {
    if (!hasToken()) throw new AuthError('la sesión de Google caducó');
    const res = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    if (res.status === 401) {
      token = null;
      sessionStorage.removeItem(TOKEN_KEY);
      throw new AuthError('la sesión de Google caducó');
    }
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `error ${res.status} de Google`);
    return data;
  }

  // ---------- Hoja de cálculo ----------

  const quote = title => `'${title.replace(/'/g, "''")}'`;
  function colLetter(i) {
    let s = '';
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  }
  const headersOf = name => TABLES[name].fields.map(f => f[1]);

  const getUser = () => request(`${DRIVE}/about?fields=user(emailAddress,displayName)`).then(d => ({
    email: d.user.emailAddress, name: d.user.displayName
  }));

  async function findSpreadsheet() {
    const q = encodeURIComponent(`${APP_PROP} and trashed=false and mimeType='application/vnd.google-apps.spreadsheet'`);
    const data = await request(`${DRIVE}/files?q=${q}&orderBy=createdTime&fields=files(id,name)&spaces=drive`);
    return data.files?.[0]?.id || null;
  }

  async function createSpreadsheet(title) {
    const file = await request(`${DRIVE}/files?fields=id`, {
      method: 'POST',
      body: JSON.stringify({ name: title, mimeType: 'application/vnd.google-apps.spreadsheet', appProperties: { fittracker: '1' } })
    });
    await ensureStructure(file.id, true);
    return file.id;
  }

  // Crea las hojas y encabezados que falten sin tocar las columnas propias del usuario.
  async function ensureStructure(id, removeOthers) {
    if (structureChecked.has(id)) return;
    const meta = await request(`${SHEETS}/${id}?fields=sheets.properties(sheetId,title)`);
    const existing = meta.sheets.map(s => s.properties);
    const titles = existing.map(p => p.title);
    const requests = [];
    Object.keys(TABLES).filter(t => !titles.includes(t)).forEach(title => {
      requests.push({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } });
    });
    if (removeOthers) existing.filter(p => !TABLES[p.title]).forEach(p => requests.push({ deleteSheet: { sheetId: p.sheetId } }));
    if (requests.length) await request(`${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });

    const ranges = Object.keys(TABLES).map(t => `ranges=${encodeURIComponent(quote(t) + '!1:1')}`).join('&');
    const heads = await request(`${SHEETS}/${id}/values:batchGet?${ranges}`);
    const data = [];
    Object.keys(TABLES).forEach((t, i) => {
      const current = (heads.valueRanges[i].values?.[0] || []).map(String);
      const missing = headersOf(t).filter(h => !current.includes(h));
      if (missing.length) {
        data.push({ range: `${quote(t)}!${colLetter(current.length)}1`, values: [missing] });
      }
    });
    if (data.length) {
      await request(`${SHEETS}/${id}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) });
    }
    structureChecked.add(id);
  }

  function serialToDate(n) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
    return d.toISOString().slice(0, 10);
  }

  function normalize(field, v) {
    if (field === 'deleted') return v === true || String(v).toUpperCase() === 'TRUE';
    if (field === 'active') return !(v === false || String(v).toUpperCase() === 'FALSE');
    if (DATE_FIELDS.has(field) && typeof v === 'number') return serialToDate(v);
    if (NUMERIC.has(field)) return v === '' || v == null ? null : Number(v);
    return v == null ? '' : v;
  }

  function parseTable(name, values) {
    const headers = (values[0] || []).map(String);
    const col = Object.fromEntries(TABLES[name].fields.map(([f, h]) => [f, headers.indexOf(h)]));
    const rows = values.slice(1).map(row => Object.fromEntries(
      TABLES[name].fields.map(([f]) => [f, normalize(f, col[f] >= 0 ? row[col[f]] : '')])
    ));
    return { headers, col, rows };
  }

  async function readTables(id, names) {
    const ranges = names.map(t => `ranges=${encodeURIComponent(quote(t))}`).join('&');
    const res = await request(`${SHEETS}/${id}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE`);
    return Object.fromEntries(names.map((t, i) => [t, parseTable(t, res.valueRanges[i].values || [])]));
  }

  const cell = v => (v === null || v === undefined ? '' : v);

  // Inserta o actualiza filas por su clave. Se relee la hoja antes de escribir para
  // localizar las filas aunque el usuario la haya ordenado o editado a mano.
  async function upsert(id, name, records) {
    if (!records.length) return;
    await ensureStructure(id);
    const t = (await readTables(id, [name]))[name];
    const key = TABLES[name].key;
    const rowOf = {};
    t.rows.forEach((r, i) => { if (r[key] !== '' && r[key] != null) rowOf[String(r[key])] = i + 2; });
    const known = TABLES[name].fields.map(([f]) => [f, t.col[f]]).filter(([, c]) => c >= 0).sort((a, b) => a[1] - b[1]);

    const data = [];
    const appends = [];
    records.forEach(rec => {
      const row = rowOf[String(rec[key])];
      if (row) {
        // Solo se escriben las columnas propias, agrupadas en tramos contiguos.
        let run = [];
        const pushRun = () => {
          if (!run.length) return;
          data.push({ range: `${quote(name)}!${colLetter(run[0][1])}${row}:${colLetter(run[run.length - 1][1])}${row}`, values: [run.map(([f]) => cell(rec[f]))] });
          run = [];
        };
        known.forEach(k => {
          if (!(k[0] in rec)) { pushRun(); return; }
          if (run.length && run[run.length - 1][1] !== k[1] - 1) pushRun();
          run.push(k);
        });
        pushRun();
      } else {
        const full = new Array(t.headers.length).fill('');
        const withCreated = 'createdAt' in t.col && !rec.createdAt ? { ...rec, createdAt: rec.updatedAt || new Date().toISOString() } : rec;
        known.forEach(([f, c]) => { full[c] = cell(withCreated[f]); });
        appends.push(full);
      }
    });

    if (data.length) {
      await request(`${SHEETS}/${id}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) });
    }
    if (appends.length) {
      const range = encodeURIComponent(`${quote(name)}!A1`);
      await request(`${SHEETS}/${id}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', body: JSON.stringify({ values: appends })
      });
    }
  }

  // Lee todo. Si una tabla de catálogo está vacía, la rellena con los valores iniciales.
  async function load(id, seeds) {
    await ensureStructure(id);
    let t = await readTables(id, Object.keys(TABLES));
    let seeded = false;
    for (const name of ['Alimentos', 'Rutina']) {
      if (!t[name].rows.some(r => r.id) && seeds[name]?.length) { await upsert(id, name, seeds[name]); seeded = true; }
    }
    const keys = new Set(t.Config.rows.map(r => String(r.key)));
    const missingConfig = (seeds.Config || []).filter(r => !keys.has(r.key));
    if (missingConfig.length) { await upsert(id, 'Config', missingConfig); seeded = true; }
    if (seeded) t = await readTables(id, Object.keys(TABLES));

    const config = {};
    t.Config.rows.forEach(r => { if (r.key) config[r.key] = typeof r.value === 'string' && r.value !== '' && !isNaN(r.value) ? Number(r.value) : r.value; });
    return {
      foods: t.Alimentos.rows.filter(f => f.id && f.name).map(f => ({ ...f, id: String(f.id) })),
      entries: t.Registros.rows.filter(e => e.id && e.date && !e.deleted).map(e => ({ ...e, id: String(e.id) })),
      weights: t.Peso.rows.filter(w => w.date && w.weight && !w.deleted),
      routine: t.Rutina.rows.filter(x => x.id && x.name && x.session).map(x => ({ ...x, id: String(x.id) })),
      sets: t.Series.rows.filter(x => x.id && x.date && x.exerciseId && !x.deleted).map(x => ({ ...x, id: String(x.id) })),
      config
    };
  }

  const sheetUrl = id => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/edit`;

  return {
    init: id => { clientId = id || ''; },
    isConfigured: () => Boolean(clientId),
    signIn, signOut, hasToken, getUser, findSpreadsheet, createSpreadsheet, load, upsert, sheetUrl, AuthError
  };
})();
