/* État de l'app : données en mémoire (copie de l'appareil), préférences d'affichage, écritures. */
import { APP, COLLS } from './config.js';
import { LocalDB } from './db.js';
import { ymd } from './dates.js';
import { clean, clone, toast, toastHook } from './util.js';

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

/* ---- Annulation ----
   Chaque geste de l'utilisateur (clic, valeur validée, envoi de formulaire) ouvre un groupe : toutes les écritures
   qui en découlent sont annulées ensemble. On garde l'état d'avant de chaque fiche touchée.
   La synchronisation n'écrit pas par ici : ce qu'elle apporte n'est jamais annulé. */
const UNDO_MAX = 30, UNDO_FENETRE = 10000;
export const UNDO = { stack: [], seq: 0, at: 0, restoring: false };
export function userAct() { UNDO.seq++; UNDO.at = Date.now(); }
function record(c, id) {
  if (UNDO.restoring || !UNDO.seq || Date.now() - UNDO.at > UNDO_FENETRE) return;
  let g = UNDO.stack[UNDO.stack.length - 1];
  if (!g || g.seq !== UNDO.seq) { g = { seq: UNDO.seq, recs: new Map(), label: '' }; UNDO.stack.push(g); if (UNDO.stack.length > UNDO_MAX) UNDO.stack.shift(); }
  const k = c + '/' + id; if (!g.recs.has(k)) g.recs.set(k, { c, id, prev: clone(LocalDB.get(c, id)) });
}
/* Le message affiché après l'action la nomme ; les messages trop vagues sont précisés. */
const LIBELLES = { 'Fait': 'tâche cochée', 'Rouverte': 'tâche rouverte', 'Enregistré': 'modification', 'Supprimé': 'suppression' };
function libelle(msg) { msg = String(msg || ''); if (/^Fait\. Prochaine fois/.test(msg)) return 'tâche cochée'; return LIBELLES[msg] || msg.charAt(0).toLowerCase() + msg.slice(1); }
export const undoHook = { changed: () => { } };
toastHook.fn = (msg, kind) => { const g = UNDO.stack[UNDO.stack.length - 1]; if (g && g.seq === UNDO.seq && kind !== 'err') { g.label = libelle(msg); undoHook.changed(); } };
export function undoLabel() { const g = UNDO.stack[UNDO.stack.length - 1]; return g ? (g.label || 'dernière action') : ''; }
/* Remet chaque fiche du dernier groupe dans son état d'avant ; renvoie le libellé de l'action annulée. */
export async function undo() {
  const g = UNDO.stack[UNDO.stack.length - 1]; if (!g) return null;
  if (!S.db) throw { code: 'offline' };
  UNDO.restoring = true;
  try {
    for (const r of Array.from(g.recs.values()).reverse()) {
      if (r.prev == null && LocalDB.get(r.c, r.id) == null) continue;
      await LocalDB.local(r.c, r.id, r.prev, r.prev == null);
    }
  } finally { UNDO.restoring = false; }
  UNDO.stack.pop();
  return g.label || 'dernière action';
}

/* Écriture */
export async function put(c, id, data) { if (!S.db) throw { code: 'offline' }; record(c, String(id)); await LocalDB.local(c, String(id), clean(data), false); }
export async function patch(c, id, data) { if (!S.db) throw { code: 'offline' }; record(c, String(id)); const cur = LocalDB.get(c, String(id)) || {}; await LocalDB.local(c, String(id), Object.assign({}, cur, clean(data)), false); }
export async function remove(c, id) { if (!S.db) throw { code: 'offline' }; record(c, String(id)); await LocalDB.local(c, String(id), null, true); }

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
