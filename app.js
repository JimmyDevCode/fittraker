'use strict';

const STORE_KEY = 'fittracker-v2';
const LEGACY_KEY = 'fittracker-v1';
const STORE_PREFIX = 'fittracker-v3:';
const ACCOUNT_KEY = 'fittracker-account';
const LOCAL_MODE_KEY = 'fittracker-local-mode';
const TIPS_KEY = 'fittracker-tips-vistos';
const MEALS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'];
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TABLES = ['Alimentos', 'Config', 'Registros', 'Peso', 'Rutina', 'Series'];
const KEY_FIELD = { Alimentos: 'id', Registros: 'id', Peso: 'date', Config: 'key', Rutina: 'id', Series: 'id' };
const MACROS = [
  { id: 'k', label: 'Calorías', unit: 'kcal', goal: 'meta_kcal' },
  { id: 'p', label: 'Proteína', unit: 'g', goal: 'meta_proteina' },
  { id: 'c', label: 'Carbohidratos', unit: 'g', goal: 'meta_carbohidratos' },
  { id: 'f', label: 'Grasas', unit: 'g', goal: 'meta_grasas' }
];
// Opcionales y sin meta: solo se suman si el alimento tiene el dato.
const EXTRAS = [
  { id: 'fiber', label: 'Fibra', icon: '🌾' },
  { id: 'sugar', label: 'Azúcares', icon: '🍬' }
];
const CONFIG_FIELDS = ['meta_kcal', 'meta_proteina', 'meta_carbohidratos', 'meta_grasas', 'altura_m', 'peso_inicial_kg', 'meta_sesiones_semana'];
const DEFAULT_CONFIG = { meta_kcal: 2200, meta_proteina: 160, meta_carbohidratos: 220, meta_grasas: 73, altura_m: 1.7, peso_inicial_kg: 87, meta_sesiones_semana: 4 };
const CONFIG_DESCRIPTIONS = {
  meta_kcal: 'Meta diaria de calorías (kcal)',
  meta_proteina: 'Meta diaria de proteína (g)',
  meta_carbohidratos: 'Meta diaria de carbohidratos (g)',
  meta_grasas: 'Meta diaria de grasas (g)',
  altura_m: 'Altura en metros',
  peso_inicial_kg: 'Peso al iniciar el plan (kg)',
  meta_sesiones_semana: 'Sesiones de entreno por semana para mantener la racha'
};

// El orden importa para migrar los datos de la v1 (guardaban el índice del alimento).
// Valores por 100 g (unidad "g") o por unidad (unidad "unidad").
const DEFAULT_FOODS = [
  ['pollo-crudo', 'Pechuga de pollo cruda', 'g', 120, 23, 0, 2.6],
  ['arroz-cocido', 'Arroz blanco cocido', 'g', 130, 2.7, 28.2, 0.3],
  ['lentejas-cocidas', 'Lentejas sancochadas', 'g', 116, 9, 20.1, 0.4],
  ['avena-seca', 'Avena seca', 'g', 389, 16.9, 66.3, 6.9],
  ['huevo', 'Huevo entero', 'unidad', 72, 6.3, 0.4, 4.8],
  ['clara-huevo', 'Clara de huevo', 'unidad', 17, 3.6, 0.2, 0],
  ['pan-frances', 'Pan francés', 'g', 277, 8.4, 62.9, 0.2],
  ['platano-seda', 'Plátano de seda', 'g', 74, 1.5, 21, 0.3],
  ['atun-agua', 'Atún al agua escurrido', 'g', 116, 25.5, 0, 0.8],
  ['aceite-oliva', 'Aceite de oliva', 'g', 884, 0, 0, 100],
  ['verduras', 'Verduras variadas', 'g', 30, 2, 5, 0.3]
].map(([id, name, unit, k, p, c, f]) => ({ id, name, unit, k, p, c, f, active: true }));

// Rutina inicial: se copia a la hoja Rutina al crearla y luego se edita allí.
const DEFAULT_ROUTINE = [
  ['push-press-plano', 'Push', 'Lunes', 1, 'Press de pecho plano (Máquina o Banca)', 'Pecho', 3, 6, 8, '1–2', '50%×8 · 80%×3-4', '2–3 min | Pesado y controlado (2 seg al bajar).'],
  ['push-press-inclinado', 'Push', 'Lunes', 2, 'Press inclinado en máquina', 'Pecho', 3, 6, 8, '1–2', '75%×4', '2–3 min | Enfoque en pecho superior.'],
  ['push-peck-deck', 'Push', 'Lunes', 3, 'Peck deck (Aperturas en máquina)', 'Pecho', 2, 8, 10, '0–1', '', '90 seg | Pausa de 1 segundo atrás donde el pecho se estira al máximo.'],
  ['push-laterales', 'Push', 'Lunes', 4, 'Elevaciones laterales con mancuernas', 'Hombro Lateral', 3, 10, 12, '1', '50%×10', '90 seg | Estricto sin columpiar el torso.'],
  ['push-triceps-polea', 'Push', 'Lunes', 5, 'Extensión de tríceps en polea (barra o cuerda)', 'Tríceps', 4, 8, 10, '1', '60%×6-8', '90 seg | Codos fijos a las costillas.'],
  ['pull-jalon-prono', 'Pull', 'Martes', 1, 'Jalón al pecho (Agarre prono medio)', 'Espalda', 3, 6, 8, '1–2', '50%×8 · 80%×3-4', '2–3 min | Barra a la clavícula tirando desde los codos, sin columpiarte.'],
  ['pull-remo-apoyado', 'Pull', 'Martes', 2, 'Remo con pecho apoyado (Máquina o Banco)', 'Espalda', 3, 6, 8, '1–2', '75%×4', '2–3 min | Cero estrés lumbar.'],
  ['pull-remo-polea', 'Pull', 'Martes', 3, 'Remo sentado en polea (Agarre neutro)', 'Espalda', 2, 8, 10, '1–2', '', '2 min | Estira los hombros adelante y tracciona hacia la cadera.'],
  ['pull-peck-inverso', 'Pull', 'Martes', 4, 'Peck deck inverso (o Pájaros)', 'Hombro Posterior', 3, 10, 12, '1', '', '90 seg | Brazos casi rectos, sin juntar escápulas.'],
  ['pull-curl', 'Pull', 'Martes', 5, 'Curl de bíceps con mancuernas (o Barra Z)', 'Bíceps', 2, 8, 10, '1', '60%×6', '90 seg | Supina la muñeca al subir; codos pegados.'],
  ['pull-martillo', 'Pull', 'Martes', 6, 'Curl martillo con mancuernas', 'Bíceps', 2, 8, 10, '1', '', '90 seg | Agarre neutro.'],
  ['piernaa-abduccion', 'Pierna A', 'Miércoles', 1, 'Abducción de cadera en máquina', 'Glúteo / Cadera', 3, 10, 12, '1', '50%×10', '90 seg | Activa el glúteo medio para evitar valgo en prensa.'],
  ['piernaa-femoral', 'Pierna A', 'Miércoles', 2, 'Curl femoral sentado', 'Isquiotibiales', 3, 8, 10, '1–2', '60%×8', '2 min | Lubrica la rodilla y activa isquios.'],
  ['piernaa-prensa', 'Pierna A', 'Miércoles', 3, 'Prensa de piernas 45° (Bilateral)', 'Cuádriceps', 3, 6, 8, '1–2', '50%×8 · 80%×4', '3 min | [ANTI-HOFFITIS] Pies de la mitad hacia arriba. PROHIBIDO bloquear rodillas.'],
  ['piernaa-prensa-1p', 'Pierna A', 'Miércoles', 4, 'Prensa a 1 pierna (Unilateral)', 'Cuádriceps', 2, 8, 10, '1–2', '', '2 min | Reps por pierna. Rodilla alineada con el 2do dedo del pie.'],
  ['piernaa-extension', 'Pierna A', 'Miércoles', 5, 'Extensión de cuádriceps (Rango protegido)', 'Cuádriceps', 3, 8, 10, '1', '50%×6', '90 seg | [ANTI-HOFFITIS] Detente a 20° de estirar del todo. Pausa 2 s.'],
  ['piernaa-pantorrilla', 'Pierna A', 'Miércoles', 6, 'Pantorrillas sentado (o con micro-flexión)', 'Pantorrillas', 2, 10, 12, '1', '', '90 seg | Pausa de 2 seg abajo. No trabes las rodillas.'],
  ['torso-press', 'Torso', 'Jueves', 1, 'Press inclinado o plano en máquina', 'Pecho', 3, 6, 8, '1–2', '50%×8 · 80%×3-4', '2–3 min | Máxima intención y carga pesada.'],
  ['torso-jalon-neutro', 'Torso', 'Jueves', 2, 'Jalón al pecho (Agarre neutro o cerrado)', 'Espalda', 3, 6, 8, '1–2', '50%×8 · 80%×3-4', '2–3 min | 2 aproximaciones rápidas para activar dorsales.'],
  ['torso-remo-abierto', 'Torso', 'Jueves', 3, 'Remo sentado en máquina (Agarre abierto)', 'Espalda', 3, 8, 10, '1–2', '', '2 min | Codos a ~45°–60° del torso.'],
  ['torso-laterales', 'Torso', 'Jueves', 4, 'Elevaciones laterales (Mancuerna o Polea)', 'Hombro Lateral', 3, 10, 12, '1', '', '90 seg | Controla la bajada.'],
  ['torso-curl', 'Torso', 'Jueves', 5, 'Curl de bíceps (Predicador o Polea baja)', 'Bíceps', 3, 8, 10, '1', '60%×6', '90 seg | Puedes hacerlo en superserie con el tríceps.'],
  ['torso-triceps-nuca', 'Torso', 'Jueves', 6, 'Extensión de tríceps tras nuca (Polea o Manc.)', 'Tríceps', 3, 8, 10, '1', '60%×6', '90 seg | Estira al máximo la cabeza larga.'],
  ['piernab-rdl', 'Pierna B', 'Viernes', 1, 'Peso muerto rumano (Barra o Mancuernas)', 'Isquiotibiales', 3, 6, 8, '2', '50%×8 · 80%×4', '3 min | [ANTI-HOFFITIS] Micro-flexión fija (15°-20°). No hiperextiendas la rodilla.'],
  ['piernab-hip-thrust', 'Pierna B', 'Viernes', 2, 'Hip thrust en máquina o con barra', 'Glúteo / Cadera', 3, 6, 8, '1–2', '70%×5', '2–3 min | Minibanda sobre las rodillas empujando hacia afuera.'],
  ['piernab-femoral', 'Pierna B', 'Viernes', 3, 'Curl femoral (Tumbado o Sentado)', 'Isquiotibiales', 3, 8, 10, '1', '', '2 min | Aislamiento de isquios.'],
  ['piernab-spanish-squat', 'Pierna B', 'Viernes', 4, 'Spanish Squat (con banda) o Prensa 1 pierna', 'Cuádriceps', 2, 8, 10, '2', '50%×6', '2 min | [ANTI-HOFFITIS] Tibia 100% vertical.'],
  ['piernab-pantorrilla', 'Pierna B', 'Viernes', 5, 'Pantorrillas (Rango sin bloqueo)', 'Pantorrillas', 3, 10, 12, '1', '', '90 seg | 2 seg de pausa abajo sin trabar rodilla.'],
  ['piernab-crunch', 'Pierna B', 'Viernes', 6, 'Crunch abdominal en polea + Plancha', 'Core / Abdomen', 2, 8, 12, '1', '', '60 seg | Core con carga progresiva.']
].map(([id, session, day, order, name, muscle, sets, repsMin, repsMax, rirTarget, warmup, notes]) =>
  ({ id, session, day, order, name, muscle, sets, repsMin, repsMax, rirTarget, warmup, notes, active: true }));

// ---------- Utilidades ----------

const $ = id => document.getElementById(id);
const round1 = n => Math.round((Number(n) || 0) * 10) / 10;
const nowIso = () => new Date().toISOString();
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const newId = () => (window.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const numOrNull = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));

function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function slug(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// ---------- Almacenamiento local (caché + cola de cambios pendientes) ----------
//
// Cada cuenta de Google tiene su propia copia local (fittracker-v3:<email>), así
// varias personas pueden usar el mismo navegador sin mezclar datos. Sin sesión
// iniciada se usa la copia anónima (fittracker-v2).

let db, pending, account;
let selectedDate = new Date();
selectedDate.setHours(12, 0, 0, 0);
let viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
const CALENDAR_KEY = 'fittracker-calendar-expanded';
let calendarExpanded = localStorage.getItem(CALENDAR_KEY) === '1';

const emptyPending = () => Object.fromEntries(TABLES.map(t => [t, {}]));
const defaultDb = () => ({
  entries: [], foods: DEFAULT_FOODS.map(f => ({ ...f })), weights: [], config: { ...DEFAULT_CONFIG },
  routine: DEFAULT_ROUTINE.map(x => ({ ...x })), sets: []
});
const storeKey = () => (account?.email ? `${STORE_PREFIX}${account.email.toLowerCase()}` : STORE_KEY);

function readJson(key) {
  const raw = localStorage.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(key + '-corrupto-' + Date.now(), raw);
    return null;
  }
}

function loadStore() {
  const stored = readJson(storeKey());
  db = { ...defaultDb(), ...(stored?.db || {}) };
  pending = { ...emptyPending(), ...(stored?.pending || {}) };
}

function persist() {
  localStorage.setItem(storeKey(), JSON.stringify({ db, pending }));
}

function upsertBy(list, field, row, remove) {
  const i = list.findIndex(x => x[field] === row[field]);
  if (remove) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = row; else list.push(row);
}

function applyRow(table, row) {
  if (table === 'Config') db.config[row.key] = row.value;
  else if (table === 'Alimentos') upsertBy(db.foods, 'id', row, false);
  else if (table === 'Registros') upsertBy(db.entries, 'id', row, row.deleted);
  else if (table === 'Rutina') upsertBy(db.routine, 'id', row, false);
  else if (table === 'Series') upsertBy(db.sets, 'id', row, row.deleted);
  else upsertBy(db.weights, 'date', row, row.deleted);
}

function queueRow(table, row) {
  if (table !== 'Config') row.updatedAt = nowIso();
  applyRow(table, row);
  pending[table][row[KEY_FIELD[table]]] = row;
}

function change(table, rows) {
  [].concat(rows).forEach(row => queueRow(table, row));
  persist();
  render();
  scheduleFlush();
}

const pendingCount = () => TABLES.reduce((n, t) => n + Object.keys(pending[t]).length, 0);
const configRow = key => ({ key, value: db.config[key], description: CONFIG_DESCRIPTIONS[key] || '' });

// Encola todo el contenido local para subirlo a una hoja nueva.
function queueEverything() {
  db.foods.forEach(r => queueRow('Alimentos', { ...r }));
  db.routine.forEach(r => queueRow('Rutina', { ...r }));
  db.entries.forEach(r => queueRow('Registros', { ...r }));
  db.weights.forEach(r => queueRow('Peso', { ...r }));
  db.sets.forEach(r => queueRow('Series', { ...r }));
  Object.keys(db.config).forEach(k => queueRow('Config', configRow(k)));
}

// Convierte el formato v1 ({fecha: [{meal, food: índice, amount}]}) en filas de Registros.
function migrateLegacy() {
  const legacy = readJson(LEGACY_KEY);
  if (!legacy || localStorage.getItem(STORE_KEY)) return;
  Object.entries(legacy).forEach(([date, list]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(list)) return;
    list.forEach((e, i) => {
      const food = DEFAULT_FOODS[e.food];
      const amount = Number(e.amount);
      if (!food || !(amount > 0) || !MEALS.includes(e.meal)) return;
      queueRow('Registros', {
        id: `v1-${date}-${i}`, date, meal: e.meal, foodId: food.id, food: food.name, amount, unit: food.unit,
        ...macrosFor(food, amount), notes: '', deleted: false
      });
    });
  });
  localStorage.setItem(LEGACY_KEY + '-respaldo', localStorage.getItem(LEGACY_KEY));
  localStorage.removeItem(LEGACY_KEY);
  persist();
}

// ---------- Cuenta de Google y sincronización ----------

const isConnected = () => Boolean(account?.spreadsheetId && GSheets.hasToken());
let chain = Promise.resolve();
let flushTimer;

function serial(task) {
  chain = chain.then(task, task);
  return chain;
}

function setStatus(text) {
  $('status').textContent = text;
  $('connStatus').textContent = text;
  if (connecting) $('landingStatus').textContent = text;
}

function idleStatus() {
  const n = pendingCount();
  if (!account) return n ? `Modo local · ${n} cambios se subirán al iniciar sesión con Google.` : 'Modo local · inicia sesión con Google para guardar en tu Drive.';
  if (!GSheets.hasToken()) return `Sesión de Google caducada · toca Sincronizar para reconectar${n ? ` (${n} cambios pendientes)` : ''}.`;
  return n ? `${n} cambios pendientes de subir.` : `Guardado en tu Google Sheets · ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
}

function errorStatus(e) {
  if (e instanceof GSheets.AuthError) return idleStatus();
  return `No se pudo sincronizar: ${e.message}. ${pendingCount()} cambios pendientes guardados en este navegador.`;
}

async function flush() {
  for (const table of TABLES) {
    const items = Object.entries(pending[table]);
    for (let i = 0; i < items.length; i += 300) {
      const chunk = items.slice(i, i + 300);
      await GSheets.upsert(account.spreadsheetId, table, chunk.map(([, row]) => row));
      chunk.forEach(([key, row]) => { if (pending[table][key] === row) delete pending[table][key]; });
      persist();
    }
  }
}

async function pull() {
  const data = await GSheets.load(account.spreadsheetId, {
    Alimentos: DEFAULT_FOODS.map(f => ({ ...f, updatedAt: nowIso() })),
    Rutina: DEFAULT_ROUTINE.map(x => ({ ...x, updatedAt: nowIso() })),
    Config: Object.keys(DEFAULT_CONFIG).map(key => ({ key, value: DEFAULT_CONFIG[key], description: CONFIG_DESCRIPTIONS[key] || '' }))
  });
  db = {
    entries: data.entries,
    foods: data.foods.length ? data.foods : defaultDb().foods,
    weights: data.weights,
    config: { ...DEFAULT_CONFIG, ...data.config },
    routine: data.routine.length ? data.routine : defaultDb().routine,
    sets: data.sets
  };
  TABLES.forEach(t => Object.values(pending[t]).forEach(row => applyRow(t, row)));
  persist();
  fillForms();
  render();
}

function sync() {
  if (!isConnected()) { setStatus(idleStatus()); renderAccount(); return Promise.resolve(); }
  clearTimeout(flushTimer);
  return serial(async () => {
    try {
      setStatus('Sincronizando…');
      await flush();
      await pull();
      setStatus(idleStatus());
    } catch (e) {
      setStatus(errorStatus(e));
    }
    renderAccount();
  });
}

function scheduleFlush() {
  setStatus(idleStatus());
  if (!isConnected()) return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => serial(async () => {
    try {
      setStatus('Guardando en Google Sheets…');
      await flush();
      setStatus(idleStatus());
    } catch (e) {
      setStatus(errorStatus(e));
      renderAccount();
    }
  }), 800);
}

const hasUserData = () => db.entries.length + db.weights.length + db.sets.length > 0;

// Debe ejecutarse desde un clic (abre la ventana de Google).
let connecting = false;

async function connectGoogle() {
  const previous = account;
  connecting = true;
  $('landingStatus').textContent = '';
  try {
    setStatus('Conectando con Google…');
    await GSheets.signIn(account?.email);
    const user = await GSheets.getUser();
    const sameAccount = account?.email === user.email;
    if (!sameAccount) {
      persist(); // guarda la copia actual antes de cambiar de cuenta
      const anonymous = account ? null : { db, pending };
      account = { email: user.email, name: user.name, spreadsheetId: null };
      loadStore();
      let spreadsheetId = await GSheets.findSpreadsheet();
      if (!spreadsheetId) {
        setStatus('Creando tu hoja FitTracker en Google Drive…');
        spreadsheetId = await GSheets.createSpreadsheet('FitTracker');
        const importLocal = anonymous && (anonymous.db.entries.length + anonymous.db.weights.length + anonymous.db.sets.length > 0) &&
          confirm(`¿Subir a tu cuenta los datos de este navegador? (${anonymous.db.entries.length} comidas, ${anonymous.db.weights.length} pesos, ${anonymous.db.sets.length} series)`);
        if (importLocal && !hasUserData()) {
          db = anonymous.db;
          pending = emptyPending();
          queueEverything();
          localStorage.removeItem(STORE_KEY); // ya pertenecen a esta cuenta
        }
      }
      account.spreadsheetId = spreadsheetId;
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
      persist();
    }
    showView();
    render();
    await sync();
  } catch (e) {
    if (account && !account.spreadsheetId) { // falló a mitad del cambio de cuenta
      account = previous;
      loadStore();
      render();
    }
    setStatus(`No se pudo conectar con Google: ${e.message}.`);
    renderAccount();
  } finally {
    connecting = false;
  }
}

function signOut() {
  if (!confirm('¿Cerrar sesión? Tus datos quedan en tu Google Sheets.')) return;
  persist();
  GSheets.signOut();
  account = null;
  localStorage.removeItem(ACCOUNT_KEY);
  localStorage.removeItem(LOCAL_MODE_KEY);
  loadStore();
  fillForms();
  render();
  setStatus('');
  showView();
}

// Sin cuenta y sin haber elegido el modo local, se muestra la pantalla de inicio.
// Quien ya tiene datos locales entra directo a la app.
function showView() {
  const landing = !account && !localStorage.getItem(LOCAL_MODE_KEY) && !hasUserData();
  $('landing').hidden = !landing;
  $('app').hidden = landing;
  $('localBanner').hidden = Boolean(account);
  window.scrollTo(0, 0);
}

function bindOnboarding() {
  const slides = $('slides');
  const dots = [...$('dots').children];
  const update = () => {
    const i = slides.clientWidth ? Math.round(slides.scrollLeft / slides.clientWidth) : 0;
    dots.forEach((d, j) => d.classList.toggle('on', j === i));
  };
  dots.forEach((d, j) => { d.onclick = () => slides.scrollTo({ left: j * slides.clientWidth, behavior: 'smooth' }); });
  slides.addEventListener('scroll', update, { passive: true });
  update();
}

// Cada tip se muestra hasta que se toca "Entendido", una sola vez por navegador.
function bindTips() {
  const seen = new Set(readJson(TIPS_KEY) || []);
  document.querySelectorAll('[data-tip]').forEach(tip => {
    tip.hidden = seen.has(tip.dataset.tip);
    tip.querySelector('[data-tip-close]').onclick = () => {
      tip.hidden = true;
      seen.add(tip.dataset.tip);
      localStorage.setItem(TIPS_KEY, JSON.stringify([...seen]));
    };
  });
}

// Android/PC (Chrome, Edge) permiten abrir el instalador; en iPhone solo se puede explicar los pasos.
function bindInstall() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const buttons = document.querySelectorAll('[data-install]');
  let deferred = null;
  const show = visible => buttons.forEach(b => { b.hidden = !visible; });

  show(!installed && ios);
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    show(true);
  });
  window.addEventListener('appinstalled', () => { deferred = null; show(false); });

  buttons.forEach(b => {
    b.onclick = async () => {
      if (deferred) {
        deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === 'accepted') { deferred = null; show(false); }
        return;
      }
      $('installIos').hidden = !ios;
      $('installOther').hidden = ios;
      $('installHelp').showModal();
    };
  });
}

function startLocal() {
  localStorage.setItem(LOCAL_MODE_KEY, '1');
  setStatus(idleStatus());
  showView();
}

function renderAccount() {
  const configured = GSheets.isConfigured();
  $('connSummary').textContent = !account ? '· sin conectar' : GSheets.hasToken() ? `· ${account.email}` : '· sesión caducada';
  $('signedOut').hidden = Boolean(account);
  $('signedIn').hidden = !account;
  $('googleSignIn').disabled = !configured;
  $('landingSignIn').disabled = !configured;
  $('bannerSignIn').disabled = !configured;
  $('notConfigured').hidden = configured;
  if (account) {
    $('accountName').textContent = account.name ? `${account.name} (${account.email})` : account.email;
    $('openSheet').href = account.spreadsheetId ? GSheets.sheetUrl(account.spreadsheetId) : '#';
    $('reconnect').hidden = GSheets.hasToken();
  }
}

// ---------- Dominio ----------

const goal = m => Number(db.config[m.goal]) || DEFAULT_CONFIG[m.goal];
const activeFoods = () => db.foods.filter(f => f.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'es'));
const entriesOn = key => db.entries.filter(e => e.date === key);

function macrosFor(food, amount) {
  const factor = food.unit === 'unidad' ? amount : amount / 100;
  const extras = EXTRAS.map(x => [x.id, food[x.id] == null || food[x.id] === '' ? null : round1(food[x.id] * factor)]);
  return Object.fromEntries([...MACROS.map(m => [m.id, round1(food[m.id] * factor)]), ...extras]);
}

const hasValue = v => v !== null && v !== undefined && v !== '';

function totals(list) {
  const t = { k: 0, p: 0, c: 0, f: 0, fiber: 0, sugar: 0, missing: { fiber: 0, sugar: 0 } };
  list.forEach(e => {
    MACROS.forEach(m => { t[m.id] += Number(e[m.id]) || 0; });
    EXTRAS.forEach(x => { if (hasValue(e[x.id])) t[x.id] += Number(e[x.id]); else t.missing[x.id]++; });
  });
  return t;
}

function weekKeys() {
  const dow = (selectedDate.getDay() + 6) % 7;
  return DAY_NAMES.map((_, i) => dateKey(addDays(selectedDate, i - dow)));
}

const sortedWeights = () => [...db.weights].sort((a, b) => a.date.localeCompare(b.date));

// ---------- Entrenamiento ----------

const TAB_KEY = 'fittracker-tab';
const WEIGHT_STEP = 2.5;
let activeTab = localStorage.getItem(TAB_KEY) === 'entreno' ? 'entreno' : 'nutricion';
const sessionPick = {}; // sesión elegida a mano por fecha (si aún no hay series)
const drafts = {};      // valores escritos y aún no guardados, para no perderlos al re-renderizar
const extraSets = {};   // filas extra añadidas con "+ Serie"

const roundStep = w => Math.round(w / WEIGHT_STEP) * WEIGHT_STEP;
const fmtKg = w => `${round1(w)} kg`;
const shortDate = k => parseKey(k).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
const activeRoutine = () => db.routine.filter(x => x.active !== false);
const exercisesOf = session => activeRoutine().filter(x => x.session === session).sort((a, b) => (a.order || 0) - (b.order || 0));
const setsOn = key => db.sets.filter(x => x.date === key);
const setKey = (date, exId, n) => `${date}|${exId}|${n}`;

function sessions() {
  const byName = {};
  activeRoutine().forEach(x => {
    const day = DAY_NAMES.indexOf(x.day);
    if (!(x.session in byName) || (day >= 0 && day < byName[x.session])) byName[x.session] = day >= 0 ? day : 99;
  });
  return Object.keys(byName).sort((a, b) => byName[a] - byName[b]).map(name => ({ name, day: byName[name] }));
}

// Sesión más frecuente entre las series del día.
function loggedSession(key) {
  const count = {};
  setsOn(key).forEach(x => { count[x.session] = (count[x.session] || 0) + 1; });
  return Object.keys(count).sort((a, b) => count[b] - count[a])[0] || null;
}

// Sugerencia: la primera sesión de la semana que aún no hiciste antes de esta fecha.
function suggestedSession(key) {
  const list = sessions();
  if (!list.length) return null;
  const done = new Set(weekKeys().filter(k => k < key).map(loggedSession).filter(Boolean));
  const next = list.find(x => !done.has(x.name));
  return (next || list.find(x => x.day === (parseKey(key).getDay() + 6) % 7) || list[0]).name;
}

function currentSession(key) {
  return sessionPick[key] || loggedSession(key) || suggestedSession(key);
}

function lastPerformance(exId, beforeKey) {
  const prev = db.sets.filter(x => x.exerciseId === exId && x.date < beforeKey);
  if (!prev.length) return null;
  const date = prev.reduce((m, x) => (x.date > m ? x.date : m), '');
  return { date, sets: prev.filter(x => x.date === date).sort((a, b) => a.setNo - b.setNo) };
}

// Doble progresión: si todas las series llegaron al tope del rango, sube peso; si no, suma reps.
function progression(ex, last) {
  if (!last) return { weight: null, reps: ex.repsMin, text: `Primera vez: elige un peso que te deje RIR ${ex.rirTarget || '1–2'} en ${ex.repsMin}–${ex.repsMax} reps.`, cls: '' };
  const top = Math.max(...last.sets.map(x => Number(x.weight) || 0));
  const work = last.sets.filter(x => Number(x.weight) === top);
  const allTop = work.length >= ex.sets && work.every(x => x.reps >= ex.repsMax);
  if (allTop && top > 0) {
    return { weight: top + WEIGHT_STEP, reps: ex.repsMin, text: `⬆️ Sube a ${fmtKg(top + WEIGHT_STEP)}: llegaste a ${ex.repsMax} reps en todas las series.`, cls: 'up' };
  }
  if (allTop) return { weight: top, reps: ex.repsMax, text: '⬆️ Llegaste al tope de reps: añade carga o dificultad.', cls: 'up' };
  return { weight: top, reps: null, text: `🔄 Mantén ${fmtKg(top)} y busca +1 rep por serie hasta llegar a ${ex.repsMax}.`, cls: '' };
}

function warmupHtml(ex, weight) {
  const steps = [...String(ex.warmup || '').matchAll(/(\d+(?:[.,]\d+)?)\s*%\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)/gi)];
  if (!steps.length) return '';
  const items = steps.map(([, pct, reps]) => {
    const p = Number(pct.replace(',', '.'));
    const load = weight > 0 ? `<b>${fmtKg(roundStep(weight * p / 100))}</b> × ${esc(reps)} reps <small class="muted">(${p}% de tu peso)</small>`
      : `${esc(reps)} reps con el <b>${p}%</b> del peso que usarás`;
    return `<li>${load}</li>`;
  }).join('');
  return `<div class="warmup"><b>🔥 Calentamiento antes de empezar</b> <small class="muted">· no cuenta como serie</small><ol>${items}</ol></div>`;
}

// Las notas tienen el formato "2–3 min | técnica"; la parte antes de "|" es el descanso.
function splitNotes(notes) {
  const [head, ...rest] = String(notes || '').split('|');
  return rest.length && /\d\s*(min|seg|s)\b/i.test(head) ? { rest: head.trim(), tech: rest.join('|').trim() } : { rest: '', tech: String(notes || '').trim() };
}

function renderTabs() {
  document.querySelectorAll('[data-tab]').forEach(b => {
    const on = b.dataset.tab === activeTab;
    b.setAttribute('aria-selected', String(on));
    b.classList.toggle('active', on);
  });
  $('tab-nutricion').hidden = activeTab !== 'nutricion';
  $('tab-entreno').hidden = activeTab !== 'entreno';
}

function renderWorkout() {
  const key = dateKey(selectedDate);
  const current = currentSession(key);
  const logged = loggedSession(key);
  const doneThisWeek = new Set(weekKeys().map(loggedSession).filter(Boolean));
  $('workoutLabel').textContent = selectedDate.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  $('sessions').innerHTML = sessions().map(x =>
    `<button class="chip${x.name === current ? ' active' : ''}" data-session="${esc(x.name)}" aria-pressed="${x.name === current}">` +
    `${doneThisWeek.has(x.name) ? '✓ ' : ''}${esc(x.name)}</button>`).join('');

  const exercises = current ? exercisesOf(current) : [];
  const daySets = setsOn(key);
  const target = exercises.reduce((n, ex) => n + (Number(ex.sets) || 0), 0);
  const doneSets = daySets.filter(x => x.session === current).length;
  $('sessionHint').textContent = !current ? 'No hay rutina. Revisa la hoja Rutina en Google Sheets.'
    : logged === current ? `Sesión registrada: ${current} · ${doneSets}/${target} series.`
    : logged ? `Viendo ${current} · este día ya tiene series de ${logged}.`
    : `${sessionPick[key] ? 'Sesión elegida' : 'Te toca'}: ${current} · ${target} series. ¿Hoy haces otra? Tócala arriba. ✓ = ya hecha esta semana.`;

  $('exercises').innerHTML = exercises.map((ex, i) => {
    const last = lastPerformance(ex.id, key);
    const prog = progression(ex, last);
    const mine = daySets.filter(x => x.exerciseId === ex.id).sort((a, b) => a.setNo - b.setNo);
    const rows = Math.max(Number(ex.sets) || 1, ...mine.map(x => x.setNo), 0) + (extraSets[key + '|' + ex.id] || 0);
    const firstWeight = Number(mine[0]?.weight) || prog.weight;
    const warm = warmupHtml(ex, firstWeight);
    const notes = splitNotes(ex.notes);
    const setRows = Array.from({ length: rows }, (_, idx) => {
      const n = idx + 1;
      const saved = mine.find(x => x.setNo === n);
      const draft = drafts[setKey(key, ex.id, n)] || {};
      const prevSet = last?.sets.find(x => x.setNo === n);
      const phW = prog.weight ?? '';
      const phR = prog.reps ?? (prevSet ? Math.min(prevSet.reps + 1, ex.repsMax) : ex.repsMin);
      const val = f => esc(draft[f] ?? saved?.[f] ?? '');
      return `<div class="set${saved ? ' saved' : ''}" data-ex="${esc(ex.id)}" data-n="${n}">` +
        `<span class="set-n">${n}</span>` +
        `<input data-f="weight" inputmode="decimal" aria-label="Peso serie ${n}" placeholder="${esc(phW)}" value="${val('weight')}">` +
        `<input data-f="reps" inputmode="numeric" aria-label="Reps serie ${n}" placeholder="${esc(phR)}" value="${val('reps')}">` +
        `<input data-f="rir" inputmode="numeric" aria-label="RIR serie ${n}" placeholder="RIR" value="${val('rir')}">` +
        `<button class="${saved ? '' : 'secondary'}" data-save-set aria-label="${saved ? 'Actualizar' : 'Guardar'} serie ${n}">✓</button>` +
        (saved ? `<button class="danger" data-del-set aria-label="Borrar serie ${n}">×</button>` : '<span></span>') + '</div>';
    }).join('');
    const lastText = last ? `Última vez (${shortDate(last.date)}): ${last.sets.map(x => `${round1(x.weight)}×${x.reps}`).join(' · ')}` : 'Sin registros anteriores';
    return `<section class="panel exercise"><div class="row ex-head"><div><b>${i + 1}. ${esc(ex.name)}</b><br>` +
      `<small class="muted">${esc(ex.muscle)} · ${esc(ex.sets)} × ${esc(ex.repsMin)}–${esc(ex.repsMax)} · RIR ${esc(ex.rirTarget || '—')}</small>` +
      (notes.rest ? `<br><small class="rest">⏱️ Descanso ${esc(notes.rest)}</small>` : '') + '</div>' +
      `<span class="badge${mine.length >= ex.sets ? ' done' : ''}">${mine.length}/${esc(ex.sets)}</span></div>` +
      `<p class="ex-line muted">${esc(lastText)}</p><p class="ex-line tip ${prog.cls}">${esc(prog.text)}</p>` +
      warm +
      `<div class="sets"><div class="set head"><span>#</span><span>Peso (kg)</span><span>Reps</span><span>RIR</span><span></span><span></span></div>${setRows}</div>` +
      `<div class="row ex-foot"><button class="secondary" data-add-set="${esc(ex.id)}">+ Serie</button>` +
      (notes.tech ? `<details class="tech"><summary>Técnica</summary><p>${esc(notes.tech)}</p></details>` : '') + '</div></section>';
  }).join('');

  const list = [...activeRoutine()].sort((a, b) => sessions().findIndex(x => x.name === a.session) - sessions().findIndex(x => x.name === b.session) || (a.order || 0) - (b.order || 0));
  $('routineCount').textContent = `(${list.length} ejercicios)`;
  $('routine').innerHTML = list.map(x => `<tr><td>${esc(x.session)}</td><td>${esc(x.name)}</td><td>${esc(x.muscle)}</td>` +
    `<td>${esc(x.sets)} × ${esc(x.repsMin)}–${esc(x.repsMax)}</td><td>${esc(x.rirTarget)}</td><td>${esc(x.warmup || '—')}</td></tr>`).join('');
}

function saveSet(row) {
  const key = dateKey(selectedDate);
  const ex = db.routine.find(x => x.id === row.dataset.ex);
  if (!ex) return;
  const n = Number(row.dataset.n);
  const input = f => row.querySelector(`[data-f="${f}"]`);
  // Campo vacío = usar el valor sugerido (placeholder), para registrar rápido en el gimnasio.
  const read = f => numOrNull(input(f).value.trim() || (f === 'rir' ? '' : input(f).placeholder));
  const weight = read('weight');
  const reps = read('reps');
  const rir = read('rir');
  if (weight === null || !(weight >= 0)) { input('weight').focus(); return; }
  if (reps === null || !(reps >= 0)) { input('reps').focus(); return; }
  const existing = db.sets.find(x => x.date === key && x.exerciseId === ex.id && x.setNo === n);
  delete drafts[setKey(key, ex.id, n)];
  change('Series', {
    ...(existing || {}), id: existing?.id || `${key}-${ex.id}-${n}`.slice(0, 64), date: key, session: ex.session,
    exerciseId: ex.id, exercise: ex.name, setNo: n, weight, reps, rir, notes: existing?.notes || '', deleted: false
  });
}

function deleteSet(row) {
  const key = dateKey(selectedDate);
  const s = db.sets.find(x => x.date === key && x.exerciseId === row.dataset.ex && x.setNo === Number(row.dataset.n));
  if (s && confirm(`¿Borrar la serie ${s.setNo} de ${s.exercise}?`)) {
    delete drafts[setKey(key, s.exerciseId, s.setNo)];
    change('Series', { ...s, deleted: true });
  }
}

function bindWorkoutEvents() {
  document.querySelectorAll('[data-tab]').forEach(b => {
    b.onclick = () => {
      activeTab = b.dataset.tab;
      localStorage.setItem(TAB_KEY, activeTab);
      render();
    };
  });
  $('sessions').onclick = e => {
    const b = e.target.closest('[data-session]');
    if (!b) return;
    const key = dateKey(selectedDate);
    sessionPick[key] = b.dataset.session;
    renderWorkout();
  };
  $('exercises').onclick = e => {
    const row = e.target.closest('.set[data-ex]');
    if (e.target.closest('[data-save-set]') && row) saveSet(row);
    if (e.target.closest('[data-del-set]') && row) deleteSet(row);
    const add = e.target.closest('[data-add-set]');
    if (add) {
      const k = dateKey(selectedDate) + '|' + add.dataset.addSet;
      extraSets[k] = (extraSets[k] || 0) + 1;
      renderWorkout();
    }
  };
  $('exercises').oninput = e => {
    const row = e.target.closest('.set[data-ex]');
    if (!row || !e.target.dataset.f) return;
    const k = setKey(dateKey(selectedDate), row.dataset.ex, row.dataset.n);
    drafts[k] = { ...(drafts[k] || {}), [e.target.dataset.f]: e.target.value };
  };
  $('exercises').onkeydown = e => {
    const row = e.target.closest('.set[data-ex]');
    if (e.key === 'Enter' && row && e.target.tagName === 'INPUT') { e.preventDefault(); saveSet(row); }
  };
}

// ---------- Render ----------

function render() {
  renderTabs();
  renderWorkout();
  renderHeader();
  renderCalendar();
  renderMetrics();
  renderMeals();
  renderWeek();
  renderWeights();
  renderFoods();
  renderSummaries();
  renderStreaks();
}

// Racha de entreno: semanas seguidas (lunes a domingo) con al menos N días entrenados.
// Racha de proteína: días seguidos llegando a la meta.
// El periodo en curso suma si ya se cumplió, pero no rompe la racha mientras no termine.
function trainingStreak() {
  const min = Number(db.config.meta_sesiones_semana) || DEFAULT_CONFIG.meta_sesiones_semana;
  const days = new Set(db.sets.map(x => x.date));
  const monday = d => addDays(d, -((d.getDay() + 6) % 7));
  const countWeek = start => Array.from({ length: 7 }, (_, i) => dateKey(addDays(start, i))).filter(k => days.has(k)).length;
  let week = monday(parseKey(dateKey(new Date())));
  const thisWeek = countWeek(week);
  let streak = thisWeek >= min ? 1 : 0;
  const first = [...days].sort()[0];
  for (week = addDays(week, -7); first && dateKey(addDays(week, 6)) >= first; week = addDays(week, -7)) {
    if (countWeek(week) < min) break;
    streak++;
  }
  return { streak, thisWeek, min };
}

function proteinStreak() {
  const target = goal(MACROS[1]);
  const byDate = {};
  db.entries.forEach(e => { byDate[e.date] = (byDate[e.date] || 0) + (Number(e.p) || 0); });
  const met = k => (byDate[k] || 0) >= target;
  let d = parseKey(dateKey(new Date()));
  const today = met(dateKey(d));
  let streak = today ? 1 : 0;
  for (d = addDays(d, -1); met(dateKey(d)); d = addDays(d, -1)) streak++;
  return { streak, today, todayP: round1(byDate[dateKey(new Date())] || 0), target };
}

function renderStreaks() {
  const t = trainingStreak();
  const p = proteinStreak();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  $('streaks').innerHTML =
    `<div class="streak${t.streak ? ' on' : ''}"><b>🏋️ ${plural(t.streak, 'semana', 'semanas')}</b>` +
    `<small>Esta semana: ${t.thisWeek}/${t.min} entrenos${t.thisWeek >= t.min ? ' ✓' : ''}</small></div>` +
    `<div class="streak${p.streak ? ' on' : ''}"><b>🥩 ${plural(p.streak, 'día', 'días')}</b>` +
    `<small>Proteína hoy: ${p.todayP}/${p.target} g${p.today ? ' ✓' : ''}</small></div>`;
}

function renderSummaries() {
  $('goalsSummary').textContent = `· ${goal(MACROS[0])} kcal · ${goal(MACROS[1])} g proteína`;
  renderAccount();
}

function renderHeader() {
  const weights = sortedWeights();
  const initial = Number(db.config.peso_inicial_kg) || DEFAULT_CONFIG.peso_inicial_kg;
  const last = weights[weights.length - 1];
  if (!last) {
    $('subtitle').textContent = `Peso inicial: ${round1(initial)} kg · registra tu primer peso en ⚖️ Peso y medidas`;
    return;
  }
  const diff = round1(last.weight - initial);
  const days = Math.round((parseKey(dateKey(new Date())) - parseKey(last.date)) / 86400000);
  const when = days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`;
  const parts = [
    `Peso actual: ${round1(last.weight)} kg`,
    `${diff > 0 ? '+' : ''}${diff} kg desde el inicio`,
    `pesado ${when}`
  ];
  if (days >= 7) parts.push('⚖️ toca pesarte');
  $('subtitle').textContent = parts.join(' · ');
}

function renderCalendar() {
  const today = dateKey(new Date());
  const selected = dateKey(selectedDate);
  const kcalByDate = {};
  db.entries.forEach(e => { kcalByDate[e.date] = (kcalByDate[e.date] || 0) + (Number(e.k) || 0); });
  const training = activeTab === 'entreno';
  const dayButton = d => {
    const k = dateKey(d);
    if (training) {
      const session = loggedSession(k);
      const cls = ['day', k === selected && 'active', k === today && 'today', session && 'has-data'].filter(Boolean).join(' ');
      return `<button class="${cls}" data-date="${k}"><span>${d.getDate()}</span><small>${session ? esc(session) : '—'}</small></button>`;
    }
    const has = k in kcalByDate;
    const cls = ['day', k === selected && 'active', k === today && 'today', has && 'has-data'].filter(Boolean).join(' ');
    return `<button class="${cls}" data-date="${k}"><span>${d.getDate()}</span><small>${has ? Math.round(kcalByDate[k]) + '<span class="unit"> kcal</span>' : '—'}</small></button>`;
  };

  const toggle = $('toggleCalendar');
  toggle.textContent = calendarExpanded ? 'Ver semana ▴' : 'Ver mes ▾';
  toggle.setAttribute('aria-expanded', String(calendarExpanded));
  $('prevMonth').setAttribute('aria-label', calendarExpanded ? 'Mes anterior' : 'Semana anterior');
  $('nextMonth').setAttribute('aria-label', calendarExpanded ? 'Mes siguiente' : 'Semana siguiente');

  const cells = DAY_NAMES.map(n => `<div class="weekhead">${n.slice(0, 3)}</div>`);
  let title;
  if (calendarExpanded) {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1, 12);
    const offset = (first.getDay() + 6) % 7;
    const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0, 12).getDate();
    for (let i = 0; i < offset; i++) cells.push('<div class="day blank"></div>');
    for (let n = 1; n <= last; n++) cells.push(dayButton(new Date(first.getFullYear(), first.getMonth(), n, 12)));
    title = first.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  } else {
    const days = weekKeys().map(parseKey);
    days.forEach(d => cells.push(dayButton(d)));
    const fmt = d => d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
    title = `${fmt(days[0])} – ${fmt(days[6])} ${days[6].getFullYear()}`;
  }
  $('monthTitle').textContent = title.charAt(0).toUpperCase() + title.slice(1);
  $('days').innerHTML = cells.join('');
}

function moveCalendar(step) {
  if (calendarExpanded) {
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + step, 1, 12);
    renderCalendar();
  } else {
    selectDate(addDays(selectedDate, step * 7));
  }
}

function renderMetrics() {
  const t = totals(entriesOn(dateKey(selectedDate)));
  $('metrics').innerHTML = MACROS.map(m => {
    const g = goal(m);
    const pct = g ? (t[m.id] / g) * 100 : 0;
    // Solo exceder las calorías es una alerta; más proteína no es un problema.
    const over = m.id === 'k' && pct > 105;
    const goalText = over ? `Meta: ${g} ${m.unit} · excedido por ${round1(t[m.id] - g)}` : `Meta: ${g} ${m.unit} · faltan ${Math.max(0, round1(g - t[m.id]))}`;
    return `<div class="metric m-${m.id}${over ? ' over' : ''}"><small>${m.label}</small><b>${round1(t[m.id])} <small>${m.unit}</small></b>` +
      `<small class="goal">${goalText}</small>` +
      `<div class="bar" role="progressbar" aria-label="${m.label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(100, pct))}"><span style="width:${Math.min(100, pct)}%"></span></div></div>`;
  }).join('') + extrasLine(t);
  renderMiniStatus(t);
}

function renderMiniStatus(t) {
  const [k, p] = [MACROS[0], MACROS[1]];
  const gk = goal(k), gp = goal(p);
  const pct = gk ? (t.k / gk) * 100 : 0;
  const over = pct > 105;
  const left = over ? `excedido por ${round1(t.k - gk)}` : `faltan ${Math.max(0, round1(gk - t.k))}`;
  $('miniStatus').innerHTML =
    `<div class="mini-k${over ? ' over' : ''}"><b>🔥 ${round1(t.k)} / ${gk} kcal</b> · ${left}` +
    `<div class="bar"><span style="width:${Math.min(100, pct)}%"></span></div></div>` +
    `<div class="mini-p">🥩 ${round1(t.p)} / ${gp} g · faltan ${Math.max(0, round1(gp - t.p))}</div>`;
}

// Muestra la barra fija solo cuando el dashboard principal queda fuera de pantalla.
const metricsObserver = new IntersectionObserver(([e]) => {
  $('miniStatus').hidden = e.isIntersecting || e.boundingClientRect.top > 0;
});
metricsObserver.observe($('metrics'));

function extrasLine(t) {
  const parts = EXTRAS.map(x => {
    const missing = t.missing[x.id];
    const value = t[x.id] > 0 || !missing ? `${round1(t[x.id])} g` : '—';
    const note = missing ? ` <small class="muted">(${missing} sin dato)</small>` : '';
    return `<span>${x.icon} ${x.label}: <b>${value}</b>${note}</span>`;
  });
  return `<div class="extras">${parts.join('')}</div>`;
}

function renderMeals() {
  const day = entriesOn(dateKey(selectedDate));
  $('dayLabel').textContent = selectedDate.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cards = MEALS.map((meal, i) => {
    const list = day.filter(e => e.meal === meal);
    const items = list.length
      ? list.map(e => `<div class="entry"><div>${esc(e.food)}<br><small>${esc(e.amount)} ${esc(e.unit)} · ${Math.round(e.k)} kcal · ${round1(e.p)} g proteína</small></div>` +
          `<div class="actions"><button class="secondary" data-edit="${esc(e.id)}" aria-label="Editar cantidad de ${esc(e.food)}">✎</button>` +
          `<button class="danger" data-del="${esc(e.id)}" aria-label="Eliminar ${esc(e.food)}">×</button></div></div>`).join('')
      : `<button class="secondary add-meal" data-add-meal="${esc(meal)}">＋ Agregar</button>`;
    const t = totals(list);
    const macros = list.length
      ? `<div class="meal-macros"><span>P ${round1(t.p)} g</span><span>C ${round1(t.c)} g</span><span>G ${round1(t.f)} g</span></div>`
      : '';
    return `<details class="meal collapsible" style="order:${i}" data-meal="${esc(meal)}"${closedMeals.has(meal) ? '' : ' open'}><summary><div><div class="row"><b>${meal}</b>${list.length ? `<small>${Math.round(t.k)} kcal</small>` : ''}</div>${macros}</div></summary>${items}</details>`;
  });
  $('meals').innerHTML = cards.join('');
}

// Recuerda qué comidas están plegadas para que no se reabran al re-renderizar.
const closedMeals = new Set();
$('meals').addEventListener('toggle', e => {
  const meal = e.target.dataset.meal;
  if (meal) e.target.open ? closedMeals.delete(meal) : closedMeals.add(meal);
}, true);

function renderWeek() {
  const keys = weekKeys();
  const dayTotals = keys.map(k => totals(entriesOn(k)));
  const sum = totals(dayTotals);
  const logged = keys.filter(k => entriesOn(k).length).length;
  const cell = (t, m) => (m.id === 'k' ? Math.round(t[m.id]) : round1(t[m.id]) + ' g');
  const rows = keys.map((k, i) => `<tr><td>${DAY_NAMES[i]} <small class="muted">${k}</small></td>${MACROS.map(m => `<td>${cell(dayTotals[i], m)}</td>`).join('')}</tr>`);
  const avg = Object.fromEntries(MACROS.map(m => [m.id, logged ? sum[m.id] / logged : 0]));
  rows.push(`<tr class="foot"><td><b>Total</b></td>${MACROS.map(m => `<td><b>${cell(sum, m)}</b></td>`).join('')}</tr>`);
  rows.push(`<tr class="foot"><td><b>Promedio</b> <small class="muted">${logged} días con registros</small></td>${MACROS.map(m => `<td><b>${cell(avg, m)}</b></td>`).join('')}</tr>`);
  $('weekly').innerHTML = rows.join('');
}

function renderWeights() {
  const weights = sortedWeights();
  const key = dateKey(selectedDate);
  $('weightLabel').textContent = `Registro del ${key}`;
  const rows = weights.map((w, i) => ({ w, prev: weights[i - 1] })).reverse().slice(0, 10);
  $('weights').innerHTML = rows.length ? rows.map(({ w, prev }) => {
    const diff = prev ? round1(w.weight - prev.weight) : null;
    const diffCell = diff === null ? '—' : `<span class="delta">${diff > 0 ? '▲ +' : diff < 0 ? '▼ ' : ''}${diff} kg</span>`;
    return `<tr><td>${esc(w.date)}</td><td>${round1(w.weight)} kg</td><td>${diffCell}</td><td>${w.waist ? round1(w.waist) + ' cm' : '—'}</td>` +
      `<td>${w.bodyFat ? round1(w.bodyFat) + ' %' : '—'}</td><td>${esc(w.note)}</td>` +
      `<td><button class="danger" data-del-weight="${esc(w.date)}" aria-label="Eliminar peso del ${esc(w.date)}">×</button></td></tr>`;
  }).join('') : '<tr><td colspan="7" class="muted">Sin registros de peso</td></tr>';
}

const normalizeText = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function renderFoodTable() {
  const foods = activeFoods();
  const query = normalizeText($('foodSearch').value.trim());
  const shown = query ? foods.filter(f => normalizeText(f.name).includes(query)) : foods;
  $('foodCount').textContent = `(${foods.length})`;
  $('foods').innerHTML = shown.length ? shown.map(f => `<tr><td>${esc(f.name)}</td><td>${f.unit === 'unidad' ? 'por unidad' : 'por 100 g'}</td>` +
    `<td>${round1(f.k)}</td><td>${round1(f.p)} g</td><td>${round1(f.c)} g</td><td>${round1(f.f)} g</td>` +
    `<td>${hasValue(f.fiber) ? round1(f.fiber) + ' g' : '—'}</td><td>${hasValue(f.sugar) ? round1(f.sugar) + ' g' : '—'}</td>` +
    `<td><div class="actions"><button class="secondary" data-edit-food="${esc(f.id)}" aria-label="Editar ${esc(f.name)}">✎</button>` +
    `<button class="danger" data-hide-food="${esc(f.id)}" aria-label="Eliminar ${esc(f.name)}">🗑</button></div></td></tr>`).join('')
    : '<tr><td colspan="9" class="muted">Ningún alimento coincide con la búsqueda</td></tr>';

  const deleted = db.foods.filter(f => f.active === false).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  $('deletedFoodsBox').hidden = !deleted.length;
  $('deletedCount').textContent = `(${deleted.length})`;
  $('deletedFoods').innerHTML = deleted.map(f => `<li><span>${esc(f.name)}</span>` +
    `<button class="secondary" data-restore-food="${esc(f.id)}" aria-label="Restaurar ${esc(f.name)}">Restaurar</button></li>`).join('');
}

function renderFoods() {
  const foods = activeFoods();
  renderFoodTable();

  const select = $('food');
  const current = select.value;
  select.innerHTML = foods.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
  if (foods.some(f => f.id === current)) select.value = current;
  updateUnit(false);
}

function updateUnit(resetAmount) {
  const food = db.foods.find(f => f.id === $('food').value);
  if (!food) return;
  const changed = $('unit').value !== food.unit;
  $('unit').value = food.unit;
  if (resetAmount || changed) $('amount').value = food.unit === 'unidad' ? 3 : 100;
}

function fillForms() {
  CONFIG_FIELDS.forEach(k => { $('cfg-' + k).value = db.config[k] ?? DEFAULT_CONFIG[k]; });
  fillWeightForm();
}

function fillWeightForm() {
  const w = db.weights.find(x => x.date === dateKey(selectedDate));
  $('weight').value = w?.weight ?? '';
  $('waist').value = w?.waist ?? '';
  $('bodyFat').value = w?.bodyFat ?? '';
  $('weightNote').value = w?.note ?? '';
  $('weightForm').querySelector('button').textContent = w ? 'Actualizar' : 'Guardar';
}

function selectDate(d) {
  selectedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  viewMonth = new Date(d.getFullYear(), d.getMonth(), 1, 12);
  fillWeightForm();
  render();
}

// ---------- Tabla Peruana de Composición de Alimentos ----------

let catalog = null;
let catalogLoading = null;

function loadCatalog() {
  catalogLoading ||= fetch('data/tabla-peruana.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      catalog = data.foods.map(([code, name, group, k, p, c, f, fiber]) => ({
        code, name, group: data.groups[group], k, p, c, f, fiber, search: normalizeText(name)
      }));
      renderCatalog();
    })
    .catch(() => {
      catalogLoading = null;
      $('tpcaResults').innerHTML = '<p class="muted">No se pudo cargar la tabla. Revisa tu conexión.</p>';
    });
  return catalogLoading;
}

const catalogId = code => `tpca-${code.toLowerCase()}`;

function renderCatalog() {
  const query = normalizeText($('tpcaSearch').value.trim());
  if (!query) { $('tpcaResults').innerHTML = ''; return; }
  if (!catalog) { $('tpcaResults').innerHTML = '<p class="muted">Cargando tabla…</p>'; loadCatalog(); return; }
  const words = query.split(/\s+/);
  const matches = catalog.filter(x => words.every(w => x.search.includes(w)))
    .sort((a, b) => (b.search.startsWith(words[0]) - a.search.startsWith(words[0])) || a.name.length - b.name.length)
    .slice(0, 30);
  const mine = new Set(activeFoods().map(f => f.id));
  const val = (v, unit = ' g') => (hasValue(v) ? round1(v) + unit : '—');
  $('tpcaResults').innerHTML = matches.length ? matches.map(x => `<div class="tpca-item"><div><b>${esc(x.name)}</b>` +
    `<small>${esc(x.group)} · ${val(x.k, ' kcal')} · P ${val(x.p)} · C ${val(x.c)} · G ${val(x.f)} · Fibra ${val(x.fiber)}</small></div>` +
    (mine.has(catalogId(x.code))
      ? '<span class="tpca-added">✓ En tu lista</span>'
      : `<button class="secondary" data-tpca="${esc(x.code)}" aria-label="Agregar ${esc(x.name)}">+ Agregar</button>`) +
    '</div>').join('') + (matches.length === 30 ? '<p class="hint">Mostrando 30 resultados. Escribe más para afinar.</p>' : '')
    : '<p class="muted">Sin resultados. Prueba con otra palabra (ej. "pechuga" en vez de "pechuga de pollo").</p>';
}

function addFromCatalog(code) {
  const x = catalog?.find(item => item.code === code);
  if (!x) return;
  const id = catalogId(code);
  const existing = db.foods.find(f => f.id === id);
  change('Alimentos', {
    ...(existing || {}), id, name: x.name, unit: 'g', k: x.k ?? 0, p: x.p ?? 0, c: x.c ?? 0, f: x.f ?? 0,
    fiber: x.fiber, sugar: existing?.sugar ?? null, source: `Tabla Peruana INS · ${code}`, active: true
  });
  $('food').value = id;
  updateUnit(true);
  renderCatalog();
  $('tpcaStatus').textContent = `Agregado: ${x.name}. Ya está elegido en "Registrar alimento".`;
}

// ---------- Acciones ----------

let editingFoodId = null;
const FOOD_INPUTS = { k: 'foodK', p: 'foodP', c: 'foodC', f: 'foodF', fiber: 'foodFiber', sugar: 'foodSugar' };

function startFoodEdit(id) {
  const food = db.foods.find(f => f.id === id);
  if (!food) return;
  editingFoodId = id;
  $('foodName').value = food.name;
  $('foodUnit').value = food.unit;
  Object.entries(FOOD_INPUTS).forEach(([k, input]) => { $(input).value = hasValue(food[k]) ? food[k] : ''; });
  $('foodFormTitle').textContent = `Editar: ${food.name}`;
  $('foodSubmit').textContent = 'Guardar cambios';
  $('foodCancel').hidden = false;
  $('foodForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('foodK').focus({ preventScroll: true });
}

function resetFoodForm() {
  editingFoodId = null;
  $('foodForm').reset();
  $('foodFormTitle').textContent = 'Añadir alimento a mano';
  $('foodSubmit').textContent = 'Añadir alimento';
  $('foodCancel').hidden = true;
}

function saveFood() {
  const name = $('foodName').value.trim();
  if (!name) return;
  const values = {
    name, unit: $('foodUnit').value,
    k: numOrNull($('foodK').value) || 0, p: numOrNull($('foodP').value) || 0,
    c: numOrNull($('foodC').value) || 0, f: numOrNull($('foodF').value) || 0,
    fiber: numOrNull($('foodFiber').value), sugar: numOrNull($('foodSugar').value)
  };
  const old = editingFoodId && db.foods.find(f => f.id === editingFoodId);
  if (!old) {
    change('Alimentos', { id: `${slug(name) || 'alimento'}-${Math.random().toString(36).slice(2, 6)}`, ...values, source: 'Manual', active: true });
    resetFoodForm();
    return;
  }
  const same = (a, b) => (hasValue(a) ? Number(a) : null) === (hasValue(b) ? Number(b) : null);
  const valuesChanged = [...MACROS, ...EXTRAS].some(m => !same(old[m.id], values[m.id]));
  const source = valuesChanged && old.source && !/editado/.test(old.source) ? `${old.source} (editado)` : old.source;
  const food = { ...old, ...values, source };
  change('Alimentos', food);

  // Los registros guardan los macros calculados al registrar; se recalculan solo si el usuario lo pide.
  const past = db.entries.filter(e => e.foodId === food.id && e.unit === food.unit);
  if (past.length && (valuesChanged || old.name !== name) &&
      confirm(`¿Actualizar también ${past.length} registro${past.length > 1 ? 's' : ''} anterior${past.length > 1 ? 'es' : ''} de ${name} con los nuevos valores?`)) {
    change('Registros', past.map(e => ({ ...e, food: name, ...macrosFor(food, e.amount) })));
  }
  resetFoodForm();
}

function editEntry(id) {
  const e = db.entries.find(x => x.id === id);
  if (!e) return;
  const input = prompt(`Nueva cantidad (${e.unit}) para ${e.food}`, e.amount);
  if (input === null) return;
  const amount = numOrNull(input);
  if (!(amount > 0)) { alert('Cantidad inválida'); return; }
  const food = db.foods.find(f => f.id === e.foodId);
  const scale = v => (hasValue(v) ? round1(v * amount / e.amount) : null);
  const macros = food ? macrosFor(food, amount) : Object.fromEntries([...MACROS, ...EXTRAS].map(m => [m.id, scale(e[m.id])]));
  change('Registros', { ...e, amount, ...macros });
}

function deleteEntry(id) {
  const e = db.entries.find(x => x.id === id);
  if (e && confirm(`¿Eliminar ${e.food} (${e.amount} ${e.unit})?`)) change('Registros', { ...e, deleted: true });
}

function copyPreviousDay() {
  const prevKey = dateKey(addDays(selectedDate, -1));
  const source = entriesOn(prevKey);
  if (!source.length) { alert('El día anterior no tiene registros.'); return; }
  if (!confirm(`¿Copiar ${source.length} alimentos del ${prevKey} a este día?`)) return;
  const date = dateKey(selectedDate);
  change('Registros', source.map(e => ({ ...e, id: newId(), date, deleted: false })));
}

function exportCsv() {
  const header = ['fecha', 'comida', 'alimento', 'cantidad', 'unidad', 'kcal', 'proteina_g', 'carbohidratos_g', 'grasas_g', 'fibra_g', 'azucares_g', 'notas'];
  const rows = [...db.entries].sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal))
    .map(e => [e.date, e.meal, e.food, e.amount, e.unit, e.k, e.p, e.c, e.f, e.fiber, e.sugar, e.notes || '']);
  const csv = '\ufeff' + [header, ...rows].map(r => r.map(x => '"' + String(x ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'fittracker-registros.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function defaultMeal() {
  const h = new Date().getHours();
  return h < 11 ? 'Desayuno' : h < 16 ? 'Almuerzo' : h < 19 ? 'Merienda' : 'Cena';
}

function bindEvents() {
  $('meal').innerHTML = MEALS.map(m => `<option>${m}</option>`).join('');
  $('meal').value = defaultMeal();

  $('prevMonth').onclick = () => moveCalendar(-1);
  $('nextMonth').onclick = () => moveCalendar(1);
  $('toggleCalendar').onclick = () => {
    calendarExpanded = !calendarExpanded;
    localStorage.setItem(CALENDAR_KEY, calendarExpanded ? '1' : '0');
    viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
    renderCalendar();
  };
  $('today').onclick = () => selectDate(new Date());
  $('days').onclick = e => { const b = e.target.closest('[data-date]'); if (b) selectDate(parseKey(b.dataset.date)); };
  $('food').onchange = () => updateUnit(true);
  $('foodSearch').oninput = renderFoodTable;
  $('tpcaSearch').oninput = renderCatalog;
  $('tpcaSearch').onfocus = loadCatalog;
  $('openCatalog').onclick = () => {
    $('foodsPanel').open = true;
    $('tpcaSearch').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('tpcaSearch').focus({ preventScroll: true });
  };
  $('tpcaResults').onclick = e => {
    const b = e.target.closest('[data-tpca]');
    if (b) addFromCatalog(b.dataset.tpca);
  };
  $('copyPrev').onclick = copyPreviousDay;
  $('export').onclick = exportCsv;
  $('sync').onclick = () => (account && !GSheets.hasToken() ? connectGoogle() : sync());
  bindWorkoutEvents();

  $('meals').onclick = e => {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    const add = e.target.closest('[data-add-meal]');
    if (add) {
      $('meal').value = add.dataset.addMeal;
      $('add').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('food').focus({ preventScroll: true });
    }
    if (edit) editEntry(edit.dataset.edit);
    if (del) deleteEntry(del.dataset.del);
  };

  $('weights').onclick = e => {
    const b = e.target.closest('[data-del-weight]');
    const w = b && db.weights.find(x => x.date === b.dataset.delWeight);
    if (w && confirm(`¿Eliminar el registro de peso del ${w.date}?`)) {
      change('Peso', { ...w, deleted: true });
      fillWeightForm();
    }
  };

  $('foods').onclick = e => {
    const edit = e.target.closest('[data-edit-food]');
    if (edit) { startFoodEdit(edit.dataset.editFood); return; }
    const b = e.target.closest('[data-hide-food]');
    const f = b && db.foods.find(x => x.id === b.dataset.hideFood);
    if (f && confirm(`¿Eliminar ${f.name}? Tus registros anteriores se conservan y puedes restaurarlo desde "Eliminados".`)) {
      if (editingFoodId === f.id) resetFoodForm();
      change('Alimentos', { ...f, active: false });
    }
  };
  $('deletedFoods').onclick = e => {
    const b = e.target.closest('[data-restore-food]');
    const f = b && db.foods.find(x => x.id === b.dataset.restoreFood);
    if (f) change('Alimentos', { ...f, active: true });
  };

  $('add').onsubmit = e => {
    e.preventDefault();
    const food = db.foods.find(f => f.id === $('food').value);
    const amount = numOrNull($('amount').value);
    if (!food || !(amount > 0)) return;
    change('Registros', {
      id: newId(), date: dateKey(selectedDate), meal: $('meal').value, foodId: food.id, food: food.name,
      amount, unit: food.unit, ...macrosFor(food, amount), notes: '', deleted: false
    });
  };

  $('weightForm').onsubmit = e => {
    e.preventDefault();
    const weight = numOrNull($('weight').value);
    if (!(weight > 0)) return;
    change('Peso', {
      date: dateKey(selectedDate), weight, waist: numOrNull($('waist').value), bodyFat: numOrNull($('bodyFat').value),
      note: $('weightNote').value.trim(), deleted: false
    });
    fillWeightForm();
  };

  $('foodForm').onsubmit = e => {
    e.preventDefault();
    saveFood();
  };
  $('foodCancel').onclick = resetFoodForm;

  $('goalsForm').onsubmit = e => {
    e.preventDefault();
    const rows = CONFIG_FIELDS.map(key => ({ key, value: numOrNull($('cfg-' + key).value) }))
      .filter(r => r.value != null && r.value !== Number(db.config[r.key]))
      .map(r => ({ ...r, description: CONFIG_DESCRIPTIONS[r.key] || '' }));
    if (rows.length) change('Config', rows);
  };

  $('googleSignIn').onclick = connectGoogle;
  $('landingSignIn').onclick = connectGoogle;
  $('bannerSignIn').onclick = connectGoogle;
  $('tryLocal').onclick = startLocal;
  $('reconnect').onclick = connectGoogle;
  $('signOut').onclick = signOut;

  window.addEventListener('online', sync);
}

// ---------- Inicio ----------

GSheets.init(window.FITTRACKER_CONFIG?.googleClientId);
account = readJson(ACCOUNT_KEY);
loadStore();
if (!account) migrateLegacy();
bindEvents();
bindOnboarding();
bindTips();
bindInstall();
fillForms();
$('connPanel').open = false;
showView();
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
setStatus(idleStatus());
sync();
