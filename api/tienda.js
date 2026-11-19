// Proxy sin CORS hacia el catálogo VTEX de supermercados peruanos (API no oficial).
// GET /api/tienda?ean=7751271033657 → { found, name, brand, store, quantity, per100 }
// GET /api/tienda?q=leche gloria → { results: [{ name, brand, store, ean, quantity, per100 }] }

const STORES = [
  { name: 'Plaza Vea', host: 'www.plazavea.com.pe' },
  { name: 'Wong', host: 'www.wong.pe' },
  { name: 'Metro', host: 'www.metro.pe' }
];

// Solo secciones de comida y bebida y alcohol (excluye Packs, limpieza, etc.).
const FOOD_SECTION = /^(abarrotes|frutas y verduras|congelados|quesos y fiambres|embutidos y fiambres|panader[ií]a y pasteler[ií]a|carnes, aves y pescados|l[aá]cteos( y huevos)?|desayunos?|mercado saludable|vive sano|aguas y bebidas|bebidas|vinos, licores y cervezas|cervezas, vinos y licores|pollo rostizado y comidas preparadas|comidas y rostizados)$/i;
const isFood = p => (p.categories || []).some(c => FOOD_SECTION.test(c.split('/')[1] || ''));

const first = v => (Array.isArray(v) ? v[0] : v);

// "0. 5g", "92 KCAL", "6.5 g" → { value, unit }
function parseAmount(raw) {
  const m = String(first(raw) ?? '').replace(/,/g, '.').replace(/(\d)\.\s+(\d)/g, '$1.$2').match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]*)/);
  return m ? { value: Number(m[1]), unit: m[2].toLowerCase() } : null;
}

function field(product, pattern) {
  const key = Object.keys(product).find(k => pattern.test(k));
  return key ? parseAmount(product[key]) : null;
}

function normalize(product, store) {
  const serving = field(product, /^porci[oó]n sugerida$/i);
  const per100 = {};
  // Los valores vienen por porción: solo se convierten a 100 g si la porción está en g o ml.
  if (serving && ['g', 'gr', 'ml'].includes(serving.unit) && serving.value > 0) {
    const factor = 100 / serving.value;
    const scale = a => (a ? Math.round(a.value * factor * 10) / 10 : null);
    per100.k = scale(field(product, /^calor[ií]as por porci[oó]n$/i));
    per100.p = scale(field(product, /^prote[ií]nas por porci[oó]n$/i));
    per100.c = scale(field(product, /^carbohidratos por porci[oó]n$/i));
    per100.f = scale(field(product, /^grasas (totales )?por porci[oó]n$/i));
    per100.sugar = scale(field(product, /^az[uú]cares por porci[oó]n$/i));
  }
  return {
    found: true,
    store,
    ean: product.items?.map(i => i.ean).find(Boolean) || null,
    name: product.productName,
    brand: product.brand || null,
    quantity: first(product['Contenido Neto']) || null,
    per100
  };
}

async function lookup(store, ean) {
  const url = `https://${store.host}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (FitTracker)' }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const list = await res.json();
  const match = Array.isArray(list) && list.find(p => p.items?.some(i => i.ean === ean));
  return match ? normalize(match, store.name) : null;
}

async function search(store, q) {
  const url = `https://${store.host}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=7`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (FitTracker)' }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  const list = await res.json();
  return Array.isArray(list) ? list.filter(isFood).map(p => normalize(p, store.name)) : [];
}

async function handleSearch(q, res) {
  if (q.length < 2) {
    res.status(400).json({ results: [], error: 'q muy corta' });
    return;
  }
  const groups = await Promise.all(STORES.slice(0, 2).map(s => search(s, q).catch(() => [])));
  const seen = new Set();
  const results = groups.flat().filter(r => {
    const key = r.ean || r.name.toLowerCase();
    return seen.has(key) ? false : seen.add(key);
  }).slice(0, 12);
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.status(200).json({ results });
}

module.exports = async (req, res) => {
  if (req.query?.q) return handleSearch(String(req.query.q).trim().slice(0, 60), res);
  const ean = String(req.query?.ean || '');
  if (!/^\d{8,14}$/.test(ean)) {
    res.status(400).json({ found: false, error: 'ean inválido' });
    return;
  }
  // Prefiere la tienda que traiga macros; si ninguna los trae, devuelve la primera que lo conozca.
  let fallback = null;
  for (const store of STORES) {
    const hit = await lookup(store, ean).catch(() => null);
    if (!hit) continue;
    if (hit.per100.k != null) {
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      res.status(200).json(hit);
      return;
    }
    fallback ||= hit;
  }
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.status(200).json(fallback || { found: false });
};
