/* Tâches : données, liste par domaine, éditeur avec rétroplanning, modèles de rétroplanning. */
import { S, list, get, put, patch, remove, saveUI, guarded } from '../core/store.js';
import { $, esc, clone, opts, newId, toast, ICON, linksHTML, textLinks } from '../core/util.js';
import { isDate, addDays, addMonths, diff, fShort } from '../core/dates.js';
import { STATUTS, PRIORITES, RECURRENCES, TACHE_DEFAUT, color } from '../core/config.js';
import { view, action, onInput, sheet, openSheet, renderSheet, ui, head, foot, gate, empty, liens, refresh, onChange, chipsMulti } from '../core/ui.js';

/* ---- Données ---- */
export function tasks() { return list('taches'); }
export function domList(withArchived) { return list('domaines').filter(d => withArchived || !d.archive).sort((a, b) => ((a.ordre ?? 99) - (b.ordre ?? 99)) || String(a.nom).localeCompare(String(b.nom), 'fr')); }
export function dom(id) { return get('domaines', id) || { id: id || '', nom: 'Sans domaine', couleur: 'ardoise', archive: false, _missing: true }; }
export function domColor(d) { return color(d.couleur); }
export function childrenOf(id) { return tasks().filter(t => t.parentId === id); }
export function parentOf(t) { return (t && t.parentId) ? get('taches', t.parentId) : null; }
export function isTop(t) { return !t.parentId || !S.data.taches.has(t.parentId); }
/* Date effective : une étape de rétroplanning se cale sur l'échéance de sa tâche principale (offset en jours). */
export function dueOf(t) {
  if (!t) return null;
  if (t.parentId && typeof t.offset === 'number') { const p = parentOf(t); return (p && !p.aConfirmer && isDate(p.echeance)) ? addDays(p.echeance, t.offset) : null; }
  return (!t.aConfirmer && isDate(t.echeance)) ? t.echeance : null;
}
export function visible(t) { const d = S.data.domaines.get(t.domaine); return !(d && d.archive); }

/* ---- Priorité ---- */
/* Celle de la tâche ; une étape de rétroplanning restée « normale » prend celle de sa tâche principale. */
export function prioOf(t) {
  if (!t) return 'normale';
  const own = t.priorite || 'normale'; if (own !== 'normale') return own;
  const p = parentOf(t); return (p && p.priorite) || 'normale';
}
export function prioRank(t, own) { const p = own ? (t.priorite || 'normale') : prioOf(t); return p === 'haute' ? 0 : (p === 'basse' ? 2 : 1); }
const PRIO_SVG = {
  haute: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 10.5V2M2.5 5.5L6 2l3.5 3.5"/></svg>',
  basse: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 1.5V10M2.5 6.5L6 10l3.5-3.5"/></svg>'
};
export function prioIcon(p) { return PRIO_SVG[p] || ''; }
/* Pastille « Priorité haute » ou « Priorité basse » (rien pour « normale »). own : ignorer la priorité héritée. */
export function prioBadge(t, own) {
  const p = own ? (t.priorite || 'normale') : prioOf(t);
  return PRIO_SVG[p] ? `<span class="pb pb-${p}">${PRIO_SVG[p]}Priorité ${p}</span>` : '';
}

/* ---- Ordre d'insertion ----
   planifieMs : moment (ms) où la tâche a reçu sa date ; enregistré à la création et à chaque changement de date.
   Tâches plus anciennes : heure de création lue dans l'identifiant (t-<horodatage>…, t-claude-AAAAMMJJHHMM-xx), sinon creeLe. */
const ID_MIN = new Date(2026, 0, 1).getTime();
function idMs(id) {
  const s = String(id || '');
  let m = /^[a-z]+-([0-9a-z]{8})[0-9a-z]{0,4}$/.exec(s);
  if (m) { const n = parseInt(m[1], 36); if (n >= ID_MIN && n <= Date.now() + 864e5) return n; }
  m = /-claude-(\d{4})(\d{2})(\d{2})-?(\d{2})(\d{2})(?!\d)/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : 0;
}
function jourMs(s) { const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime() : 0; }
/* Une étape calée sur sa tâche principale est reprogrammée en même temps qu'elle. */
export function planifMs(t) {
  if (!t) return 0;
  const own = Number(t.planifieMs) || idMs(t.id) || jourMs(t.creeLe);
  if (t.parentId && typeof t.offset === 'number') { const p = parentOf(t); if (p) return Math.max(own, Number(p.planifieMs) || 0); }
  return own;
}
/* Tâches d'un même jour : priorité (haute, normale, basse), puis la dernière programmée en haut. */
export function byPrio(a, b) { return (prioRank(a) - prioRank(b)) || (planifMs(b) - planifMs(a)) || String(a.titre).localeCompare(String(b.titre), 'fr'); }
export function byDue(a, b) { const x = dueOf(a), y = dueOf(b); if (x !== y) { if (!x) return 1; if (!y) return -1; return x < y ? -1 : 1; } return byPrio(a, b); }
export function jTxt(o) { o = Number(o) || 0; return o < 0 ? 'J-' + (-o) : (o > 0 ? 'J+' + o : 'Jour J'); }

/* ---- Lignes ---- */
export function dueBits(t) {
  const d = dueOf(t);
  if (!d) return t.aConfirmer ? '<span class="tag tag-q">date à confirmer</span>' : '';
  const n = diff(S.today, d);
  let j = '';
  if (t.statut !== 'fait') {
    if (n < 0) j = `<span class="tag tag-late">retard ${-n} j</span>`;
    else if (n === 0) j = '<span class="tag tag-today">aujourd’hui</span>';
    else if (n === 1) j = '<span class="tag">demain</span>';
    else j = `<span class="tag">J-${n}</span>`;
  }
  return j + `<span class="date">${esc(fShort(d))}</span>`;
}
/* o.noDom : sans le domaine ; o.noParent : sous sa tâche principale (priorité propre seulement) ; o.noDue : la section donne déjà le jour */
export function taskRow(t, o) {
  o = o || {};
  const d = dom(t.domaine), p = parentOf(t), kids = childrenOf(t.id);
  const done = t.statut === 'fait', due = dueOf(t), late = !done && due && due < S.today;
  const meta = [];
  const pb = done ? '' : prioBadge(t, !!o.noParent); if (pb) meta.push(pb);
  if (!o.noDom) meta.push(`<span class="dom" style="--c:${domColor(d)}">${esc(d.nom)}</span>`);
  if (p && !o.noParent) meta.push(`<span>› ${esc(p.titre)}</span>`);
  if (t.statut === 'en_cours') meta.push('<span class="st st-cours">en cours</span>');
  if (t.statut === 'attente') meta.push('<span class="st st-att">en attente</span>');
  const db = o.noDue ? '' : dueBits(t); if (db) meta.push(`<span class="due">${db}</span>`);
  if (kids.length) meta.push(`<span class="mini">${kids.filter(k => k.statut === 'fait').length}/${kids.length} étapes</span>`);
  if (t.recurrence && t.recurrence !== 'aucune') meta.push(`<span class="mini">↻ ${t.recurrence === 'hebdo' ? 'chaque semaine' : 'chaque mois'}</span>`);
  if (t.notes) meta.push(`<span class="mini">${textLinks(t.notes).length ? 'notes et liens' : 'notes'}</span>`);
  return `<div class="row${late ? ' is-late' : ''}${done ? ' is-done' : ''}"><button type="button" class="check" data-action="toggle" data-id="${esc(t.id)}" aria-pressed="${done}" aria-label="${done ? 'Rouvrir' : 'Marquer comme fait'} : ${esc(t.titre)}"></button><button type="button" class="row-main" data-action="edit" data-id="${esc(t.id)}"><span class="row-title">${t.jalon ? '<span class="jal" aria-label="Jalon">◆</span> ' : ''}${esc(t.titre)}</span>${meta.length ? `<span class="row-meta">${meta.join('')}</span>` : ''}</button><span class="row-end">${done ? '' : `<label class="resched" title="Reprogrammer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M12 13v4M10 15h4"/></svg><input type="date" class="resched-in" data-action="resched-pick" data-change="resched" data-id="${esc(t.id)}" value="${esc(due || '')}" aria-label="Reprogrammer : ${esc(t.titre)}"></label>`}</span></div>`;
}
export function fillDomSelect(sel) {
  if (!sel) return;
  const doms = domList(false);
  const html = doms.map(d => `<option value="${esc(d.id)}">${esc(d.nom)}</option>`).join('') || '<option value="">Aucun domaine</option>';
  const cur = sel.value || S.ui.lastDom || '';
  if (sel._sig !== html) { sel.innerHTML = html; sel._sig = html; }
  if (doms.some(d => d.id === cur)) sel.value = cur;
}
export function domOptions(cur) {
  const L = domList(false);
  if (cur && !L.some(d => d.id === cur) && S.data.domaines.has(cur)) L.push(get('domaines', cur));
  return L.map(d => `<option value="${esc(d.id)}"${d.id === cur ? ' selected' : ''}>${esc(d.nom)}${d.archive ? ' (archivé)' : ''}</option>`).join('');
}

/* ---- Écritures ---- */
export async function toggleTask(id) {
  const t = get('taches', id); if (!t) return;
  const done = t.statut !== 'fait';
  await patch('taches', id, { statut: done ? 'fait' : 'a_faire', faitLe: done ? S.today : null });
  if (done && t.recurrence && t.recurrence !== 'aucune' && isTop(t) && !(t.suivanteId && S.data.taches.has(t.suivanteId))) {
    const base = dueOf(t) || S.today;
    const step = d => t.recurrence === 'hebdo' ? addDays(d, 7) : addMonths(d, 1);
    let next = step(base); let guard = 0; while (next <= S.today && guard++ < 500) next = step(next);
    const nid = newId('t');
    const body = Object.assign(clone(t), { statut: 'a_faire', faitLe: null, echeance: next, aConfirmer: false, debut: isDate(t.debut) ? addDays(t.debut, diff(base, next)) : null, creeLe: S.today, planifieMs: Date.now() });
    delete body.suivanteId; delete body.id;
    await put('taches', nid, body);
    await patch('taches', id, { suivanteId: nid });
    toast('Fait. Prochaine fois : ' + fShort(next));
    return;
  }
  toast(done ? 'Fait' : 'Rouverte');
}
/* Reprogrammer une tâche à une date (pour une étape calée sur son projet, on décale son écart) */
export async function reprogrammer(id, date) {
  const t = get('taches', id); if (!t || !isDate(date)) return;
  const p = parentOf(t);
  const planifieMs = Date.now();
  if (t.parentId && typeof t.offset === 'number' && p && !p.aConfirmer && isDate(p.echeance)) await patch('taches', id, { offset: diff(p.echeance, date), planifieMs });
  else await patch('taches', id, { echeance: date, aConfirmer: false, planifieMs });
  toast(date === addDays(S.today, 1) ? 'Reportée à demain' : 'Reprogrammée au ' + fShort(date));
}
action('resched-pick', a => { try { if (a.showPicker) a.showPicker(); } catch (e) { } });
onChange('@resched', el => { if (el.value) guarded(() => reprogrammer(el.dataset.id, el.value)); });
/* ---- Modèles : suggestion selon le domaine ---- */
export function modelesTries(domaine) {
  const all = list('modeles').sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
  const sug = all.filter(m => Array.isArray(m.domaines) && m.domaines.includes(domaine));
  return { sug, autres: all.filter(m => !sug.includes(m)) };
}
/* Options d'un menu de modèles : suggérés pour le domaine d'abord. vide = libellé de l'option « aucun » (ou null) */
export function modeleOptions(domaine, cur, vide) {
  const { sug, autres } = modelesTries(domaine), o = m => `<option value="${esc(m.id)}"${m.id === cur ? ' selected' : ''}>${esc(m.nom)}</option>`;
  return (vide ? `<option value="">${esc(vide)}</option>` : '') + (sug.length ? `<optgroup label="Suggérés pour ce domaine">${sug.map(o).join('')}</optgroup>` : '') + (autres.length ? `<optgroup label="${sug.length ? 'Autres modèles' : 'Modèles'}">${autres.map(o).join('')}</optgroup>` : '');
}
function etapesDe(m) { return (m && Array.isArray(m.etapes) ? m.etapes : []).map(e => ({ titre: String(e.titre || 'Étape'), offset: Number(e.offset) || 0 })); }
/* Création depuis une autre vue (tri d'une note, saisie rapide) */
export async function createTask(fields) {
  const id = newId('t');
  const modele = fields._modele ? get('modeles', fields._modele) : null, planifieMs = Date.now();
  await put('taches', id, Object.assign(clone(TACHE_DEFAUT), { creeLe: S.today, planifieMs }, fields));
  for (const e of etapesDe(modele)) await put('taches', newId('t'), Object.assign(clone(TACHE_DEFAUT), { creeLe: S.today, planifieMs, titre: e.titre, domaine: fields.domaine || '', parentId: id, offset: e.offset }));
  return id;
}

/* ---- Vue Tâches ---- */
const FILTRES = [['actives', 'Actives'], ['sansdate', 'Sans date'], ['attente', 'En attente'], ['fait', 'Faites'], ['toutes', 'Toutes']];
function renderTasks() {
  const el = $('#v-tasks'), fb = $('#tk-filtres');
  if (fb) fb.innerHTML = FILTRES.map(([k, l]) => `<button type="button" data-action="filtre" data-value="${k}" aria-pressed="${S.ui.filtre === k}">${l}</button>`).join('');
  if (!gate(el)) return;
  const all = tasks(), actives = all.filter(t => t.statut !== 'fait');
  const sub = $('#tk-sub'); if (sub) sub.textContent = `${actives.length} active${actives.length > 1 ? 's' : ''} · ${actives.filter(t => !dueOf(t)).length} sans date`;
  const F = S.ui.filtre, q = S.q.trim().toLowerCase();
  const okS = t => F === 'toutes' ? true : F === 'fait' ? t.statut === 'fait' : F === 'attente' ? t.statut === 'attente' : F === 'sansdate' ? (t.statut !== 'fait' && !dueOf(t)) : t.statut !== 'fait';
  const okQ = t => !q || (String(t.titre) + ' ' + String(t.notes || '')).toLowerCase().includes(q);
  const groups = domList(true).map(d => ({ d, tops: all.filter(t => isTop(t) && t.domaine === d.id) }));
  const orph = all.filter(t => isTop(t) && !S.data.domaines.has(t.domaine)); if (orph.length) groups.push({ d: dom(''), tops: orph });
  const filtering = !!q || F !== 'actives';
  let h = '';
  for (const g of groups) {
    const d = g.d, blocks = []; let n = 0;
    const sorted = g.tops.slice().sort((a, b) => ((a.statut === 'fait') - (b.statut === 'fait')) || byDue(a, b));
    for (const t of sorted) {
      const kids = childrenOf(t.id).sort(byDue).filter(k => okS(k) && okQ(k));
      const self = okS(t) && okQ(t);
      if (!self && !kids.length) continue;
      n += 1 + kids.length;
      blocks.push(taskRow(t, { noDom: true }));
      if (kids.length) blocks.push(`<div class="kids">${kids.map(k => taskRow(k, { noDom: true, noParent: true })).join('')}</div>`);
    }
    if (!blocks.length && (filtering || d.archive)) continue;
    const key = 'dom:' + (d.id || 'aucun');
    const open = (key in S.ui.open) ? !!S.ui.open[key] : !d.archive;
    h += `<section class="dsec" style="--c:${domColor(d)}"><div class="dsec-h"><button type="button" class="dsec-t" data-action="sec-toggle" data-key="${esc(key)}" aria-expanded="${open}"><span class="sq"></span><span class="dsec-n">${esc(d.nom)}${d.archive ? ' <span class="muted">(archivé)</span>' : ''}</span><span class="cnt">${n}</span><span class="chev" aria-hidden="true"></span></button>${d._missing ? '' : `<button type="button" class="btn btn-sm" data-action="new-task" data-domaine="${esc(d.id)}">+ Ajouter</button>`}</div>${open ? (blocks.join('') || '<p class="empty-line">Rien ici pour l’instant.</p>') : ''}</section>`;
  }
  if (!h) h = filtering ? empty('Aucune tâche ne correspond.', 'Change de filtre ou efface la recherche.') : empty('Aucun domaine pour l’instant.', 'Crée-en un dans les Réglages pour ranger tes tâches.');
  el.innerHTML = h;
}
view('taches', {
  label: 'Tâches', masquable: true,
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.8 6.6l1.3 1.3 2.5-2.7M3.8 12.1l1.3 1.3 2.5-2.7M3.8 17.6l1.3 1.3 2.5-2.7"/></svg>',
  shell: () => `<div class="v-head v-head-row"><div><h1><span class="hl">Tâches</span></h1><p class="v-sub" id="tk-sub"></p></div><button type="button" class="btn btn-primary" data-action="new-task">+ Nouvelle tâche</button></div>
    <div class="tk-tools"><input id="tk-search" type="search" placeholder="Rechercher une tâche…" aria-label="Rechercher une tâche" value="${esc(S.q)}"><div class="seg" id="tk-filtres" role="group" aria-label="Filtrer"></div></div><div id="v-tasks"></div>`,
  render: renderTasks
});
onInput('tk-search', el => { S.q = el.value; renderTasks(); });
action('filtre', a => { S.ui.filtre = a.dataset.value; saveUI(); refresh(); });
action('toggle', a => guarded(() => toggleTask(a.dataset.id)));
action('edit', a => openTaskEditor(a.dataset.id));
action('new-task', a => openTaskEditor(null, { domaine: a.dataset.domaine }));

/* ---- Éditeur de tâche ---- */
export function openTaskEditor(id, preset) {
  preset = preset || {};
  const t = id ? get('taches', id) : null;
  if (id && !t) { toast('Cette tâche n’existe plus.', 'err'); return; }
  const draft = t ? clone(t) : Object.assign(clone(TACHE_DEFAUT), { titre: preset.titre || '', notes: preset.notes || '', domaine: preset.domaine || S.ui.lastDom || ((domList(false)[0] || {}).id) || '', echeance: preset.echeance || null });
  draft.id = t ? t.id : null;
  const steps = (t && isTop(t)) ? childrenOf(t.id).map(c => ({ id: c.id, titre: c.titre, offset: (typeof c.offset === 'number') ? c.offset : null, echeance: c.echeance || null, statut: c.statut || 'a_faire', faitLe: c.faitLe || null })) : [];
  openSheet({ kind: 'task', draft, steps, isNew: !t });
}
function parentDueDraft() { const d = ui.sheet.draft; return (!d.aConfirmer && isDate(d.echeance)) ? d.echeance : null; }
function stepsHTML() {
  const sh = ui.sheet, pd = parentDueDraft();
  const items = sh.steps.map((s, i) => ({ s, i })).filter(o => !o.s._del);
  if (!items.length) return '<p class="hint">Aucune étape. Ajoute-en une ou applique un modèle.</p>';
  const key = s => typeof s.offset === 'number' ? s.offset : ((pd && isDate(s.echeance)) ? diff(pd, s.echeance) : -100000);
  items.sort((a, b) => key(a.s) - key(b.s));
  return items.map(({ s, i }) => {
    const date = typeof s.offset === 'number' ? (pd ? addDays(pd, s.offset) : null) : (isDate(s.echeance) ? s.echeance : null);
    const done = s.statut === 'fait';
    const jctl = typeof s.offset === 'number'
      ? `<label class="s-j"><span>J−</span><input id="s-j-${i}" type="number" inputmode="numeric" data-sfield="jbefore" data-i="${i}" value="${-s.offset}" aria-label="Jours avant l’échéance"></label>`
      : `<input class="s-d" id="s-d-${i}" type="date" data-sfield="echeance" data-i="${i}" value="${s.echeance || ''}" aria-label="Date de l’étape">`;
    return `<div class="srow${done ? ' is-done' : ''}"><button type="button" class="check sm" data-action="step-toggle" data-i="${i}" aria-pressed="${done}" aria-label="${done ? 'Rouvrir l’étape' : 'Marquer l’étape comme faite'}"></button><input class="s-t" id="s-t-${i}" data-sfield="titre" data-i="${i}" value="${esc(s.titre)}" aria-label="Intitulé de l’étape">${jctl}<span class="s-date">${date ? esc(fShort(date)) : (typeof s.offset === 'number' ? 'date à venir' : 'sans date')}</span><button type="button" class="icon-btn sm" data-action="step-del" data-i="${i}" aria-label="Retirer l’étape">${ICON.close}</button></div>`;
  }).join('');
}
function modeleStepsHTML() {
  const items = ui.sheet.steps.map((s, i) => ({ s, i })).filter(o => !o.s._del).sort((a, b) => a.s.offset - b.s.offset);
  if (!items.length) return '<p class="hint">Aucune étape pour l’instant.</p>';
  return items.map(({ s, i }) => `<div class="srow srow-m"><input class="s-t" id="m-t-${i}" data-sfield="titre" data-i="${i}" value="${esc(s.titre)}" aria-label="Intitulé de l’étape"><label class="s-j"><span>J−</span><input id="m-j-${i}" type="number" inputmode="numeric" data-sfield="jbefore" data-i="${i}" value="${-s.offset}" aria-label="Jours avant l’échéance"></label><button type="button" class="icon-btn sm" data-action="step-del" data-i="${i}" aria-label="Retirer l’étape">${ICON.close}</button></div>`).join('');
}
function renderSteps() { const box = $('#sheet-steps'); if (box) box.innerHTML = ui.sheet.kind === 'modele' ? modeleStepsHTML() : stepsHTML(); }
function sheetTask(sh) {
  const d = sh.draft, isStep = !!d.parentId, parent = isStep ? get('taches', d.parentId) : null;
  const title = sh.isNew ? 'Nouvelle tâche' : (isStep ? 'Étape du rétroplanning' : 'Tâche');
  let h = head(title) + '<div class="sheet-body">';
  h += `<label class="fld"><span class="fld-l">Intitulé</span><textarea id="f-titre" rows="2" data-field="titre"${sh.isNew ? ' data-autofocus' : ''}>${esc(d.titre)}</textarea></label>`;
  if (isStep) h += `<p class="hint">Étape de <button type="button" class="linkbtn" data-action="edit" data-id="${esc(d.parentId)}">${esc(parent ? parent.titre : 'une tâche supprimée')}</button></p>`;
  else h += `<div class="fld-row"><label class="fld"><span class="fld-l">Domaine</span><select id="f-dom" data-field="domaine">${domOptions(d.domaine)}</select></label><label class="fld"><span class="fld-l">Priorité</span><select id="f-prio" data-field="priorite">${opts(PRIORITES, d.priorite)}</select></label></div>`;
  h += `<fieldset class="fld"><legend class="fld-l">Statut</legend><div class="seg">${STATUTS.map(([k, l]) => `<button type="button" data-action="set-field" data-field="statut" data-value="${k}" aria-pressed="${d.statut === k}">${l}</button>`).join('')}</div></fieldset>`;
  if (isStep && typeof d.offset === 'number') {
    const pd = parent ? dueOf(parent) : null;
    h += `<div class="fld"><span class="fld-l">Position dans le rétroplanning</span><div class="jrow"><span class="jpre">J−</span><input id="f-jb" type="number" inputmode="numeric" data-field="jbefore" value="${-d.offset}" aria-label="Jours avant l’échéance"><span class="jcalc" id="f-jcalc">${pd ? esc(fShort(addDays(pd, d.offset))) : 'date calculée dès que l’échéance sera fixée'}</span></div><p class="hint">Nombre de jours avant l’échéance de la tâche principale (nombre négatif : après).</p></div>`;
  } else {
    h += `<div class="fld-row"><label class="fld"><span class="fld-l">Échéance</span><input id="f-ech" type="date" data-field="echeance" value="${d.echeance || ''}"${d.aConfirmer ? ' disabled' : ''}></label>${isStep ? '' : (sh.isNew && list('modeles').length ? `<label class="fld"><span class="fld-l">Modèle de rétroplanning</span><select id="f-mod-new">${modeleOptions(d.domaine, sh.modele || '', 'Aucun modèle')}</select></label>` : `<label class="fld"><span class="fld-l">Début (barre du Gantt)</span><input id="f-deb" type="date" data-field="debut" value="${d.debut || ''}"></label>`)}</div>`;
    h += `<div class="checks"><label class="ck"><input id="f-aconf" type="checkbox" data-field="aConfirmer"${d.aConfirmer ? ' checked' : ''}>Date à confirmer</label>${isStep ? '' : `<label class="ck"><input id="f-jal" type="checkbox" data-field="jalon"${d.jalon ? ' checked' : ''}>Jalon important</label>`}</div>`;
  }
  if (!isStep) h += `<label class="fld"><span class="fld-l">Récurrence</span><select id="f-rec" data-field="recurrence">${opts(RECURRENCES, d.recurrence || 'aucune')}</select></label>`;
  h += `<label class="fld"><span class="fld-l">Notes</span><textarea id="f-notes" rows="3" data-field="notes">${esc(d.notes || '')}</textarea></label>${linksHTML(d.notes, 'f-links', liens())}`;
  if (!isStep) {
    const mods = list('modeles').sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
    h += `<section class="retro" aria-labelledby="retro-h"><h3 id="retro-h">Rétroplanning</h3><p class="hint">Les étapes se calent sur l’échéance : si elle bouge, tout le rétroplanning suit.</p><div id="sheet-steps">${stepsHTML()}</div>
      <div class="retro-add"><input id="f-st-t" placeholder="Nouvelle étape" aria-label="Nouvelle étape"><label class="s-j"><span>J−</span><input id="f-st-j" type="number" inputmode="numeric" value="7" aria-label="Jours avant l’échéance"></label><button type="button" class="btn btn-sm" data-action="step-add">Ajouter</button></div>
      ${mods.length && !sh.isNew ? `<div class="retro-model"><select id="f-model" aria-label="Modèle de rétroplanning">${modeleOptions(d.domaine, '', null)}</select><button type="button" class="btn btn-sm" data-action="step-model">Appliquer le modèle</button></div>` : ''}</section>`;
  }
  h += '</div>';
  const nKids = sh.steps.filter(s => s.id).length;
  h += foot(!sh.isNew, nKids ? `Supprimer avec ses ${nKids} étapes` : 'Confirmer la suppression');
  return h;
}
async function saveTask(sh) {
  const d = sh.draft, titre = String(d.titre || '').trim();
  if (!titre) throw { code: 'form', message: 'Donne un intitulé à la tâche.' };
  const old = d.id ? get('taches', d.id) : null, id = d.id || newId('t');
  const isStep = !!d.parentId, parent = isStep ? get('taches', d.parentId) : null;
  const body = {
    titre, domaine: (isStep && parent) ? parent.domaine : (d.domaine || ''), statut: d.statut || 'a_faire', priorite: d.priorite || 'normale',
    echeance: isDate(d.echeance) ? d.echeance : null, debut: isDate(d.debut) ? d.debut : null,
    aConfirmer: !!d.aConfirmer, jalon: !!d.jalon, recurrence: d.recurrence || 'aucune', notes: String(d.notes || ''),
    parentId: d.parentId || null, offset: (typeof d.offset === 'number' && isFinite(d.offset)) ? d.offset : null,
    creeLe: (old && old.creeLe) || S.today, faitLe: d.statut === 'fait' ? ((old && old.faitLe) || S.today) : null
  };
  if (old && old.suivanteId) body.suivanteId = old.suivanteId;
  if (old && old.source) body.source = old.source;
  /* Nouvelle date (ou nouvelle tâche) : elle passe en tête des tâches du même jour */
  const now = Date.now();
  if (!old || dueOf(Object.assign({ id }, body)) !== dueOf(old)) body.planifieMs = now;
  else if (old.planifieMs) body.planifieMs = old.planifieMs;
  await put('taches', id, body);
  if (!isStep) {
    for (const s of sh.steps) {
      if (s._del) { if (s.id) await remove('taches', s.id); continue; }
      const sb = { titre: String(s.titre || '').trim() || 'Étape', statut: s.statut || 'a_faire', domaine: body.domaine, offset: (typeof s.offset === 'number') ? s.offset : null, echeance: isDate(s.echeance) ? s.echeance : null, faitLe: s.statut === 'fait' ? (s.faitLe || S.today) : null };
      if (s.id) {
        const prev = get('taches', s.id); if (!prev) continue;
        if (['offset', 'echeance'].some(k => (prev[k] ?? null) !== (sb[k] ?? null))) sb.planifieMs = now;
        if (['titre', 'statut', 'domaine', 'offset', 'echeance', 'faitLe'].some(k => (prev[k] ?? null) !== (sb[k] ?? null))) await patch('taches', s.id, sb);
      }
      else await put('taches', newId('t'), Object.assign(clone(TACHE_DEFAUT), sb, { parentId: id, creeLe: S.today, planifieMs: now }));
    }
  }
  S.ui.lastDom = body.domaine; saveUI();
}
async function deleteTask(sh) { const d = sh.draft; if (!d.id) return; for (const c of childrenOf(d.id)) await remove('taches', c.id); await remove('taches', d.id); }
function taskField(sh, t, isChange) {
  const f = t.dataset.field, sf = t.dataset.sfield, d = sh.draft;
  if (f === 'jbefore') { const v = Number(t.value); d.offset = isFinite(v) ? -Math.round(v) : 0; const p = parentOf(d), pd = p ? dueOf(p) : null, lb = $('#f-jcalc'); if (lb && pd) lb.textContent = fShort(addDays(pd, d.offset)); }
  if (isChange && (f === 'echeance' || f === 'aConfirmer')) { const ech = $('#f-ech'); if (ech) ech.disabled = !!d.aConfirmer; renderSteps(); }
  if (isChange && f === 'domaine') {
    const nm = $('#f-mod-new'); if (nm) nm.innerHTML = modeleOptions(d.domaine, sh.modele || '', 'Aucun modèle');
    const am = $('#f-model'); if (am) am.innerHTML = modeleOptions(d.domaine, '', null);
  }
  if (isChange && t.id === 'f-mod-new') {
    sh.steps = sh.steps.filter(x => !x._modele);
    sh.modele = t.value || '';
    for (const e of etapesDe(get('modeles', sh.modele))) sh.steps.push({ id: null, titre: e.titre, offset: e.offset, echeance: null, statut: 'a_faire', _modele: true });
    renderSteps();
    if (sh.modele && !parentDueDraft()) toast('Modèle appliqué : fixe l’échéance pour dater les étapes');
  }
  if (isChange && f === 'notes') { const box = $('#f-links'); if (box) box.outerHTML = linksHTML(d.notes, 'f-links', liens()); }
  if (sf) {
    const s = sh.steps[Number(t.dataset.i)]; if (!s) return;
    if (sf === 'titre') s.titre = t.value;
    else if (sf === 'jbefore') { const v = Number(t.value); s.offset = isFinite(v) ? -Math.round(v) : 0; }
    else if (sf === 'echeance') s.echeance = t.value || null;
    if (isChange && sf !== 'titre') renderSteps();
  }
}
sheet('task', { render: sheetTask, save: saveTask, del: deleteTask, field: taskField });

function stepAdd() {
  const ti = $('#f-st-t'), ji = $('#f-st-j'); if (!ti || !ui.sheet) return;
  const titre = ti.value.trim(); if (!titre) { ti.focus(); return; }
  const jb = Number(ji && ji.value); const off = isFinite(jb) ? -Math.round(jb) : -7;
  ui.sheet.steps.push({ id: null, titre, offset: off, echeance: null, statut: 'a_faire' });
  ti.value = ''; renderSteps(); ti.focus();
}
export { stepAdd };
action('step-add', () => stepAdd());
action('step-del', a => { const s = ui.sheet && ui.sheet.steps[Number(a.dataset.i)]; if (s) { s._del = true; renderSteps(); } });
action('step-toggle', a => { const s = ui.sheet && ui.sheet.steps[Number(a.dataset.i)]; if (s) { s.statut = s.statut === 'fait' ? 'a_faire' : 'fait'; if (s.statut !== 'fait') s.faitLe = null; renderSteps(); } });
action('step-model', () => {
  const sel = $('#f-model'); const m = sel ? get('modeles', sel.value) : null; if (!m || !ui.sheet) return;
  for (const e of (Array.isArray(m.etapes) ? m.etapes : [])) ui.sheet.steps.push({ id: null, titre: String(e.titre || 'Étape'), offset: Number(e.offset) || 0, echeance: null, statut: 'a_faire' });
  renderSteps();
  toast(parentDueDraft() ? 'Modèle appliqué' : 'Modèle appliqué : fixe l’échéance pour dater les étapes');
});

/* ---- Modèles de rétroplanning (ouverts depuis les Réglages) ---- */
export function openModeleEditor(id) {
  const m = id ? get('modeles', id) : null;
  const steps = (m && Array.isArray(m.etapes)) ? m.etapes.map(e => ({ titre: String(e.titre || ''), offset: Number(e.offset) || 0 })) : [];
  openSheet({ kind: 'modele', draft: { id: m ? m.id : null, nom: m ? m.nom : '', domaines: (m && Array.isArray(m.domaines)) ? m.domaines.slice() : [] }, steps, isNew: !m });
}
sheet('modele', {
  render(sh) {
    const d = sh.draft;
    let h = head(sh.isNew ? 'Nouveau modèle' : 'Modèle de rétroplanning') + '<div class="sheet-body">';
    h += `<label class="fld"><span class="fld-l">Nom du modèle</span><input id="m-nom" data-field="nom" value="${esc(d.nom)}"${sh.isNew ? ' data-autofocus' : ''}></label>`;
    h += `<fieldset class="fld"><legend class="fld-l">Suggéré pour les domaines</legend>${chipsMulti('domaines', domList(false).map(x => [x.id, x.nom, domColor(x)]), d.domaines)}<p class="hint">Quand tu crées une tâche dans l’un de ces domaines, ce modèle est proposé en premier.</p></fieldset>`;
    h += `<section class="retro"><h3>Étapes</h3><p class="hint">J−21 : 21 jours avant l’échéance de la tâche à laquelle tu appliques le modèle.</p><div id="sheet-steps">${modeleStepsHTML()}</div><div class="retro-add"><input id="f-st-t" placeholder="Nouvelle étape" aria-label="Nouvelle étape"><label class="s-j"><span>J−</span><input id="f-st-j" type="number" inputmode="numeric" value="7" aria-label="Jours avant l’échéance"></label><button type="button" class="btn btn-sm" data-action="step-add">Ajouter</button></div></section>`;
    return h + '</div>' + foot(!sh.isNew);
  },
  async save(sh) {
    const d = sh.draft, nom = String(d.nom || '').trim();
    if (!nom) throw { code: 'form', message: 'Donne un nom au modèle.' };
    const etapes = sh.steps.filter(s => !s._del && String(s.titre || '').trim()).map(s => ({ titre: String(s.titre).trim(), offset: Number(s.offset) || 0 })).sort((a, b) => a.offset - b.offset);
    await put('modeles', d.id || newId('m'), { nom, etapes, domaines: Array.isArray(d.domaines) ? d.domaines : [] });
  },
  del: sh => remove('modeles', sh.draft.id),
  field: taskField
});
