/* Notes : file « À trier » (notes dictées à Claude) et carnet (Notes, Idées, Veille). */
import { S, list, get, put, patch, remove, saveUI, guarded } from '../core/store.js';
import { $, esc, clone, newId, toast, ICON, linksHTML, rich, isUrl, opts } from '../core/util.js';
import { isDate, isTime, fShort, fDayM, localMs, parseD } from '../core/dates.js';
import { TRI_ACTIONS, NOTE_TYPES, IDEE_GENRES, VEILLE_GENRES, VEILLE_SUIVI, CATEGORIES, catInfo, color, REU_TYPES, PRIORITES } from '../core/config.js';
import { view, action, onInput, sheet, openSheet, renderSheet, ui, head, foot, gate, empty, section, liens, refresh, chipsMulti, seg } from '../core/ui.js';
import { domList, domOptions, createTask, openTaskEditor } from './taches.js';
import { saveReunion, openReuEditor } from './reunions.js';
import { comptes, compte, createContenu, openContenuEditor, formatsOf } from './contenus.js';

const LABEL = Object.fromEntries(TRI_ACTIONS);
const DUREES = [['30', '30 min'], ['60', '1 h'], ['90', '1 h 30'], ['120', '2 h'], ['180', '3 h'], ['jour', 'Journée entière']];

/* ---- Données ---- */
function stampOf(n) { return Number(n.creeMs) || Date.parse(n.creeLe || '') || 0; }
const byRecent = (a, b) => stampOf(b) - stampOf(a);
export function aTrier() { return list('notes').filter(n => n.statut === 'a_trier').sort(byRecent); }
function carnet() { return list('notes').filter(n => n.statut !== 'a_trier'); }
function whenTxt(n) {
  const s = String(n.creeLe || '');
  const day = s.slice(0, 10), time = /T(\d{2}:\d{2})/.exec(s);
  if (!isDate(day)) return '';
  return (day === S.today ? 'aujourd’hui' : fDayM(day)) + (time ? ' · ' + time[1] : '');
}
function prop(n) { return (n.proposition && typeof n.proposition === 'object') ? n.proposition : {}; }
function propAction(n) { const a = prop(n).action; return LABEL[a] ? a : 'note'; }
function propLabel(n) {
  const p = prop(n), a = propAction(n), bits = [LABEL[a]];
  if ((a === 'tache' || a === 'evenement') && isDate(p.date)) bits.push(fShort(p.date) + (a === 'evenement' && isTime(p.heure) ? ' à ' + p.heure : ''));
  if (a === 'contenu') { const c = compte(p.compte); if (c) bits.push(c.court); if (isDate(p.date)) bits.push(fShort(p.date)); }
  if (a === 'idee') { const g = IDEE_GENRES.find(x => x[0] === p.genre); if (g) bits.push(g[1]); }
  if (a === 'veille') { const g = VEILLE_GENRES.find(x => x[0] === p.genre); if (g) bits.push(g[1]); }
  return bits.join(' · ');
}
/* La proposition de Claude est-elle assez complète pour être validée d'un geste ? */
function quickOk(n) {
  const p = prop(n), a = propAction(n);
  if (a === 'evenement') return isDate(p.date);
  if (a === 'contenu') return !!compte(p.compte);
  return true;
}
function catsHTML(n) { return (Array.isArray(n.categories) ? n.categories : []).map(catInfo).filter(Boolean).map(c => `<span class="cat" style="--c:${c.c}">${esc(c.nom)}</span>`).join(''); }

/* ---- Vue ---- */
function noteCard(n) {
  const resume = String(n.resume || n.texte || '').trim();
  return `<article class="ncard"><button type="button" class="ncard-main" data-action="note-open" data-id="${esc(n.id)}"><span class="ncard-t">${esc(n.titre || 'Note sans titre')}</span>${resume ? `<span class="ncard-r">${esc(resume)}</span>` : ''}<span class="row-meta">${n.source === 'claude' ? '<span class="mini">dictée à Claude</span>' : ''}<span class="mini">${esc(whenTxt(n))}</span>${catsHTML(n)}</span></button>
    <div class="ncard-act"><span class="prop">Proposition : <b>${esc(propLabel(n))}</b></span><span class="spacer"></span><button type="button" class="btn btn-sm" data-action="note-open" data-id="${esc(n.id)}">Trier…</button>${quickOk(n) ? `<button type="button" class="btn btn-sm btn-primary" data-action="note-quick" data-id="${esc(n.id)}">Valider</button>` : ''}</div></article>`;
}
function typeTag(n) {
  if (n.statut === 'traitee') { const v = n.vers || {}; return `<span class="ntag ntag-done">${esc({ taches: 'Tâche', agenda: 'Événement', contenus: 'Contenu', reunions: 'Réunion' }[v.c] || 'Transformée')}</span>`; }
  return `<span class="ntag ntag-${esc(n.type || 'note')}">${esc((NOTE_TYPES.find(x => x[0] === n.type) || NOTE_TYPES[0])[1])}</span>`;
}
function carnetRow(n) {
  const meta = [];
  if (n.type === 'idee') { const g = IDEE_GENRES.find(x => x[0] === n.genre); if (g) meta.push(`<span class="mini">${esc(g[1])}</span>`); }
  if (n.type === 'veille') {
    const g = VEILLE_GENRES.find(x => x[0] === n.genre); if (g) meta.push(`<span class="mini">${esc(g[1])}</span>`);
    const s = VEILLE_SUIVI.find(x => x[0] === n.suivi); if (s) meta.push(`<span class="st${n.suivi === 'suivi' ? ' st-ok' : (n.suivi === 'a_approfondir' ? ' st-att' : '')}">${esc(s[1])}</span>`);
  }
  meta.push(`<span class="mini">${esc(whenTxt(n))}</span>`);
  const cats = catsHTML(n); if (cats) meta.push(cats);
  const link = isUrl(n.lien) ? `<a class="icon-btn sm" href="${esc(n.lien)}" target="_blank" rel="noopener" aria-label="Ouvrir le lien">${ICON.ext}</a>` : '<span></span>';
  return `<div class="row nrow">${typeTag(n)}<button type="button" class="row-main" data-action="note-open" data-id="${esc(n.id)}"><span class="row-title">${esc(n.titre || 'Note')}</span>${n.resume ? `<span class="row-sub">${esc(n.resume)}</span>` : ''}<span class="row-meta">${meta.join('')}</span></button>${link}</div>`;
}
function renderNotes() {
  const el = $('#v-notes'); if (!gate(el)) return;
  const inbox = aTrier(), mode = S.ui.notesMode === 'carnet' ? 'carnet' : 'trier';
  const all = carnet();
  const sub = $('#nt-sub'); if (sub) sub.textContent = `${inbox.length} à trier · ${all.filter(n => n.statut === 'rangee').length} dans le carnet`;
  const tb = $('#nt-tools');
  if (tb) tb.innerHTML = seg('notes-mode', [['trier', `À trier <span class="cnt">${inbox.length}</span>`], ['carnet', 'Carnet']], mode, 'Affichage')
    + (mode === 'carnet' ? seg('carnet-type', [['tous', 'Tous'], ['note', 'Notes'], ['idee', 'Idées'], ['veille', 'Veille'], ['recherche', 'Recherche'], ['traitee', 'Transformées']], S.ui.carnetType || 'tous', 'Type') + `<input id="nt-search" type="search" placeholder="Rechercher dans le carnet…" aria-label="Rechercher une note" value="${esc(S.nq)}">` : '');
  if (mode === 'trier') {
    el.innerHTML = inbox.length ? `<div class="ncards">${inbox.map(noteCard).join('')}</div>`
      : empty('Rien à trier.', 'Dicte une note à Claude dans n’importe quelle conversation : « Note : … ». Elle arrive ici à la prochaine synchro.');
    return;
  }
  const T = S.ui.carnetType || 'tous', q = S.nq.trim().toLowerCase();
  const L = all.filter(n => {
    if (T === 'traitee') { if (n.statut !== 'traitee') return false; }
    else if (n.statut !== 'rangee' || (T !== 'tous' && (n.type || 'note') !== T)) return false;
    return !q || [n.titre, n.resume, n.texte, n.liens, n.lien].map(x => String(x || '')).join(' ').toLowerCase().includes(q);
  }).sort(byRecent);
  if (!L.length) { el.innerHTML = empty(q ? 'Aucune note ne correspond.' : 'Rien ici pour l’instant.', q ? 'Efface la recherche ou change de type.' : 'Les notes que tu ranges arrivent ici.'); return; }
  if (T === 'veille' || T === 'tous') {
    const v = L.filter(n => n.type === 'veille' && n.suivi === 'a_approfondir');
    if (T === 'veille' && v.length) { el.innerHTML = section('veille-todo', 'À approfondir', v.length, v.map(carnetRow).join('')) + section('veille-rest', 'Déjà approfondi ou suivi', L.length - v.length, L.filter(n => !v.includes(n)).map(carnetRow).join('') || '<p class="empty-line">Rien pour l’instant.</p>'); return; }
  }
  el.innerHTML = `<div class="nlist">${L.map(carnetRow).join('')}</div>`;
}
view('notes', {
  label: 'Notes', masquable: true, badge: () => aTrier().length,
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7.5"/><path d="M4 13.5h4.2l1.3 2.5h5l1.3-2.5H20V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8.5 8.5h7M8.5 11h4"/></svg>',
  shell: () => `<div class="v-head v-head-row"><div><h1><span class="hl">Notes</span></h1><p class="v-sub" id="nt-sub"></p></div><button type="button" class="btn btn-primary" data-action="new-note">+ Note</button></div><div class="toolbar" id="nt-tools"></div><div id="v-notes"></div>`,
  render: renderNotes
});
action('notes-mode', a => { S.ui.notesMode = a.dataset.value; saveUI(); refresh(); });
action('carnet-type', a => { S.ui.carnetType = a.dataset.value; saveUI(); refresh(); });
onInput('nt-search', el => { S.nq = el.value; renderNotes(); const i = $('#nt-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });

/* ---- Fiche de tri ---- */
function draftOf(n) {
  const p = prop(n), a = n.statut === 'rangee' ? (n.type || 'note') : propAction(n);
  const lastDom = S.ui.lastDom || ((domList(false)[0] || {}).id) || '';
  const doms = domList(false);
  const domaine = doms.some(d => d.id === p.domaine) ? p.domaine : (doms.find(d => String(d.nom).toLowerCase() === String(p.domaine || '').toLowerCase()) || {}).id || lastDom;
  const duree = p.duree === 'jour' || p.journee ? 'jour' : String(Number(p.duree) || 60);
  return {
    id: n.id || null, titre: n.titre || '', resume: n.resume || '', texte: n.texte || '', liens: n.liens || '',
    categories: Array.isArray(n.categories) ? n.categories.slice() : [], action: a,
    domaine, echeance: isDate(p.date) ? p.date : null, priorite: p.priorite || 'normale',
    date: isDate(p.date) ? p.date : S.today, heure: isTime(p.heure) ? p.heure : '', duree: isTime(p.heure) ? duree : (p.journee ? 'jour' : duree),
    lieu: p.lieu || '', reunion: !!p.reunion, reuType: REU_TYPES.some(x => x[0] === p.type) ? p.type : 'presentiel',
    compte: compte(p.compte) ? p.compte : ((comptes().find(c => !c.pause) || {}).id || ''), datePub: isDate(p.date) ? p.date : null, format: p.format || '',
    genre: n.genre || p.genre || '', suivi: n.suivi || p.suivi || 'a_approfondir', lien: n.lien || p.lien || ''
  };
}
export function openNote(id) {
  const n = id ? get('notes', id) : null;
  if (id && !n) { toast('Cette note n’existe plus.', 'err'); return; }
  const draft = n ? draftOf(n) : draftOf({ statut: 'nouvelle', proposition: { action: 'note' } });
  openSheet({ kind: 'note', draft, note: n, isNew: !n });
}
function noteBody(d) { return [d.resume, d.texte && d.texte !== d.resume ? 'Texte dicté :\n' + d.texte : '', d.liens].map(x => String(x || '').trim()).filter(Boolean).join('\n\n'); }
function actionFields(d) {
  if (d.action === 'tache') {
    return `<div class="fld-row"><label class="fld"><span class="fld-l">Domaine</span><select id="n-dom" data-field="domaine">${domOptions(d.domaine)}</select></label><label class="fld"><span class="fld-l">Échéance</span><input id="n-ech" type="date" data-field="echeance" value="${d.echeance || ''}"></label></div><label class="fld"><span class="fld-l">Priorité</span><select id="n-prio" data-field="priorite">${opts(PRIORITES, d.priorite)}</select></label>`;
  }
  if (d.action === 'evenement') {
    const allDay = d.duree === 'jour';
    let h = `<div class="fld-row"><label class="fld"><span class="fld-l">Date</span><input id="n-date" type="date" data-field="date" value="${d.date || ''}"></label><label class="fld"><span class="fld-l">Durée</span><select id="n-duree" data-field="duree" data-rerender>${opts(DUREES, d.duree)}</select></label>${allDay ? '' : `<label class="fld"><span class="fld-l">Heure</span><input id="n-heure" type="time" data-field="heure" value="${esc(d.heure || '')}"></label>`}</div>`;
    h += `<label class="fld"><span class="fld-l">Lieu ou lien visio</span><input id="n-lieu" data-field="lieu" value="${esc(d.lieu || '')}"></label>`;
    h += `<div class="checks"><label class="ck"><input id="n-reu" type="checkbox" data-field="reunion" data-rerender${d.reunion ? ' checked' : ''}>Créer aussi une fiche Réunion (pour le compte-rendu)</label></div>`;
    if (d.reunion) h += `<fieldset class="fld"><legend class="fld-l">Type de réunion</legend><div class="seg">${REU_TYPES.map(([k, l]) => `<button type="button" data-action="set-field" data-field="reuType" data-value="${k}" aria-pressed="${d.reuType === k}">${l}</button>`).join('')}</div></fieldset>`;
    return h + '<p class="hint">L’événement est créé dans ton Google Agenda à la prochaine synchro.</p>';
  }
  if (d.action === 'contenu') {
    const c = compte(d.compte);
    return `<div class="fld-row"><label class="fld"><span class="fld-l">Compte</span><select id="n-compte" data-field="compte" data-rerender>${comptes().map(x => `<option value="${esc(x.id)}"${x.id === d.compte ? ' selected' : ''}>${esc(x.nom)}${x.pause ? ' (en pause)' : ''}</option>`).join('')}</select></label><label class="fld"><span class="fld-l">Publication prévue</span><input id="n-pub" type="date" data-field="datePub" value="${d.datePub || ''}"></label></div>`
      + (c ? `<label class="fld"><span class="fld-l">Format</span><select id="n-format" data-field="format">${opts([['', 'À définir']].concat(formatsOf(c)), d.format || '')}</select></label>` : '');
  }
  if (d.action === 'idee') return `<fieldset class="fld"><legend class="fld-l">Genre d’idée</legend>${seg('nf-genre', IDEE_GENRES, d.genre)}</fieldset>`;
  if (d.action === 'veille') {
    return `<fieldset class="fld"><legend class="fld-l">Qui ou quoi</legend>${seg('nf-genre', VEILLE_GENRES, d.genre)}</fieldset>
      <label class="fld"><span class="fld-l">Lien principal (profil, site, page)</span><input id="n-lien" type="url" inputmode="url" data-field="lien" value="${esc(d.lien || '')}" placeholder="https://…"></label>
      <fieldset class="fld"><legend class="fld-l">Suivi</legend>${seg('nf-suivi', VEILLE_SUIVI, d.suivi)}</fieldset>`;
  }
  return '';
}
function sheetNote(sh) {
  const d = sh.draft, n = sh.note, traitee = n && n.statut === 'traitee', inbox = n && n.statut === 'a_trier';
  let h = head(sh.isNew ? 'Nouvelle note' : (inbox ? 'Trier la note' : 'Note')) + '<div class="sheet-body">';
  if (inbox && n.source === 'claude') h += `<p class="hint">Dictée à Claude ${esc(whenTxt(n))}. Proposition : <b>${esc(propLabel(n))}</b>.</p>`;
  h += `<label class="fld"><span class="fld-l">Titre</span><input id="n-titre" data-field="titre" value="${esc(d.titre)}"${sh.isNew ? ' data-autofocus' : ''}></label>`;
  h += `<label class="fld"><span class="fld-l">${sh.isNew ? 'Note' : 'Résumé'}</span><textarea id="n-resume" rows="4" data-field="resume">${esc(d.resume)}</textarea></label>`;
  if (d.texte) h += `<details class="fld"><summary class="fld-l">Texte dicté complet</summary><textarea id="n-texte" rows="8" data-field="texte">${esc(d.texte)}</textarea></details>`;
  h += `<label class="fld"><span class="fld-l">Liens (un par ligne)</span><textarea id="n-liens" rows="2" data-field="liens">${esc(d.liens)}</textarea></label>${linksHTML(d.liens, 'n-links', liens())}`;
  h += `<fieldset class="fld"><legend class="fld-l">Catégories</legend>${chipsMulti('categories', CATEGORIES.map(([k, l, c]) => [k, l, color(c)]), d.categories)}</fieldset>`;
  if (traitee) {
    const v = n.vers || {};
    const lab = { taches: 'une tâche', agenda: 'un événement Google Agenda', contenus: 'un contenu', reunions: 'une réunion' }[v.c] || 'un élément';
    h += `<div class="notice ok"><p>Transformée en ${lab}${n.traiteeLe ? ' le ' + esc(fShort(n.traiteeLe)) : ''}.</p>${v.c && v.c !== 'agenda' && get(v.c, v.id) ? `<p><button type="button" class="linkbtn" data-action="note-goto" data-c="${esc(v.c)}" data-id="${esc(v.id)}">Ouvrir</button></p>` : ''}${v.reunion && get('reunions', v.reunion) ? `<p><button type="button" class="linkbtn" data-action="note-goto" data-c="reunions" data-id="${esc(v.reunion)}">Ouvrir la fiche Réunion</button></p>` : ''}</div>`;
  } else {
    h += `<fieldset class="fld"><legend class="fld-l">${inbox || sh.isNew ? 'En faire' : 'Ranger comme'}</legend><div class="seg seg-wrap">${TRI_ACTIONS.map(([k, l]) => `<button type="button" data-action="set-field" data-field="action" data-value="${k}" data-rerender aria-pressed="${d.action === k}">${l}</button>`).join('')}</div></fieldset>`;
    h += `<div class="tri-fields">${actionFields(d)}</div>`;
  }
  h += '</div>';
  return h + foot(!sh.isNew, 'Confirmer la suppression', { saveLabel: (inbox || sh.isNew) ? 'Valider' : 'Enregistrer' });
}
/* Exécute le tri : crée la tâche, l'événement ou le contenu, ou range la note dans le carnet. */
async function trier(n, d) {
  const titre = String(d.titre || '').trim();
  if (!titre) throw { code: 'form', message: 'Donne un titre à la note.' };
  const id = (n && n.id) || newId('n');
  const base = {
    titre, resume: String(d.resume || ''), texte: String(d.texte || ''), liens: String(d.liens || ''),
    categories: (d.categories || []).filter(c => catInfo(c)),
    source: (n && n.source) || 'app', creeLe: (n && n.creeLe) || S.today, creeMs: (n && n.creeMs) || Date.now()
  };
  if (n && n.proposition) base.proposition = n.proposition;
  let vers = null, msg = 'Rangée dans le carnet';
  if (d.action === 'tache') {
    const tid = await createTask({ titre, domaine: d.domaine || '', echeance: isDate(d.echeance) ? d.echeance : null, priorite: d.priorite || 'normale', notes: noteBody(d), source: 'note' });
    S.ui.lastDom = d.domaine; saveUI();
    vers = { c: 'taches', id: tid }; msg = 'Tâche créée' + (isDate(d.echeance) ? ' pour le ' + fShort(d.echeance) : '');
  } else if (d.action === 'evenement') {
    if (!isDate(d.date)) throw { code: 'form', message: 'Choisis la date de l’événement.' };
    const journee = d.duree === 'jour' || !isTime(d.heure);
    const ev = { etat: 'a_creer', titre, journee, date: d.date, lieu: String(d.lieu || '').trim(), description: noteBody(d), source: id, creeLe: S.today };
    if (!journee) { ev.heure = d.heure; ev.debut = localMs(d.date, d.heure); ev.fin = ev.debut + (Number(d.duree) || 60) * 60000; }
    const agid = newId('ag');
    await put('agenda', agid, ev);
    vers = { c: 'agenda', id: agid };
    if (d.reunion) vers.reunion = await saveReunion({ titre, date: d.date, heure: journee ? '' : d.heure, type: d.reuType || 'presentiel', lieu: d.lieu, categories: base.categories, liens: base.liens, compteRendu: '' });
    msg = 'Événement prêt : il sera créé dans Google Agenda à la synchro';
  } else if (d.action === 'contenu') {
    if (!compte(d.compte)) throw { code: 'form', message: 'Choisis le compte du contenu.' };
    const cid = await createContenu({ titre, compte: d.compte, datePub: isDate(d.datePub) ? d.datePub : null, format: d.format || '', notes: noteBody(d), source: id });
    vers = { c: 'contenus', id: cid }; msg = 'Contenu ajouté au calendrier éditorial';
  }
  if (vers) await put('notes', id, Object.assign(base, { statut: 'traitee', type: (n && n.type) || null, traiteeLe: S.today, vers }));
  else await put('notes', id, Object.assign(base, { statut: 'rangee', type: d.action, genre: d.action === 'note' ? '' : (d.genre || ''), suivi: d.action === 'veille' ? (d.suivi || 'a_approfondir') : '', lien: d.action === 'veille' ? String(d.lien || '').trim() : (n && n.lien) || '', rangeeLe: (n && n.rangeeLe) || S.today }));
  return msg;
}
async function saveTraitee(n, d) {
  await put('notes', n.id, Object.assign(clone(n), { titre: String(d.titre || '').trim() || n.titre, resume: String(d.resume || ''), texte: String(d.texte || ''), liens: String(d.liens || ''), categories: (d.categories || []).filter(c => catInfo(c)) }));
}
sheet('note', {
  render: sheetNote,
  async save(sh) { if (sh.note && sh.note.statut === 'traitee') { await saveTraitee(sh.note, sh.draft); return 'Enregistré'; } return trier(sh.note, sh.draft); },
  del: sh => remove('notes', sh.note.id),
  field(sh, t, isChange) {
    const f = t.dataset.field;
    if (isChange && t.dataset.rerender != null) { renderSheet(); return; }
    if (isChange && f === 'liens') { const box = $('#n-links'); if (box) box.outerHTML = linksHTML(sh.draft.liens, 'n-links', liens()); }
  }
});
action('new-note', () => openNote(null));
action('note-open', a => openNote(a.dataset.id));
action('note-quick', async a => {
  const n = get('notes', a.dataset.id); if (!n) return;
  let msg = '';
  if (await guarded(async () => { msg = await trier(n, draftOf(n)); })) toast(msg);
});
action('nf-genre', a => { const sh = ui.sheet; if (!sh) return; sh.draft.genre = sh.draft.genre === a.dataset.value ? '' : a.dataset.value; renderSheet(); });
action('nf-suivi', a => { const sh = ui.sheet; if (!sh) return; sh.draft.suivi = a.dataset.value; renderSheet(); });
action('note-goto', a => {
  const c = a.dataset.c, id = a.dataset.id;
  if (c === 'taches') openTaskEditor(id); else if (c === 'reunions') openReuEditor(id); else if (c === 'contenus') openContenuEditor(id);
});
