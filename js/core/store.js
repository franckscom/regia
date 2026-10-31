/* État de l'app : données en mémoire (copie de l'appareil), préférences d'affichage, écritures. */
import { APP, COLLS } from './config.js';
import { LocalDB } from './db.js';
import { ymd } from './dates.js';
import { clean, toast } from './util.js';

function loadUI() { try { const v = JSON.parse(localStorage.getItem(APP.uiKey) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; } }

export const S = {
  db: null, status: 'connecting', today: ymd(new Date()), view: 'aujourdhui',
  data: {}, sel: new Set(), q: '', rq: '', nq: '', syncDraft: null, swReg: null, ganttCenter: true,
  ui: Object.assign({
    zoom: '3mois', planMode: 'gantt', hidden: [], showDone: false, open: {}, filtre: 'actives', lastDom: null, reuCats: [],
    notesMode: 'trier', carnetType: 'tous', contMode: 'calendrier', contComptes: [], exoDate: null
  }, loadUI())
};
for (const k of ['hidden', 'reuCats', 'contComptes']) if (!Array.isArray(S.ui[k])) S.ui[k] = [];
if (!S.ui.open || typeof S.ui.open !== 'object') S.ui.open = {};
for (const c of COLLS) S.data[c] = new Map();

export function saveUI() { try { localStorage.setItem(APP.uiKey, JSON.stringify(S.ui)); } catch (e) { } }

/* Lecture */
export function list(c) { return Array.from(S.data[c].values()); }
export function get(c, id) { return (id != null && S.data[c].get(String(id))) || null; }
export function rg(id) { return S.data.reglages.get(id) || {}; }
export function rebuild(cols) { for (const c of cols) if (S.data[c]) S.data[c] = new Map(LocalDB.all(c).map(r => [r.id, r])); }

/* Écriture */
export async function put(c, id, data) { if (!S.db) throw { code: 'offline' }; await LocalDB.local(c, String(id), clean(data), false); }
export async function patch(c, id, data) { if (!S.db) throw { code: 'offline' }; const cur = LocalDB.get(c, String(id)) || {}; await LocalDB.local(c, String(id), Object.assign({}, cur, clean(data)), false); }
export async function remove(c, id) { if (!S.db) throw { code: 'offline' }; await LocalDB.local(c, String(id), null, true); }

export function errMsg(e) {
  const c = e && e.code;
  if (c === 'form') return e.message;
  if (c === 'offline') return 'Stockage indisponible sur cet appareil : ouvre l’app installée (pas en navigation privée).';
  if (e && e.name === 'QuotaExceededError') return 'Espace plein : supprime des éléments terminés, puis réessaie.';
  return 'Enregistrement impossible pour le moment. Réessaie dans un instant.';
}
export async function guarded(fn) {
  try { await fn(); return true; }
  catch (e) { console.warn(e); toast(errMsg(e), 'err'); return false; }
}
