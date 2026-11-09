/* Briques d'interface : vues, actions, feuilles d'édition, sections. */
import { $, esc, ICON, toast } from './util.js';
import { S, saveUI, guarded, rg } from './store.js';
import { LIENS_DEFAUT } from './config.js';

/* ---- Registres remplis par chaque onglet ---- */
export const VIEWS = new Map();      // nom → {label, icon, shell(), render(), masquable, mobile}
export const ACTIONS = new Map();    // data-action → fn(el, event)
export const INPUTS = new Map();     // id d'un champ → fn(el) à chaque frappe
export const SHEETS = new Map();     // type de feuille → {render(sh), save(sh), del(sh), field(sh, el, isChange)}
export const CHANGES = new Map();    // id d'un champ (ou « @clé » de data-change) → fn(el) quand la valeur est validée
export const SUBMITS = new Map();    // id d'un formulaire → fn(form)
export function view(name, def) { VIEWS.set(name, def); }
export function action(name, fn) { ACTIONS.set(name, fn); }
/* id d'un champ, ou « @clé » pour tous les champs portant data-input="clé" */
export function onInput(id, fn) { INPUTS.set(id, fn); }
export function onChange(id, fn) { CHANGES.set(id, fn); }
export function onSubmit(id, fn) { SUBMITS.set(id, fn); }
export function sheet(kind, def) { SHEETS.set(kind, def); }

/* Rafraîchissement : fourni par main.js */
export const hooks = { refresh: () => { }, schedule: () => { } };
export function refresh() { hooks.refresh(); }

/* ---- Réglages partagés ---- */
export function masques() { const g = rg('general'); return Array.isArray(g.ongletsMasques) ? g.ongletsMasques : []; }
export function liens() { const g = rg('general'); const L = (Array.isArray(g.liens) && g.liens.length) ? g.liens : LIENS_DEFAUT; return L.filter(l => l && /^https?:\/\//i.test(String(l.url || ''))); }
export function tabOn(name) { return VIEWS.has(name) && !masques().includes(name); }

/* ---- Feuilles d'édition (panneau du bas sur téléphone, fenêtre sur ordinateur) ---- */
export const ui = { sheet: null };
export function openSheet(obj) {
  ui.sheet = obj; renderSheet();
  document.documentElement.classList.add('sheet-open');
  setTimeout(() => { const f = $('#sheet-root [data-autofocus]'); if (f) f.focus(); }, 40);
}
export function closeSheet() { ui.sheet = null; $('#sheet-root').innerHTML = ''; document.documentElement.classList.remove('sheet-open'); }
export function renderSheet() {
  const sh = ui.sheet; if (!sh) return;
  const def = SHEETS.get(sh.kind); if (!def) return;
  const body = $('#sheet-root .sheet-body'), top = body ? body.scrollTop : 0, deja = !!$('#sheet-root .sheet');
  /* Animation d'ouverture seulement à la première apparition, pas à chaque mise à jour du contenu */
  $('#sheet-root').innerHTML = `<div class="sheet-wrap"><div class="sheet-scrim" data-action="close-sheet"></div><div class="sheet${sh.wide ? ' wide' : ''}${deja ? ' still' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${def.render(sh)}</div></div>`;
  const nb = $('#sheet-root .sheet-body'); if (nb && top) nb.scrollTop = top;
}
export function head(t) { return `<header class="sheet-head"><h2 id="sheet-title">${esc(t)}</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="Fermer">${ICON.close}</button></header>`; }
export function foot(canDel, confirmLabel, o) {
  o = o || {}; const sh = ui.sheet;
  return `<footer class="sheet-foot">${canDel ? `<button type="button" class="btn btn-danger${sh.confirmDel ? ' confirm' : ''}" data-action="sheet-delete">${sh.confirmDel ? esc(confirmLabel || 'Confirmer la suppression') : 'Supprimer'}</button>` : ''}<span class="spacer"></span><button type="button" class="btn btn-ghost" data-action="close-sheet">Annuler</button><button type="button" class="btn btn-primary" data-action="sheet-save">${esc(o.saveLabel || 'Enregistrer')}</button></footer>`;
}
async function sheetSave() {
  const sh = ui.sheet; if (!sh) return;
  const def = SHEETS.get(sh.kind); if (!def || !def.save) return;
  let msg = 'Enregistré';
  if (await guarded(async () => { const r = await def.save(sh); if (typeof r === 'string') msg = r; })) { closeSheet(); toast(msg); }
}
async function sheetDelete() {
  const sh = ui.sheet; if (!sh) return;
  if (!sh.confirmDel) { sh.confirmDel = true; renderSheet(); return; }
  const def = SHEETS.get(sh.kind); if (!def || !def.del) return;
  if (await guarded(() => def.del(sh))) { closeSheet(); toast('Supprimé'); }
}
/* Champs data-field : la valeur va dans sh.draft ; la feuille peut réagir (field) */
export function onSheetField(t, isChange) {
  const sh = ui.sheet; if (!sh) return;
  const f = t.dataset.field;
  if (f && sh.draft) {
    const d = sh.draft;
    if (t.type === 'checkbox') d[f] = t.checked;
    else if (t.type === 'number') d[f] = t.value === '' ? null : Number(t.value);
    else if (t.type === 'date' || t.type === 'time') d[f] = t.value || null;
    else d[f] = t.value;
  }
  const def = SHEETS.get(sh.kind); if (def && def.field) def.field(sh, t, isChange);
}
action('close-sheet', () => closeSheet());
action('sheet-save', () => sheetSave());
action('sheet-delete', () => sheetDelete());
/* Bouton d'un groupe segmenté : une seule valeur */
action('set-field', a => {
  const sh = ui.sheet; if (!sh) return;
  sh.draft[a.dataset.field] = a.dataset.value;
  if (a.dataset.rerender != null) { renderSheet(); return; }
  a.parentElement.querySelectorAll('[data-action="set-field"]').forEach(b => b.setAttribute('aria-pressed', String(b === a)));
  const def = SHEETS.get(sh.kind); if (def && def.field) def.field(sh, a, true);
});
/* Puce d'une liste à choix multiples */
action('toggle-in', a => {
  const sh = ui.sheet; if (!sh) return;
  const f = a.dataset.field, v = a.dataset.value;
  const arr = Array.isArray(sh.draft[f]) ? sh.draft[f] : (sh.draft[f] = []);
  const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v);
  a.setAttribute('aria-pressed', String(i < 0));
});
action('sec-toggle', a => { S.ui.open[a.dataset.key] = a.getAttribute('aria-expanded') !== 'true'; saveUI(); refresh(); });

/* ---- Sections et états ---- */
export function section(key, title, count, body, o) {
  o = o || {};
  const open = o.collapsible ? !!S.ui.open[key] : true;
  const h = o.collapsible
    ? `<h2 class="sec-h"><button type="button" class="sec-toggle" data-action="sec-toggle" data-key="${esc(key)}" aria-expanded="${open}"><span>${title}</span><span class="cnt">${count}</span><span class="chev" aria-hidden="true"></span></button></h2>`
    : `<h2 class="sec-h"><span>${title}</span>${count === '' || count == null ? '' : `<span class="cnt">${count}</span>`}${o.link ? `<a class="sec-link" href="${o.link}">${esc(o.linkLabel || 'Tout voir')}</a>` : ''}</h2>`;
  return `<section class="sec ${o.cls || ''}">${h}${open ? body : ''}</section>`;
}
export const NOTICE_OFF = '<div class="notice"><p class="empty-t">Stockage indisponible sur cet appareil</p><p>Le navigateur bloque l’enregistrement local (navigation privée ou stockage désactivé). Ouvre l’app depuis son icône.</p></div>';
export function gate(el) {
  if (!el) return false;
  if (!S.db) { el.innerHTML = S.status === 'connecting' ? '<p class="muted pad">Ouverture de tes données…</p>' : NOTICE_OFF; return false; }
  return true;
}
export function empty(title, text) { return `<div class="empty"><p class="empty-t">${title}</p>${text ? `<p>${text}</p>` : ''}</div>`; }
export function seg(action_, items, cur, label) {
  return `<div class="seg" role="group"${label ? ` aria-label="${esc(label)}"` : ''}>${items.map(([k, l]) => `<button type="button" data-action="${action_}" data-value="${esc(k)}" aria-pressed="${k === cur}">${l}</button>`).join('')}</div>`;
}
export function chipsMulti(field, items, cur) {
  return `<div class="chips" style="margin:0">${items.map(([k, l, c]) => `<button type="button" class="chip" data-action="toggle-in" data-field="${field}" data-value="${esc(k)}" aria-pressed="${(cur || []).includes(k)}" style="--c:${c || 'var(--accent)'}">${esc(l)}</button>`).join('')}</div>`;
}
