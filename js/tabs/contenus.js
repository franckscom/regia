/* Contenus : calendrier éditorial (couverture sur 4 semaines), production par étape, interactions LinkedIn. */
import { S, list, get, put, patch, remove, saveUI, guarded, rg } from '../core/store.js';
import { $, esc, clone, newId, toast, ICON, linksHTML, isUrl, opts, copyText, rich } from '../core/util.js';
import { isDate, addDays, diff, mondayOf, isoWeek, weekKey, fShort, fDayM, weekLabel } from '../core/dates.js';
import { PLATEFORMES, COMPTES_DEFAUT, MEDIA_SOURCES, BANQUES, INTER_COMPTES, color } from '../core/config.js';
import { view, action, sheet, openSheet, renderSheet, ui, head, foot, gate, empty, section, liens, refresh, seg, chipsMulti } from '../core/ui.js';

/* ---- Comptes ---- */
export function comptes() {
  const ov = Array.isArray(rg('comptes').liste) ? rg('comptes').liste : [];
  return COMPTES_DEFAUT.map(c => {
    const o = ov.find(x => x && x.id === c.id) || {};
    return Object.assign({}, c, { rythme: Number.isFinite(Number(o.rythme)) && o.rythme !== null && o.rythme !== '' ? Math.max(0, Math.min(14, Number(o.rythme))) : c.rythme, pause: typeof o.pause === 'boolean' ? o.pause : c.pause });
  });
}
export function compte(id) { return comptes().find(c => c.id === id) || null; }
function plat(c) { return PLATEFORMES[(c && c.plateforme) || 'linkedin'] || PLATEFORMES.linkedin; }
export function formatsOf(c) { return plat(c).formats; }
function etapesOf(c) { return plat(c).etapes; }
function etapeIdx(ct) { const c = compte(ct.compte); const E = etapesOf(c); const i = E.findIndex(e => e[0] === ct.etape); return i < 0 ? 0 : i; }
function etapeLabel(ct) { const c = compte(ct.compte); const e = etapesOf(c)[etapeIdx(ct)]; return e ? e[1] : 'Idée'; }
function isPub(ct) { return ct.etape === 'publie'; }
function compteTag(c) { return c ? `<span class="acct" style="--c:${color(c.couleur)}">${esc(c.court)}</span>` : ''; }

/* ---- Données ---- */
export function contenus() { return list('contenus'); }
export async function createContenu(fields) {
  const id = newId('c');
  await put('contenus', id, Object.assign({ etape: 'idee', format: '', datePub: null, notes: '', lien: '', creeLe: S.today }, fields));
  return id;
}
function byPub(a, b) { const x = a.datePub || '9999', y = b.datePub || '9999'; return x < y ? -1 : (x > y ? 1 : etapeIdx(b) - etapeIdx(a)); }
/* Résumé de la semaine pour l'écran Aujourd'hui */
export function semaineContenus() {
  const mon = mondayOf(S.today), sun = addDays(mon, 6), all = contenus();
  const actifs = comptes().filter(c => !c.pause && c.rythme > 0);
  let prevus = 0, cible = 0;
  for (const c of actifs) { const n = all.filter(x => x.compte === c.id && isDate(x.datePub) && x.datePub >= mon && x.datePub <= sun).length; prevus += Math.min(n, c.rythme); cible += c.rythme; }
  const aPublier = all.filter(x => !isPub(x) && isDate(x.datePub) && x.datePub >= S.today && x.datePub <= addDays(S.today, 6)).sort(byPub);
  const retard = all.filter(x => !isPub(x) && isDate(x.datePub) && x.datePub < S.today).sort(byPub);
  return { prevus, cible, aPublier, retard };
}
export function contRow(ct, o) {
  o = o || {};
  const c = compte(ct.compte), pub = isPub(ct), late = !pub && isDate(ct.datePub) && ct.datePub < S.today;
  const E = etapesOf(c), i = etapeIdx(ct), next = E[i + 1];
  const meta = [compteTag(c), `<span class="etape e-${esc(ct.etape || 'idee')}">${esc(etapeLabel(ct))}</span>`];
  if (isDate(ct.datePub)) meta.push(late ? `<span class="tag tag-late">prévu ${esc(fDayM(ct.datePub))}</span>` : (ct.datePub === S.today ? '<span class="tag tag-today">aujourd’hui</span>' : `<span class="date">${esc(fShort(ct.datePub))}</span>`));
  else if (!pub) meta.push('<span class="mini">sans date</span>');
  if (pub && isDate(ct.publieLe)) meta.push(`<span class="mini">publié le ${esc(fDayM(ct.publieLe))}</span>`);
  const prog = `<span class="prog" style="--p:${E.length > 1 ? Math.round(i / (E.length - 1) * 100) : 0}%" aria-hidden="true"></span>`;
  const adv = (!pub && next && !o.noAdv) ? `<button type="button" class="btn btn-sm btn-ghost adv" data-action="cont-next" data-id="${esc(ct.id)}" title="Passer à l’étape suivante">→ ${esc(next[1])}</button>` : '<span></span>';
  return `<div class="row crow${late ? ' is-late' : ''}${pub ? ' is-done' : ''}">${prog}<button type="button" class="row-main" data-action="cont-edit" data-id="${esc(ct.id)}"><span class="row-title">${esc(ct.titre || 'Contenu')}</span><span class="row-meta">${meta.join('')}</span></button>${adv}</div>`;
}

/* ---- Vue : calendrier ---- */
function renderCalendrier() {
  const all = contenus(), actifs = comptes().filter(c => !c.pause), mon0 = mondayOf(S.today);
  if (!actifs.length) return empty('Tous tes comptes sont en pause.', 'Active ceux que tu publies dans Réglages › Comptes et rythmes.');
  let h = '';
  const retard = all.filter(x => !isPub(x) && isDate(x.datePub) && x.datePub < S.today).sort(byPub);
  if (retard.length) h += section('c-late', 'Date de publication dépassée', retard.length, retard.map(x => contRow(x)).join(''), { cls: 'sec-late' });
  for (let w = 0; w < 4; w++) {
    const mon = addDays(mon0, 7 * w), sun = addDays(mon, 6);
    let rows = '';
    for (const c of actifs) {
      const items = all.filter(x => x.compte === c.id && isDate(x.datePub) && x.datePub >= mon && x.datePub <= sun).sort(byPub);
      const manque = Math.max(0, c.rythme - items.length);
      const sugg = w === 0 ? (S.today > mon ? S.today : addDays(mon, 1)) : addDays(mon, 1);
      rows += `<div class="cov"><div class="cov-h">${compteTag(c)}<span class="cov-n${manque ? ' miss' : ' ok'}">${items.length}/${c.rythme}</span></div><div class="cov-items">${items.map(x => `<button type="button" class="cchip${isPub(x) ? ' done' : ''}" data-action="cont-edit" data-id="${esc(x.id)}"><span class="date">${esc(fDayM(x.datePub))}</span> ${esc(x.titre || 'Contenu')} <span class="etape e-${esc(x.etape || 'idee')}">${esc(etapeLabel(x))}</span></button>`).join('')}${manque ? `<button type="button" class="cchip hole" data-action="cont-new" data-compte="${esc(c.id)}" data-date="${sugg}">+ ${manque} à prévoir</button>` : ''}</div></div>`;
    }
    h += `<section class="sec cweek${w === 0 ? ' now' : ''}"><h2 class="sec-h"><span>S${isoWeek(mon)} · ${esc(weekLabel(mon))}</span>${w === 0 ? '<span class="cnt">cette semaine</span>' : ''}</h2>${rows}</section>`;
  }
  const res = all.filter(x => x.etape === 'pret' && !isDate(x.datePub));
  h += section('c-res', 'Réserve prête à publier', res.length, res.length ? res.map(x => contRow(x)).join('') : '<p class="empty-line">Aucun contenu prêt en réserve. Avance une idée jusqu’à « Prêt » sans lui donner de date.</p>');
  return h;
}
/* ---- Vue : production ---- */
function renderProduction() {
  const sel = S.ui.contComptes, all = contenus().filter(x => !sel.length || sel.includes(x.compte));
  let h = `<div class="chips" role="group" aria-label="Comptes affichés">${comptes().map(c => `<button type="button" class="chip" data-action="cont-filter" data-id="${esc(c.id)}" aria-pressed="${!sel.length || sel.includes(c.id)}" style="--c:${color(c.couleur)}">${esc(c.court)}</button>`).join('')}</div>`;
  if (!all.length) return h + empty('Aucun contenu ici.', 'Ajoute une idée avec « + Contenu », ou transforme une note.');
  const soon = all.filter(x => !isPub(x) && isDate(x.datePub) && x.datePub <= addDays(S.today, 14)).sort(byPub);
  const ids = new Set(soon.map(x => x.id));
  const prod = all.filter(x => !ids.has(x.id) && !['idee', 'pret', 'publie'].includes(x.etape)).sort(byPub);
  const idees = all.filter(x => !ids.has(x.id) && x.etape === 'idee').sort(byPub);
  const prets = all.filter(x => !ids.has(x.id) && x.etape === 'pret').sort(byPub);
  const pubs = all.filter(isPub).sort((a, b) => String(b.publieLe || b.datePub || '').localeCompare(String(a.publieLe || a.datePub || '')));
  const rows = L => L.map(x => contRow(x)).join('');
  h += section('c-soon', 'À publier dans les 14 jours', soon.length, soon.length ? rows(soon) : '<p class="empty-line">Rien de daté dans les 14 jours.</p>');
  h += section('c-prod', 'En production', prod.length, prod.length ? rows(prod) : '<p class="empty-line">Rien en cours.</p>');
  h += section('c-idees', 'Idées', idees.length, idees.length ? rows(idees) : '<p class="empty-line">Aucune idée en attente.</p>');
  if (prets.length) h += section('c-prets', 'Prêts (réserve)', prets.length, rows(prets));
  if (pubs.length) h += section('c-pubs', 'Publiés', pubs.length, rows(pubs), { collapsible: true });
  return h;
}
/* ---- Vue : interactions LinkedIn ---- */
function cibles(id) {
  const ov = rg('interactions'), base = INTER_COMPTES.find(x => x.id === id);
  return base.actions.map(([k, l, n]) => { const v = ov[id] && Number.isFinite(Number(ov[id][k])) ? Number(ov[id][k]) : n; return { k, l, n: Math.max(0, v) }; });
}
function journee(d) { return get('interactions', d) || {}; }
export function interactionsJour(d) {
  d = d || S.today; const j = journee(d); let fait = 0, total = 0;
  for (const ac of INTER_COMPTES) for (const a of cibles(ac.id)) { total += a.n; fait += Math.min(a.n, Number((j[ac.id] || {})[a.k]) || 0); }
  return { fait, total };
}
function renderInteractions() {
  const j = journee(S.today);
  let h = '<div class="icards">';
  for (const ac of INTER_COMPTES) {
    const C = cibles(ac.id), cur = j[ac.id] || {};
    const fait = C.reduce((s, a) => s + Math.min(a.n, Number(cur[a.k]) || 0), 0), total = C.reduce((s, a) => s + a.n, 0);
    h += `<section class="icard" style="--c:${color(ac.couleur)}"><h2 class="icard-h"><span>${esc(ac.nom)}</span><span class="cnt">${fait}/${total}</span></h2>`;
    for (const a of C) {
      const v = Number(cur[a.k]) || 0, ok = a.n > 0 && v >= a.n;
      h += `<div class="ctr${ok ? ' ok' : ''}"><span class="ctr-l">${esc(a.l)}</span><button type="button" class="icon-btn sm" data-action="inter-inc" data-compte="${ac.id}" data-k="${a.k}" data-d="-1" aria-label="Retirer un : ${esc(a.l)}"${v ? '' : ' disabled'}>${ICON.minus}</button><span class="ctr-v">${v}<small>/${a.n}</small></span><button type="button" class="icon-btn sm" data-action="inter-inc" data-compte="${ac.id}" data-k="${a.k}" data-d="1" aria-label="Ajouter un : ${esc(a.l)}">${ICON.plus}</button></div>`;
    }
    h += '</section>';
  }
  h += '</div>';
  /* 7 derniers jours */
  let dots = '';
  for (let i = 6; i >= 0; i--) { const d = addDays(S.today, -i), r = interactionsJour(d), p = r.total ? r.fait / r.total : 0; dots += `<span class="dday" title="${esc(fShort(d))} : ${r.fait}/${r.total}"><i style="--p:${Math.round(p * 100)}%"></i><small>${esc(fShort(d).slice(0, 3))}</small></span>`; }
  h += `<div class="ddays" aria-label="Interactions des 7 derniers jours"><span class="ddays-l">7 derniers jours</span>${dots}</div>`;
  /* Cibles suggérées par Claude (semaine en cours) et veille à suivre */
  const wk = weekKey(S.today);
  const sug = list('suggestions').filter(s => s.semaine === wk || (!s.fait && s.semaine >= weekKey(addDays(S.today, -14))));
  sug.sort((a, b) => (a.fait - b.fait) || String(a.compte).localeCompare(String(b.compte)));
  const sugRow = s => `<div class="row srow2${s.fait ? ' is-done' : ''}"><button type="button" class="check" data-action="sugg-done" data-id="${esc(s.id)}" aria-pressed="${!!s.fait}" aria-label="${s.fait ? 'Marquer comme à faire' : 'Marquer comme fait'}"></button><div class="row-main static"><span class="row-title">${esc(s.nom || 'Cible')}${s.type ? ` <span class="mini">· ${esc({ relation: 'demande de relation', commentaire: 'commentaire', page: 'page à suivre', like: 'like' }[s.type] || s.type)}</span>` : ''}</span>${s.pourquoi ? `<span class="row-sub">${esc(s.pourquoi)}</span>` : ''}${s.message ? `<span class="msg">${esc(s.message)}</span>` : ''}<span class="row-meta">${s.compte === 'takeoff' ? '<span class="acct" style="--c:var(--d-framboise)">TakeOff!</span>' : '<span class="acct" style="--c:var(--d-encre)">Franck</span>'}</span></div><span class="ract">${s.message ? `<button type="button" class="icon-btn sm" data-action="copy" data-text="${esc(s.message)}" aria-label="Copier le message">${ICON.copy}</button>` : ''}${isUrl(s.lien) ? `<a class="icon-btn sm" href="${esc(s.lien)}" target="_blank" rel="noopener" aria-label="Ouvrir">${ICON.ext}</a>` : ''}</span></div>`;
  h += section('i-sugg', 'Cibles suggérées par Claude', sug.filter(s => !s.fait).length, sug.length ? sug.map(sugRow).join('') : '<p class="empty-line">Claude propose des cibles chaque lundi, avec un message d’approche à personnaliser.</p>');
  const veille = list('notes').filter(n => n.statut === 'rangee' && n.type === 'veille' && n.suivi !== 'suivi');
  if (veille.length) h += section('i-veille', 'Depuis ta veille : à suivre sur LinkedIn', veille.length, veille.map(n => `<div class="row srow2"><button type="button" class="check" data-action="veille-suivi" data-id="${esc(n.id)}" aria-pressed="false" aria-label="Marquer comme suivi sur LinkedIn"></button><button type="button" class="row-main" data-action="note-open" data-id="${esc(n.id)}"><span class="row-title">${esc(n.titre)}</span>${n.resume ? `<span class="row-sub">${esc(n.resume)}</span>` : ''}</button><span class="ract">${isUrl(n.lien) ? `<a class="icon-btn sm" href="${esc(n.lien)}" target="_blank" rel="noopener" aria-label="Ouvrir">${ICON.ext}</a>` : ''}</span></div>`).join(''));
  h += '<p class="hint gap">Une page LinkedIn ne peut pas demander de relations : pour TakeOff!, invite tes relations à suivre la page (crédits d’invitation mensuels de la page).</p>';
  return h;
}
function renderContenus() {
  const el = $('#v-cont'); if (!gate(el)) return;
  const mode = ['calendrier', 'production', 'interactions'].includes(S.ui.contMode) ? S.ui.contMode : 'calendrier';
  const tb = $('#ct-tools'); if (tb) tb.innerHTML = seg('cont-mode', [['calendrier', 'Calendrier'], ['production', 'Production'], ['interactions', 'Interactions']], mode, 'Affichage');
  const s = semaineContenus(), all = contenus();
  const sub = $('#ct-sub'); if (sub) sub.textContent = `Cette semaine : ${s.prevus}/${s.cible} prévus · ${all.filter(x => !isPub(x) && x.etape !== 'idee').length} en production · ${all.filter(x => x.etape === 'pret' && !isDate(x.datePub)).length} en réserve`;
  el.innerHTML = mode === 'production' ? renderProduction() : (mode === 'interactions' ? renderInteractions() : renderCalendrier());
}
view('contenus', {
  label: 'Contenus', masquable: true,
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none"/></svg>',
  shell: () => `<div class="v-head v-head-row"><div><h1><span class="hl">Contenus</span></h1><p class="v-sub" id="ct-sub"></p></div><button type="button" class="btn btn-primary" data-action="cont-new">+ Contenu</button></div><div class="toolbar" id="ct-tools"></div><div id="v-cont"></div>`,
  render: renderContenus
});
action('cont-mode', a => { S.ui.contMode = a.dataset.value; saveUI(); refresh(); });
action('cont-filter', a => { const id = a.dataset.id; let c = S.ui.contComptes.slice(); if (!c.length) c = [id]; else { const i = c.indexOf(id); if (i >= 0) c.splice(i, 1); else c.push(id); if (c.length === COMPTES_DEFAUT.length) c = []; } S.ui.contComptes = c; saveUI(); refresh(); });
action('cont-next', a => guarded(async () => {
  const ct = get('contenus', a.dataset.id); if (!ct) return;
  const E = etapesOf(compte(ct.compte)), i = etapeIdx(ct), next = E[i + 1]; if (!next) return;
  const upd = { etape: next[0] }; if (next[0] === 'publie') upd.publieLe = S.today;
  await patch('contenus', ct.id, upd); toast('Étape : ' + next[1]);
}));
action('inter-inc', a => guarded(async () => {
  const d = S.today, j = clone(journee(d)) || {}, c = a.dataset.compte, k = a.dataset.k;
  j[c] = Object.assign({}, j[c] || {}); j[c][k] = Math.max(0, (Number(j[c][k]) || 0) + Number(a.dataset.d));
  delete j.id; await put('interactions', d, j);
}));
action('sugg-done', a => guarded(async () => { const s = get('suggestions', a.dataset.id); if (s) await patch('suggestions', s.id, { fait: !s.fait, faitLe: s.fait ? null : S.today }); }));
action('veille-suivi', a => guarded(async () => { await patch('notes', a.dataset.id, { suivi: 'suivi' }); toast('Noté : suivi sur LinkedIn'); }));
action('copy', a => copyText(a.dataset.text || ''));

/* ---- Fiche contenu ---- */
export function openContenuEditor(id, preset) {
  const ct = id ? get('contenus', id) : null;
  if (id && !ct) { toast('Ce contenu n’existe plus.', 'err'); return; }
  const first = (comptes().find(c => !c.pause) || comptes()[0]).id;
  const d = ct ? clone(ct) : Object.assign({ titre: '', compte: first, etape: 'idee', format: '', datePub: null, notes: '', lien: '' }, preset || {});
  const m = (d.medias && typeof d.medias === 'object') ? d.medias : {};
  d.sources = Array.isArray(m.sources) ? m.sources.slice() : []; d.credits = m.credits || '';
  d.id = ct ? ct.id : null;
  openSheet({ kind: 'contenu', draft: d, isNew: !ct });
}
sheet('contenu', {
  render(sh) {
    const d = sh.draft, c = compte(d.compte) || comptes()[0], E = etapesOf(c);
    if (!E.some(e => e[0] === d.etape)) d.etape = 'idee';
    let h = head(sh.isNew ? 'Nouveau contenu' : 'Contenu') + '<div class="sheet-body">';
    h += `<label class="fld"><span class="fld-l">Titre ou sujet</span><textarea id="c-titre" rows="2" data-field="titre"${sh.isNew ? ' data-autofocus' : ''}>${esc(d.titre)}</textarea></label>`;
    h += `<div class="fld-row"><label class="fld"><span class="fld-l">Compte</span><select id="c-compte" data-field="compte" data-rerender>${comptes().map(x => `<option value="${esc(x.id)}"${x.id === d.compte ? ' selected' : ''}>${esc(x.nom)}${x.pause ? ' (en pause)' : ''}</option>`).join('')}</select></label><label class="fld"><span class="fld-l">Format</span><select id="c-format" data-field="format">${opts([['', 'À définir']].concat(formatsOf(c)), d.format || '')}</select></label></div>`;
    h += `<fieldset class="fld"><legend class="fld-l">Étape</legend><div class="seg seg-wrap">${E.map(([k, l]) => `<button type="button" data-action="set-field" data-field="etape" data-value="${k}" data-rerender aria-pressed="${d.etape === k}">${l}</button>`).join('')}</div></fieldset>`;
    h += `<label class="fld"><span class="fld-l">Publication prévue</span><input id="c-pub" type="date" data-field="datePub" value="${d.datePub || ''}"></label>`;
    h += `<label class="fld"><span class="fld-l">Angle, plan, notes</span><textarea id="c-notes" rows="5" data-field="notes" placeholder="Accroche, idées clés, sources, appel à l’action…">${esc(d.notes || '')}</textarea></label>${linksHTML(d.notes, 'c-links', liens())}`;
    if (c.plateforme === 'youtube') {
      h += `<fieldset class="fld"><legend class="fld-l">Médias (vidéo faceless)</legend>${chipsMulti('sources', MEDIA_SOURCES.map(([k, l]) => [k, l, 'var(--accent)']), d.sources)}</fieldset>`;
      h += `<label class="fld"><span class="fld-l">Crédits et licences à citer</span><textarea id="c-credits" rows="3" data-field="credits" placeholder="Ex. Vidéo de X sur Pexels, musique Y (licence…)">${esc(d.credits || '')}</textarea></label>`;
      h += `<p class="hint">Banques gratuites : ${BANQUES.map(b => `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.nom)}</a>`).join(', ')}. Vérifie toujours la licence avant d’utiliser un média.</p>`;
    }
    if (d.etape === 'publie') h += `<div class="fld-row"><label class="fld"><span class="fld-l">Publié le</span><input id="c-publie" type="date" data-field="publieLe" value="${d.publieLe || S.today}"></label><label class="fld"><span class="fld-l">Lien de la publication</span><input id="c-lien" type="url" inputmode="url" data-field="lien" value="${esc(d.lien || '')}" placeholder="https://…"></label></div>`;
    return h + '</div>' + foot(!sh.isNew);
  },
  async save(sh) {
    const d = sh.draft, titre = String(d.titre || '').trim();
    if (!titre) throw { code: 'form', message: 'Donne un titre au contenu.' };
    const c = compte(d.compte); if (!c) throw { code: 'form', message: 'Choisis un compte.' };
    const old = d.id ? get('contenus', d.id) : null;
    const body = {
      titre, compte: c.id, etape: etapesOf(c).some(e => e[0] === d.etape) ? d.etape : 'idee', format: d.format || '',
      datePub: isDate(d.datePub) ? d.datePub : null, notes: String(d.notes || ''), lien: String(d.lien || '').trim(),
      creeLe: (old && old.creeLe) || S.today
    };
    if (body.etape === 'publie') body.publieLe = isDate(d.publieLe) ? d.publieLe : S.today;
    if (c.plateforme === 'youtube') body.medias = { sources: (d.sources || []).filter(k => MEDIA_SOURCES.some(m => m[0] === k)), credits: String(d.credits || '') };
    if (old && old.source) body.source = old.source;
    await put('contenus', d.id || newId('c'), body);
  },
  del: sh => remove('contenus', sh.draft.id),
  field(sh, t, isChange) {
    if (isChange && t.dataset.rerender != null) { renderSheet(); return; }
    if (isChange && t.dataset.field === 'notes') { const box = $('#c-links'); if (box) box.outerHTML = linksHTML(sh.draft.notes, 'c-links', liens()); }
  }
});
action('cont-new', a => openContenuEditor(null, a.dataset.compte ? { compte: a.dataset.compte, datePub: a.dataset.date || null } : null));
action('cont-edit', a => openContenuEditor(a.dataset.id));
