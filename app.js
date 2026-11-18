'use strict';

const STORE_KEY = 'fittracker-v2';
const LEGACY_KEY = 'fittracker-v1';
const SETTINGS_KEY = 'fittracker-settings';
const MEALS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'];
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TABLES = ['Alimentos', 'Config', 'Registros', 'Peso'];
const KEY_FIELD = { Alimentos: 'id', Registros: 'id', Peso: 'date', Config: 'key' };
const MACROS = [
  { id: 'k', label: 'Calorías', unit: 'kcal', goal: 'meta_kcal' },
  { id: 'p', label: 'Proteína', unit: 'g', goal: 'meta_proteina' },
  { id: 'c', label: 'Carbohidratos', unit: 'g', goal: 'meta_carbohidratos' },
  { id: 'f', label: 'Grasas', unit: 'g', goal: 'meta_grasas' }
];
const CONFIG_FIELDS = ['meta_kcal', 'meta_proteina', 'meta_carbohidratos', 'meta_grasas', 'altura_m', 'peso_inicial_kg'];
const DEFAULT_CONFIG = { meta_kcal: 2200, meta_proteina: 160, meta_carbohidratos: 220, meta_grasas: 73, altura_m: 1.7, peso_inicial_kg: 87 };

// Debe coincidir con DEFAULT_FOODS de Code.gs. El orden importa para migrar datos v1.
// Valores por 100 g (unidad "g") o por unidad (unidad "unidad").
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
].map(([id, name, unit, k, p, c, f]) => ({ id, name, unit, k, p, c, f, active: true }));

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

let db, pending, settings;
let selectedDate = new Date();
selectedDate.setHours(12, 0, 0, 0);
let viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
const CALENDAR_KEY = 'fittracker-calendar-expanded';
let calendarExpanded = localStorage.getItem(CALENDAR_KEY) === '1';

const emptyPending = () => Object.fromEntries(TABLES.map(t => [t, {}]));
const defaultDb = () => ({ entries: [], foods: DEFAULT_FOODS.map(f => ({ ...f })), weights: [], config: { ...DEFAULT_CONFIG } });

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
  const stored = readJson(STORE_KEY);
  db = { ...defaultDb(), ...(stored?.db || {}) };
  pending = { ...emptyPending(), ...(stored?.pending || {}) };
  settings = readJson(SETTINGS_KEY) || {};
  const oldEndpoint = localStorage.getItem('fittracker-endpoint');
  if (!settings.endpoint && oldEndpoint) {
    settings = { endpoint: oldEndpoint, secret: localStorage.getItem('fittracker-secret') || '' };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.removeItem('fittracker-endpoint');
    localStorage.removeItem('fittracker-secret');
  }
}

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify({ db, pending }));
}

function upsertBy(list, field, row, remove) {
  const i = list.findIndex(x => x[field] === row[field]);
  if (remove) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = row; else list.push(row);
}

function applyRow(table, row) {
  if (table === 'Config') db.config[row.key] = row.value;
  else if (table === 'Alimentos') upsertBy(db.foods, 'id', row, false);
  else if (table === 'Registros') upsertBy(db.entries, 'id', row, row.deleted);
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

// ---------- Sincronización con Google Sheets ----------

const isConnected = () => Boolean(settings.endpoint && settings.secret);
let chain = Promise.resolve();
let flushTimer;

function serial(task) {
  chain = chain.then(task, task);
  return chain;
}

function setStatus(text) {
  $('status').textContent = text;
  $('connStatus').textContent = text;
}

function idleStatus() {
  const n = pendingCount();
  if (!isConnected()) return n ? `Modo local · ${n} cambios se subirán al conectar Google Sheets.` : 'Modo local · configura Google Sheets abajo.';
  return n ? `${n} cambios pendientes de subir.` : `Sincronizado con Google Sheets · ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
}

async function api(action, payload = {}) {
  const res = await fetch(settings.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret: settings.secret, action, ...payload })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('respuesta inválida; revisa que el acceso de la implementación sea "Cualquier persona"');
  }
  if (!data.ok) throw new Error(data.error || 'error desconocido');
  return data;
}

async function flush() {
  for (const table of TABLES) {
    const items = Object.entries(pending[table]);
    for (let i = 0; i < items.length; i += 200) {
      const chunk = items.slice(i, i + 200);
      await api('upsert', { table, records: chunk.map(([, row]) => row) });
      chunk.forEach(([key, row]) => { if (pending[table][key] === row) delete pending[table][key]; });
      persist();
    }
  }
}

async function pull() {
  const data = await api('load');
  db = {
    entries: data.entries,
    foods: data.foods.length ? data.foods : defaultDb().foods,
    weights: data.weights,
    config: { ...DEFAULT_CONFIG, ...data.config }
  };
  TABLES.forEach(t => Object.values(pending[t]).forEach(row => applyRow(t, row)));
  persist();
  fillForms();
  render();
}

function sync() {
  if (!isConnected()) { setStatus(idleStatus()); return Promise.resolve(); }
  clearTimeout(flushTimer);
  return serial(async () => {
    try {
      setStatus('Sincronizando…');
      await flush();
      await pull();
      setStatus(idleStatus());
    } catch (e) {
      setStatus(`No se pudo sincronizar: ${e.message}. ${pendingCount()} cambios pendientes guardados en este navegador.`);
    }
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
      setStatus(`Sin conexión con Google Sheets (${e.message}). ${pendingCount()} cambios pendientes.`);
    }
  }), 800);
}

// ---------- Dominio ----------

const goal = m => Number(db.config[m.goal]) || DEFAULT_CONFIG[m.goal];
const activeFoods = () => db.foods.filter(f => f.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'es'));
const entriesOn = key => db.entries.filter(e => e.date === key);

function macrosFor(food, amount) {
  const factor = food.unit === 'unidad' ? amount : amount / 100;
  return Object.fromEntries(MACROS.map(m => [m.id, round1(food[m.id] * factor)]));
}

function totals(list) {
  const t = { k: 0, p: 0, c: 0, f: 0 };
  list.forEach(e => MACROS.forEach(m => { t[m.id] += Number(e[m.id]) || 0; }));
  return t;
}

function weekKeys() {
  const dow = (selectedDate.getDay() + 6) % 7;
  return DAY_NAMES.map((_, i) => dateKey(addDays(selectedDate, i - dow)));
}

const sortedWeights = () => [...db.weights].sort((a, b) => a.date.localeCompare(b.date));

// ---------- Render ----------

function render() {
  renderHeader();
  renderCalendar();
  renderMetrics();
  renderMeals();
  renderWeek();
  renderWeights();
  renderFoods();
  renderSummaries();
}

function renderSummaries() {
  $('goalsSummary').textContent = `· ${goal(MACROS[0])} kcal · ${goal(MACROS[1])} g proteína`;
  $('connSummary').textContent = isConnected() ? '· conectado' : '· sin conectar';
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
  const dayButton = d => {
    const k = dateKey(d);
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
  }).join('');
}

function renderMeals() {
  const day = entriesOn(dateKey(selectedDate));
  $('dayLabel').textContent = selectedDate.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('meals').innerHTML = MEALS.map(meal => {
    const list = day.filter(e => e.meal === meal);
    const items = list.length
      ? list.map(e => `<div class="entry"><div>${esc(e.food)}<br><small>${esc(e.amount)} ${esc(e.unit)} · ${Math.round(e.k)} kcal · ${round1(e.p)} g proteína</small></div>` +
          `<div class="actions"><button class="secondary" data-edit="${esc(e.id)}" aria-label="Editar cantidad de ${esc(e.food)}">✎</button>` +
          `<button class="danger" data-del="${esc(e.id)}" aria-label="Eliminar ${esc(e.food)}">×</button></div></div>`).join('')
      : '<p class="muted">Sin registros</p>';
    return `<div class="meal"><div class="row"><b>${meal}</b><small>${Math.round(totals(list).k)} kcal</small></div>${items}</div>`;
  }).join('');
}

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
    `<td><button class="danger" data-hide-food="${esc(f.id)}" aria-label="Ocultar ${esc(f.name)}">Ocultar</button></td></tr>`).join('')
    : '<tr><td colspan="7" class="muted">Ningún alimento coincide con la búsqueda</td></tr>';
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
  $('endpoint').value = settings.endpoint || '';
  $('secret').value = settings.secret || '';
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

// ---------- Acciones ----------

function editEntry(id) {
  const e = db.entries.find(x => x.id === id);
  if (!e) return;
  const input = prompt(`Nueva cantidad (${e.unit}) para ${e.food}`, e.amount);
  if (input === null) return;
  const amount = numOrNull(input);
  if (!(amount > 0)) { alert('Cantidad inválida'); return; }
  const food = db.foods.find(f => f.id === e.foodId);
  const macros = food ? macrosFor(food, amount) : Object.fromEntries(MACROS.map(m => [m.id, round1(e[m.id] * amount / e.amount)]));
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
  const header = ['fecha', 'comida', 'alimento', 'cantidad', 'unidad', 'kcal', 'proteina_g', 'carbohidratos_g', 'grasas_g', 'notas'];
  const rows = [...db.entries].sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal))
    .map(e => [e.date, e.meal, e.food, e.amount, e.unit, e.k, e.p, e.c, e.f, e.notes || '']);
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
  $('copyPrev').onclick = copyPreviousDay;
  $('export').onclick = exportCsv;
  $('sync').onclick = sync;

  $('meals').onclick = e => {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
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
    const b = e.target.closest('[data-hide-food]');
    const f = b && db.foods.find(x => x.id === b.dataset.hideFood);
    if (f && confirm(`¿Ocultar ${f.name}? Los registros anteriores se conservan.`)) change('Alimentos', { ...f, active: false });
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
    const name = $('foodName').value.trim();
    if (!name) return;
    const food = {
      id: `${slug(name) || 'alimento'}-${Math.random().toString(36).slice(2, 6)}`, name, unit: $('foodUnit').value,
      k: numOrNull($('foodK').value) || 0, p: numOrNull($('foodP').value) || 0,
      c: numOrNull($('foodC').value) || 0, f: numOrNull($('foodF').value) || 0, active: true
    };
    change('Alimentos', food);
    e.target.reset();
  };

  $('goalsForm').onsubmit = e => {
    e.preventDefault();
    const rows = CONFIG_FIELDS.map(key => ({ key, value: numOrNull($('cfg-' + key).value) }))
      .filter(r => r.value != null && r.value !== Number(db.config[r.key]));
    if (rows.length) change('Config', rows);
  };

  $('settingsForm').onsubmit = e => {
    e.preventDefault();
    settings = { endpoint: $('endpoint').value.trim(), secret: $('secret').value };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    renderSummaries();
    sync();
  };

  window.addEventListener('online', sync);
}

// ---------- Inicio ----------

loadStore();
migrateLegacy();
bindEvents();
fillForms();
$('connPanel').open = !isConnected();
render();
setStatus(idleStatus());
sync();
