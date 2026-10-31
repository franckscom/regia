/* Réunions : liste, fiche avec compte-rendu et liens, export Excel. */
import { S, list, get, put, remove, saveUI } from '../core/store.js';
import { $, esc, clone, newId, toast, linksHTML } from '../core/util.js';
import { isDate, isTime, parseD, F_DM, fFull, stamp } from '../core/dates.js';
import { REU_TYPES, REU_DEFAUT, CATEGORIES, catInfo, color } from '../core/config.js';
import { view, action, onInput, sheet, openSheet, renderSheet, ui, head, foot, gate, empty, section, liens, refresh, chipsMulti } from '../core/ui.js';
import { saveFile, xlsxFile } from '../core/files.js';

export function reunions() { return list('reunions'); }
export function reuType(k) { const t = REU_TYPES.find(x => x[0] === k); return t ? t[1] : 'Réunion'; }
export function reuCats(r) { return (Array.isArray(r.categories) ? r.categories : []).map(catInfo).filter(Boolean); }
function hasCR(r) { return !!String(r.compteRendu || '').trim(); }
export function byReu(a, b) { const x = (a.date || '9999') + (a.heure || ''), y = (b.date || '9999') + (b.heure || ''); return x < y ? -1 : (x > y ? 1 : String(a.titre).localeCompare(String(b.titre), 'fr')); }
export function reuRow(r, o) {
  o = o || {};
  const d = isDate(r.date) ? r.date : null, past = d && d < S.today;
  const box = d ? `<span class="rdate${d === S.today ? ' today' : ''}"><b>${parseD(d).getDate()}</b><small>${esc(F_DM.format(parseD(d)).replace('.', ''))}</small></span>` : '<span class="rdate nod"><b>?</b><small>date</small></span>';
  const meta = [`<span class="st">${esc(reuType(r.type))}</span>`];
  if (r.heure) meta.push(`<span class="date">${esc(r.heure)}</span>`);
  if (r.lieu && r.type !== 'visio') meta.push(`<span>${esc(r.lieu)}</span>`);
  if (r.avec) meta.push(`<span>avec ${esc(r.avec)}</span>`);
  for (const c of reuCats(r)) meta.push(`<span class="cat" style="--c:${c.c}">${esc(c.nom)}</span>`);
  if (hasCR(r)) meta.push('<span class="cr-ok">✓ compte-rendu</span>');
  else if (past) meta.push('<span class="cr-todo">compte-rendu à faire</span>');
  const sel = o.noSel ? '<span></span>' : `<input type="checkbox" class="rsel" data-action="reu-sel" data-id="${esc(r.id)}"${S.sel.has(r.id) ? ' checked' : ''} aria-label="Sélectionner pour l’export : ${esc(r.titre)}">`;
  return `<div class="rrow">${box}<button type="button" class="row-main" data-action="edit-reu" data-id="${esc(r.id)}"><span class="row-title">${esc(r.titre || 'Réunion')}</span><span class="row-meta">${meta.join('')}</span></button>${sel}</div>`;
}
function reuFiltered() {
  const cats = S.ui.reuCats, q = S.rq.trim().toLowerCase();
  return reunions().filter(r => {
    if (cats.length && !(Array.isArray(r.categories) && r.categories.some(c => cats.includes(c)))) return false;
    if (q && !['titre', 'lieu', 'avec', 'compteRendu', 'liens'].map(k => String(r[k] || '')).join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderReunions() {
  const el = $('#v-reu'), cb = $('#reu-cats');
  if (cb) cb.innerHTML = CATEGORIES.map(([k, l, c]) => `<button type="button" class="chip" data-action="reu-cat" data-id="${k}" aria-pressed="${!S.ui.reuCats.length || S.ui.reuCats.includes(k)}" style="--c:${color(c)}">${esc(l)}</button>`).join('');
  if (!gate(el)) return;
  const all = reunions(), L = reuFiltered();
  for (const id of Array.from(S.sel)) if (!S.data.reunions.has(id)) S.sel.delete(id);
  const sub = $('#reu-sub'); if (sub) { const up = all.filter(r => isDate(r.date) && r.date >= S.today).length, todo = all.filter(r => isDate(r.date) && r.date < S.today && !hasCR(r)).length; sub.textContent = `${up} à venir · ${todo} compte${todo > 1 ? 's' : ''}-rendu${todo > 1 ? 's' : ''} à faire`; }
  if (!all.length) { el.innerHTML = empty('Aucune réunion pour l’instant.', 'Ajoute-en une avec le bouton ci-dessus, ou demande à Claude : « Ajoute dans mes Réunions… ».'); return; }
  const nSel = S.sel.size;
  let h = `<div class="reu-bar"><span>${nSel ? nSel + ' sélectionnée' + (nSel > 1 ? 's' : '') : 'Coche des réunions pour n’exporter qu’elles'}</span>${nSel ? '<button type="button" class="linkbtn" data-action="reu-sel-clear">Tout décocher</button>' : ''}<span class="spacer"></span><button type="button" class="btn btn-sm" data-action="reu-export">Exporter en Excel (${nSel || L.length})</button></div>`;
  if (!L.length) { el.innerHTML = h + empty('Aucune réunion ne correspond.', 'Change les catégories ou efface la recherche.'); return; }
  const up = L.filter(r => isDate(r.date) && r.date >= S.today).sort(byReu);
  const nod = L.filter(r => !isDate(r.date)).sort(byReu);
  const past = L.filter(r => isDate(r.date) && r.date < S.today).sort((a, b) => byReu(b, a));
  const rows = X => X.map(r => reuRow(r)).join('');
  h += section('reu-up', 'À venir', up.length, up.length ? rows(up) : '<p class="empty-line">Rien de prévu.</p>');
  if (nod.length) h += section('reu-nod', 'Date à fixer', nod.length, rows(nod));
  if (past.length) h += section('reu-past', 'Passées', past.length, rows(past));
  el.innerHTML = h;
}
view('reunions', {
  label: 'Réunions', masquable: true,
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5M13.8 14.7c.8-.4 1.7-.6 2.7-.6 2.4 0 4.2 1.5 4.8 4.4"/></svg>',
  shell: () => `<div class="v-head v-head-row"><div><h1><span class="hl">Réunions</span></h1><p class="v-sub" id="reu-sub"></p></div><button type="button" class="btn btn-primary" data-action="new-reu">+ Nouvelle réunion</button></div>
    <div class="reu-tools"><input id="reu-search" type="search" placeholder="Rechercher (intitulé, personne, compte-rendu…)" aria-label="Rechercher une réunion" value="${esc(S.rq)}"></div><div class="chips" id="reu-cats" role="group" aria-label="Catégories affichées"></div><p class="hint" style="margin:-4px 0 6px">Touche une catégorie pour n’afficher qu’elle, puis d’autres pour les ajouter.</p><div id="v-reu"></div>`,
  render: renderReunions
});
onInput('reu-search', el => { S.rq = el.value; renderReunions(); });

/* ---- Fiche réunion ---- */
export function openReuEditor(id, preset) {
  const r = id ? get('reunions', id) : null;
  if (id && !r) { toast('Cette réunion n’existe plus.', 'err'); return; }
  const draft = r ? clone(r) : Object.assign(clone(REU_DEFAUT), { date: S.today }, preset || {});
  if (!Array.isArray(draft.categories)) draft.categories = [];
  draft.id = r ? r.id : null;
  openSheet({ kind: 'reunion', draft, isNew: !r });
}
function reuLinks(d) { return linksHTML(String(d.liens || '') + '\n' + String(d.compteRendu || ''), 'r-links', liens()); }
sheet('reunion', {
  render(sh) {
    const d = sh.draft;
    let h = head(sh.isNew ? 'Nouvelle réunion' : 'Réunion') + '<div class="sheet-body">';
    h += `<label class="fld"><span class="fld-l">Intitulé</span><input id="r-titre" data-field="titre" value="${esc(d.titre)}" placeholder="Ex. Point mission tutorée"${sh.isNew ? ' data-autofocus' : ''}></label>`;
    h += `<div class="fld-row"><label class="fld"><span class="fld-l">Date</span><input id="r-date" type="date" data-field="date" value="${d.date || ''}"></label><label class="fld"><span class="fld-l">Heure</span><input id="r-heure" type="time" data-field="heure" value="${esc(d.heure || '')}"></label></div>`;
    h += `<fieldset class="fld"><legend class="fld-l">Type</legend><div class="seg">${REU_TYPES.map(([k, l]) => `<button type="button" data-action="set-field" data-field="type" data-value="${k}" data-rerender aria-pressed="${d.type === k}">${l}</button>`).join('')}</div></fieldset>`;
    if (d.type !== 'visio') h += `<label class="fld"><span class="fld-l">Lieu</span><input id="r-lieu" data-field="lieu" value="${esc(d.lieu || '')}" placeholder="Ex. UT2J, bâtiment Erasme"></label>`;
    h += `<label class="fld"><span class="fld-l">Avec</span><input id="r-avec" data-field="avec" value="${esc(d.avec || '')}" placeholder="Personnes, organisation"></label>`;
    h += `<fieldset class="fld"><legend class="fld-l">Catégories (plusieurs possibles)</legend><div class="chips" style="margin:0">${CATEGORIES.map(([k, l, c]) => `<button type="button" class="chip" data-action="reu-cat-f" data-id="${k}" aria-pressed="${d.categories.includes(k)}" style="--c:${color(c)}">${esc(l)}</button>`).join('')}</div></fieldset>`;
    h += `<label class="fld"><span class="fld-l">Compte-rendu</span><textarea id="r-cr" rows="9" data-field="compteRendu" placeholder="Tape ou colle ici le compte-rendu (notes, transcription, décisions, suites à donner)">${esc(d.compteRendu || '')}</textarea></label>`;
    h += `<label class="fld"><span class="fld-l">Liens (un par ligne)</span><textarea id="r-liens" rows="3" data-field="liens" placeholder="Enregistrement : https://…">${esc(d.liens || '')}</textarea></label>${reuLinks(d)}`;
    if (!sh.isNew) h += `<div><button type="button" class="btn btn-sm" data-action="reu-export-one">Exporter cette réunion en Excel</button></div>`;
    return h + '</div>' + foot(!sh.isNew);
  },
  async save(sh) { await saveReunion(sh.draft); },
  del: sh => remove('reunions', sh.draft.id),
  field(sh, t, isChange) { const f = t.dataset.field; if (isChange && (f === 'liens' || f === 'compteRendu')) { const box = $('#r-links'); if (box) box.outerHTML = reuLinks(sh.draft); } }
});
export async function saveReunion(d) {
  const titre = String(d.titre || '').trim();
  if (!titre) throw { code: 'form', message: 'Donne un intitulé à la réunion.' };
  const old = d.id ? get('reunions', d.id) : null, id = d.id || newId('r');
  const type = REU_TYPES.some(x => x[0] === d.type) ? d.type : 'presentiel';
  await put('reunions', id, {
    titre, date: isDate(d.date) ? d.date : null, heure: isTime(String(d.heure || '')) ? d.heure : '',
    type, lieu: type === 'visio' ? '' : String(d.lieu || '').trim(), avec: String(d.avec || '').trim(),
    categories: (Array.isArray(d.categories) ? d.categories : []).filter(c => catInfo(c)),
    compteRendu: String(d.compteRendu || ''), liens: String(d.liens || ''),
    creeLe: (old && old.creeLe) || S.today, modifieLe: S.today
  });
  return id;
}
async function exportReunions(L, nom) {
  if (!L.length) { toast('Aucune réunion à exporter.', 'err'); return; }
  let blob;
  try {
    blob = await xlsxFile('Réunions', L.slice().sort(byReu).map(r => ({
      'Date': isDate(r.date) ? fFull(r.date) : '', 'Heure': r.heure || '', 'Réunion': r.titre || '', 'Type': reuType(r.type),
      'Lieu': r.type === 'visio' ? '' : (r.lieu || ''), 'Avec': r.avec || '', 'Catégories': reuCats(r).map(c => c.nom).join(', '),
      'Compte-rendu': r.compteRendu || '', 'Liens': r.liens || ''
    })), [11, 7, 34, 11, 22, 24, 22, 90, 45]);
  } catch (e) { toast('Export impossible : la bibliothèque Excel n’a pas pu être chargée. Rouvre l’app une fois en ligne.', 'err'); return; }
  const r = await saveFile(nom + '_' + stamp(S.today) + '.xlsx', blob);
  if (r === 'saved') toast('Fichier Excel téléchargé');
}
action('new-reu', () => openReuEditor(null));
action('edit-reu', a => openReuEditor(a.dataset.id));
action('reu-cat-f', a => { const sh = ui.sheet; if (!sh) return; const c = sh.draft.categories, id = a.dataset.id, i = c.indexOf(id); if (i >= 0) c.splice(i, 1); else c.push(id); a.setAttribute('aria-pressed', String(i < 0)); });
action('reu-cat', a => { const id = a.dataset.id; let c = S.ui.reuCats.slice(); if (!c.length) c = [id]; else { const i = c.indexOf(id); if (i >= 0) c.splice(i, 1); else c.push(id); if (c.length === CATEGORIES.length) c = []; } S.ui.reuCats = c; saveUI(); refresh(); });
action('reu-sel', a => { if (a.checked) S.sel.add(a.dataset.id); else S.sel.delete(a.dataset.id); refresh(); });
action('reu-sel-clear', () => { S.sel.clear(); refresh(); });
action('reu-export', () => { const L = S.sel.size ? Array.from(S.sel).map(k => get('reunions', k)).filter(Boolean) : reuFiltered(); return exportReunions(L, S.sel.size === 1 ? 'Réunion' : 'Réunions'); });
action('reu-export-one', () => { const sh = ui.sheet; if (sh && sh.draft.id) { const r = get('reunions', sh.draft.id); if (r) return exportReunions([r], 'Réunion'); } });
