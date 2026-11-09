/* ROUTINE : trois rythmes dans un même cadre de l'en-tête, Giorno, Mese, Anno.
   Sur ordinateur, trois boutons ; sur téléphone, un seul bouton (l'anneau du jour) et des onglets dans la feuille.

   GIORNO : éléments à cocher chaque jour prévu (jours au choix par élément), série et 7 derniers jours.
     reglages/routine : { items: [{ id, titre, jours: [1..7], cree }] }
     reglages/routine-AAAA-MM-JJ : { jour, faits: [ids] }
   MESE et ANNO : éléments avec un objectif (ex. Livre, 1 par mois). Chaque élément a des lignes
     (un seul champ : titre et auteur, ou toute précision). Une ligne est prévue (à faire) ou faite (datée) ;
     une ligne prévue reste en attente d'une période à l'autre, une ligne faite compte pour sa période.
     reglages/routine-mese, reglages/routine-anno : { items: [{ id, titre, objectif, cree }] }
     reglages/rl-<id de l'élément> : { lignes: [{ id, texte, fait: AAAA-MM-JJ | null, cree }] } */
import { S, rg, put, guarded } from '../core/store.js';
import { $, esc, clone, newId, toast, ICON } from '../core/util.js';
import { addDays, addMonths, parseD, fShort, F_WD, F_MONTH, isDate, cap } from '../core/dates.js';
import { sheet, action, onChange, openSheet, renderSheet, ui, head } from '../core/ui.js';

const ONGLETS = [['giorno', 'Giorno'], ['mese', 'Mese'], ['anno', 'Anno']];
const NOM = { giorno: 'Giorno', mese: 'Mese', anno: 'Anno' };
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/* =================== GIORNO =================== */
const JOURS = [[1, 'L', 'lundi'], [2, 'M', 'mardi'], [3, 'M', 'mercredi'], [4, 'J', 'jeudi'], [5, 'V', 'vendredi'], [6, 'S', 'samedi'], [7, 'D', 'dimanche']];
const TOUS = [1, 2, 3, 4, 5, 6, 7], OUVRES = [1, 2, 3, 4, 5], WE = [6, 7];
const PRESETS = [['tous', 'Tous les jours', TOUS], ['ouvres', 'Lun. à ven.', OUVRES], ['we', 'Week-end', WE]];
function joursOk(j) { const a = (Array.isArray(j) ? j : TOUS).map(Number).filter(n => n >= 1 && n <= 7); return a.length ? [...new Set(a)].sort() : TOUS.slice(); }
export function itemsG() {
  const L = rg('routine').items;
  return (Array.isArray(L) ? L : []).filter(x => x && x.id).map(x => ({ id: String(x.id), titre: String(x.titre || ''), jours: joursOk(x.jours), cree: isDate(x.cree) ? x.cree : null }));
}
const iso = d => ((parseD(d).getDay() + 6) % 7) + 1;
const prevu = (it, d) => it.jours.includes(iso(d)) && (!it.cree || d >= it.cree);
function faits(d) { const f = rg('routine-' + d).faits; return new Set(Array.isArray(f) ? f.map(String) : []); }
const fait = (it, d) => faits(d).has(it.id);
function serie(it) {
  let d = S.today, n = 0;
  if (prevu(it, d) && !fait(it, d)) d = addDays(d, -1);
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
    if (it.cree && d < it.cree) break;
    if (!it.jours.includes(iso(d))) continue;
    if (fait(it, d)) n++; else break;
  }
  return n;
}
async function basculer(id, d) {
  const f = faits(d), oui = !f.has(id);
  if (oui) f.add(id); else f.delete(id);
  await put('reglages', 'routine-' + d, { jour: d, faits: [...f] });
  return oui;
}
function etatG() { const L = itemsG().filter(it => prevu(it, S.today)), f = faits(S.today); return { n: L.filter(it => f.has(it.id)).length, tot: L.length, vide: !itemsG().length }; }

function semaine(it) {
  let h = '';
  for (let i = 6; i >= 0; i--) {
    const d = addDays(S.today, -i), l = F_WD.format(parseD(d)).charAt(0).toUpperCase(), lib = fShort(d);
    if (!prevu(it, d)) { h += `<span class="ev-dot off" title="${esc(lib)} : pas prévu"><i>${esc(l)}</i></span>`; continue; }
    const ok = fait(it, d);
    h += `<button type="button" class="ev-dot${ok ? ' ok' : ''}${i === 0 ? ' auj' : ''}" data-action="ev-jour" data-id="${esc(it.id)}" data-d="${d}" aria-pressed="${ok}" aria-label="${esc(it.titre)}, ${esc(lib)} : ${ok ? 'fait' : 'pas fait'}" title="${esc(lib)}"><i>${esc(l)}</i></button>`;
  }
  return `<span class="ev-week">${h}</span>`;
}
function ligneG(it, auj) {
  const ok = auj && fait(it, S.today), s = serie(it);
  const sr = s ? `<span class="ev-serie${s >= 7 ? ' fort' : ''}">${s} j d’affilée</span>` : '';
  return `<li class="ev-row${ok ? ' fait' : ''}${auj ? '' : ' repos'}">${auj ? `<button type="button" class="oggi-check ev-check" data-action="ev-check" data-id="${esc(it.id)}" aria-pressed="${ok}" aria-label="${ok ? 'Décocher' : 'Cocher'} : ${esc(it.titre)}">${CHECK}</button>` : ''}<div class="ev-tw"><span class="ev-t">${esc(it.titre)}</span><span class="ev-meta">${semaine(it)}${sr}</span></div></li>`;
}
function corpsG() {
  const all = itemsG();
  if (!all.length) return `<div class="empty"><p class="empty-t">Rien dans Giorno</p><p>Ajoute ce que tu veux faire chaque jour (ou certains jours seulement), puis coche au fil de la journée.</p></div><button type="button" class="btn btn-primary" data-action="ev-edit">${ICON.plus} Créer la routine du jour</button>`;
  const L = all.filter(it => prevu(it, S.today)), repos = all.filter(it => !prevu(it, S.today)), f = faits(S.today);
  const n = L.filter(it => f.has(it.id)).length, afaire = L.filter(it => !f.has(it.id)), fl = L.filter(it => f.has(it.id));
  let h = `<p class="oggi-sum">${fShort(S.today)} · ${!L.length ? 'rien de prévu aujourd’hui' : (n === L.length ? `tout est fait (${n} sur ${L.length}). Bravo !` : `${n} sur ${L.length} fait${n > 1 ? 's' : ''}`)}</p>`;
  if (afaire.length) h += `<ul class="ev-list">${afaire.map(it => ligneG(it, true)).join('')}</ul>`;
  if (fl.length) h += `<section class="oggi-sec"><h3 class="oggi-g g-fait"><span>Fait aujourd’hui</span><span class="cnt">${fl.length}</span></h3><ul class="ev-list">${fl.map(it => ligneG(it, true)).join('')}</ul></section>`;
  if (repos.length) h += `<section class="oggi-sec"><h3 class="oggi-g"><span>Pas prévu aujourd’hui</span><span class="cnt">${repos.length}</span></h3><ul class="ev-list">${repos.map(it => ligneG(it, false)).join('')}</ul></section>`;
  h += '<p class="hint">Les pastilles montrent les 7 derniers jours : touche celle d’un jour passé pour le cocher après coup.</p>';
  return h + `<button type="button" class="btn" data-action="ev-edit">Modifier Giorno</button>`;
}
function editG(sh) {
  const L = sh.items;
  let h = '<p class="hint">Pour chaque élément, choisis ses jours. L’ordre ici est celui de ta liste.</p>';
  h += L.length ? `<ul class="ev-elist">${L.map((it, i) => {
    const k = it.jours.join(',');
    return `<li class="ev-erow">${editTop(i, it, L.length)}<div class="ev-ebot"><span class="ev-jours" role="group" aria-label="Jours">${JOURS.map(([n, l, nom]) => `<button type="button" class="ev-j" data-action="ev-j" data-i="${i}" data-n="${n}" aria-pressed="${it.jours.includes(n)}" aria-label="${nom}" title="${nom}">${l}</button>`).join('')}</span><span class="ev-pre">${PRESETS.map(([id, l, J]) => `<button type="button" class="linkbtn${J.join(',') === k ? ' on' : ''}" data-action="ev-pre" data-i="${i}" data-p="${id}">${l}</button>`).join('')}</span></div></li>`;
  }).join('')}</ul>` : '<p class="muted">Aucun élément pour l’instant.</p>';
  return h + addNew(sh, 'Nouvel élément (ex. 20 min de lecture)');
}

/* =================== MESE et ANNO =================== */
const CLE_ITEMS = { mese: 'routine-mese', anno: 'routine-anno' };
export function itemsP(t) {
  const L = rg(CLE_ITEMS[t]).items;
  return (Array.isArray(L) ? L : []).filter(x => x && x.id).map(x => ({ id: String(x.id), titre: String(x.titre || ''), objectif: Math.max(1, Math.round(Number(x.objectif) || 1)), cree: isDate(x.cree) ? x.cree : null }));
}
function lignes(id) { const L = rg('rl-' + id).lignes; return (Array.isArray(L) ? L : []).filter(l => l && l.id).map(l => ({ id: String(l.id), texte: String(l.texte || ''), fait: isDate(l.fait) ? l.fait : null, cree: l.cree || null })); }
async function saveLignes(id, L) { await put('reglages', 'rl-' + id, { lignes: L }); }
/* Période : clé (AAAA-MM ou AAAA), premier jour, libellé. off = décalage depuis la période en cours. */
function periode(t, off) {
  off = off || 0;
  if (t === 'mese') { const d0 = addMonths(S.today.slice(0, 8) + '01', off); return { cle: d0.slice(0, 7), debut: d0, lib: cap(F_MONTH.format(parseD(d0))), courante: off === 0 }; }
  const y = Number(S.today.slice(0, 4)) + off; return { cle: String(y), debut: y + '-01-01', lib: String(y), courante: off === 0 };
}
const dansP = (l, p) => !!l.fait && l.fait.startsWith(p.cle);
function etatP(t) { const P = periode(t, 0), L = itemsP(t); return { n: L.filter(it => lignes(it.id).filter(l => dansP(l, P)).length >= it.objectif).length, tot: L.length, vide: !L.length }; }

function ligneL(it, l, p) {
  const ok = !!l.fait, enEdition = cur() && cur().editL === l.id;
  /* Texte affiché en entier ; touché, il devient un champ pour le corriger */
  const txt = enEdition
    ? `<input class="rl-in" data-change="rl-txt" data-it="${esc(it.id)}" data-l="${esc(l.id)}" value="${esc(l.texte)}" placeholder="Titre et auteur, ou précision" aria-label="Corriger la ligne" data-autofocus>`
    : `<button type="button" class="rl-txt${l.texte ? '' : ' vide'}" data-action="rl-edit" data-l="${esc(l.id)}" title="Corriger">${esc(l.texte || 'sans précision')}</button>`;
  return `<li class="rl-row${ok ? ' fait' : ''}"><button type="button" class="rl-ck" data-action="rl-ck" data-it="${esc(it.id)}" data-l="${esc(l.id)}" aria-pressed="${ok}" aria-label="${ok ? 'Remettre à faire' : 'Marquer comme fait'}">${CHECK}</button>${txt}${ok ? `<span class="rl-date">${esc(fShort(l.fait))}</span>` : ''}<button type="button" class="icon-btn sm" data-action="rl-del" data-it="${esc(it.id)}" data-l="${esc(l.id)}" aria-label="Supprimer la ligne">${ICON.close}</button></li>`;
}
function carte(t, it, p) {
  const L = lignes(it.id), F = L.filter(l => dansP(l, p)).sort((a, b) => a.fait < b.fait ? -1 : 1), A = p.courante ? L.filter(l => !l.fait) : [];
  const n = F.length, ok = n >= it.objectif;
  const unite = t === 'mese' ? 'par mois' : 'par an';
  let h = `<section class="rl-card${ok ? ' ok' : ''}"><div class="rl-head"><span class="rl-t">${esc(it.titre)}</span><span class="rl-prog${ok ? ' ok' : ''}">${ok ? CHECK : ''}${n} / ${it.objectif}<small> ${unite}</small></span></div>`;
  if (F.length || A.length) h += `<ul class="rl-list">${F.map(l => ligneL(it, l, p)).join('')}${A.length ? `${F.length ? '<li class="rl-sep">À faire</li>' : ''}${A.map(l => ligneL(it, l, p)).join('')}` : ''}</ul>`;
  h += `<div class="rl-add"><input id="rl-new-${esc(it.id)}" class="rl-new" data-it="${esc(it.id)}" placeholder="${esc(it.titre)} : nom, titre, précision…" aria-label="Nouvelle ligne pour ${esc(it.titre)}" enterkeyhint="done"><button type="button" class="btn btn-sm" data-action="rl-add" data-it="${esc(it.id)}" data-etat="prevu" title="Ajouter à faire">À faire</button><button type="button" class="btn btn-sm btn-primary" data-action="rl-add" data-it="${esc(it.id)}" data-etat="fait" title="Ajouter comme fait">Fait</button></div>`;
  return h + '</section>';
}
function corpsP(t, sh) {
  const L = itemsP(t), nom = NOM[t];
  if (!L.length) return `<div class="empty"><p class="empty-t">Rien dans ${nom}</p><p>${t === 'mese' ? 'Ajoute ce que tu veux faire chaque mois, avec un objectif (ex. Livre : 1 par mois).' : 'Ajoute ce que tu veux faire chaque année, avec un objectif (ex. Livres : 12 par an).'} Pour chaque élément, tu notes ensuite des lignes (titre et auteur, ou toute précision), prévues ou faites.</p></div><button type="button" class="btn btn-primary" data-action="ev-edit">${ICON.plus} Créer ${nom}</button>`;
  const p = periode(t, sh.off || 0), n = L.filter(it => lignes(it.id).filter(l => dansP(l, p)).length >= it.objectif).length;
  let h = `<div class="rl-nav"><button type="button" class="icon-btn sm" data-action="rl-per" data-d="-1" aria-label="Période précédente">${ICON.left}</button><span class="rl-per">${esc(p.lib)}</span><button type="button" class="icon-btn sm" data-action="rl-per" data-d="1" aria-label="Période suivante"${p.courante ? ' disabled' : ''}>${ICON.right}</button>${p.courante ? '' : '<button type="button" class="linkbtn" data-action="rl-per" data-d="0">Revenir à aujourd’hui</button>'}</div>`;
  h += `<p class="oggi-sum">${n === L.length ? `Objectifs atteints : ${n} sur ${L.length}. Bravo !` : `${n} objectif${n > 1 ? 's' : ''} atteint${n > 1 ? 's' : ''} sur ${L.length}`}</p>`;
  h += L.map(it => carte(t, it, p)).join('');
  h += `<p class="hint">« À faire » note une ligne prévue (elle reste d’une période à l’autre jusqu’à ce que tu la coches) ; « Fait » l’ajoute comme faite${p.courante ? ' aujourd’hui' : ' pour ' + esc(p.lib)}. Touche le texte d’une ligne pour le corriger.</p>`;
  return h + `<button type="button" class="btn" data-action="ev-edit">Modifier ${nom}</button>`;
}
function editP(t, sh) {
  const L = sh.items, unite = t === 'mese' ? 'par mois' : 'par an';
  let h = `<p class="hint">Pour chaque élément, l’objectif ${unite}. L’ordre ici est celui de ta liste. Les lignes déjà notées sont conservées.</p>`;
  h += L.length ? `<ul class="ev-elist">${L.map((it, i) => `<li class="ev-erow">${editTop(i, it, L.length)}<div class="ev-ebot"><span class="rl-obj">Objectif<button type="button" class="icon-btn sm" data-action="rl-obj" data-i="${i}" data-d="-1" aria-label="Moins"${it.objectif > 1 ? '' : ' disabled'}>${ICON.minus}</button><b>${it.objectif}</b><button type="button" class="icon-btn sm" data-action="rl-obj" data-i="${i}" data-d="1" aria-label="Plus">${ICON.plus}</button>${unite}</span></div></li>`).join('')}</ul>` : '<p class="muted">Aucun élément pour l’instant.</p>';
  return h + addNew(sh, t === 'mese' ? 'Nouvel élément (ex. Livre, Film, Exposition)' : 'Nouvel élément (ex. Voyage, Formation)');
}

/* =================== Commun : édition =================== */
function editTop(i, it, n) {
  return `<div class="ev-etop"><input class="ev-ein" data-ev-i="${i}" value="${esc(it.titre)}" aria-label="Intitulé"><button type="button" class="icon-btn sm" data-action="ev-up" data-i="${i}" aria-label="Monter"${i ? '' : ' disabled'}>${ICON.up}</button><button type="button" class="icon-btn sm" data-action="ev-down" data-i="${i}" aria-label="Descendre"${i < n - 1 ? '' : ' disabled'}>${ICON.down}</button><button type="button" class="icon-btn sm" data-action="ev-del" data-i="${i}" aria-label="Retirer : ${esc(it.titre)}">${ICON.close}</button></div>`;
}
function addNew(sh, ph) {
  return `<div class="retro-add"><input id="ev-new" value="${esc(sh.nouveau || '')}" placeholder="${esc(ph)}" aria-label="Nouvel élément"${sh.items.length ? '' : ' data-autofocus'}><button type="button" class="btn btn-sm" data-action="ev-add">Ajouter</button></div>`;
}
const nouvelItem = (t, titre) => t === 'giorno' ? { id: newId('r'), titre, jours: TOUS.slice(), cree: S.today } : { id: newId('r'), titre, objectif: 1, cree: S.today };

/* =================== Feuille =================== */
function onglets(cur) { return `<div class="seg rt-tabs" role="tablist">${ONGLETS.map(([k, l]) => { const e = k === 'giorno' ? etatG() : etatP(k); return `<button type="button" role="tab" data-action="rt-tab" data-value="${k}" aria-pressed="${k === cur}" aria-selected="${k === cur}">${l}${e.tot ? `<span class="cnt">${e.n}/${e.tot}</span>` : ''}</button>`; }).join('')}</div>`; }
sheet('routine', {
  render(sh) {
    const t = sh.tab;
    if (sh.edit) return head('Modifier ' + NOM[t]) + `<div class="sheet-body">${t === 'giorno' ? editG(sh) : editP(t, sh)}</div><footer class="sheet-foot"><span class="spacer"></span><button type="button" class="btn btn-ghost" data-action="ev-back">Annuler</button><button type="button" class="btn btn-primary" data-action="ev-save">Enregistrer</button></footer>`;
    return head('Routine') + `<div class="sheet-body">${onglets(t)}${t === 'giorno' ? corpsG() : corpsP(t, sh)}</div>`;
  },
  field(sh, t) {
    if (!sh.edit) return;
    if (t.id === 'ev-new') { sh.nouveau = t.value; return; }
    if (t.dataset.evI != null) { const it = sh.items[Number(t.dataset.evI)]; if (it) it.titre = t.value; }
  }
});
const cur = () => (ui.sheet && ui.sheet.kind === 'routine') ? ui.sheet : null;
const edit = () => { const sh = cur(); return sh && sh.edit ? sh : null; };
function ouvrir(tab) { S.ui.rtTab = tab; openSheet({ kind: 'routine', tab, off: 0 }); }

/* ---- Actions communes ---- */
action('routine', a => ouvrir(a.dataset.tab || S.ui.rtTab || 'giorno'));
const enHaut = () => { const b = $('#sheet-root .sheet-body'); if (b) b.scrollTop = 0; };
action('rt-tab', a => { const sh = cur(); if (!sh) return; sh.tab = a.dataset.value; sh.off = 0; sh.editL = null; S.ui.rtTab = sh.tab; renderSheet(); enHaut(); });
action('ev-edit', () => { const sh = cur(); if (!sh) return; sh.edit = true; sh.nouveau = ''; sh.items = clone(sh.tab === 'giorno' ? itemsG() : itemsP(sh.tab)); renderSheet(); });
action('ev-back', () => { const sh = cur(); if (!sh) return; sh.edit = false; renderSheet(); });
function addFromInput() {
  const sh = edit(), f = $('#ev-new'); if (!sh || !f) return;
  const titre = f.value.trim(); if (!titre) { f.focus(); return; }
  sh.items.push(nouvelItem(sh.tab, titre)); sh.nouveau = '';
  renderSheet(); const g = $('#ev-new'); if (g) g.focus();
}
action('ev-add', () => addFromInput());
action('ev-del', a => { const sh = edit(); if (!sh) return; sh.items.splice(Number(a.dataset.i), 1); renderSheet(); });
action('ev-up', a => { const sh = edit(), i = Number(a.dataset.i); if (!sh || i < 1) return; [sh.items[i - 1], sh.items[i]] = [sh.items[i], sh.items[i - 1]]; renderSheet(); });
action('ev-down', a => { const sh = edit(), i = Number(a.dataset.i); if (!sh || i >= sh.items.length - 1) return; [sh.items[i + 1], sh.items[i]] = [sh.items[i], sh.items[i + 1]]; renderSheet(); });
action('ev-save', () => guarded(async () => {
  const sh = edit(); if (!sh) return;
  const nf = $('#ev-new'); if (nf && nf.value.trim()) sh.items.push(nouvelItem(sh.tab, nf.value.trim()));
  if (sh.tab === 'giorno') await put('reglages', 'routine', { items: sh.items.map(it => ({ id: it.id, titre: String(it.titre || '').trim(), jours: joursOk(it.jours), cree: it.cree || S.today })).filter(it => it.titre) });
  else await put('reglages', CLE_ITEMS[sh.tab], { items: sh.items.map(it => ({ id: it.id, titre: String(it.titre || '').trim(), objectif: Math.max(1, Math.round(Number(it.objectif) || 1)), cree: it.cree || S.today })).filter(it => it.titre) });
  sh.edit = false; renderSheet(); toast(NOM[sh.tab] + ' enregistré');
}));

/* ---- Giorno ---- */
const titreG = id => { const it = itemsG().find(x => x.id === id); return it ? it.titre : 'élément'; };
action('ev-check', a => guarded(async () => { const oui = await basculer(a.dataset.id, S.today); toast((oui ? 'Fait : ' : 'Décoché : ') + titreG(a.dataset.id)); }));
action('ev-jour', a => guarded(async () => { const oui = await basculer(a.dataset.id, a.dataset.d); toast((oui ? 'Fait le ' : 'Décoché le ') + fShort(a.dataset.d) + ' : ' + titreG(a.dataset.id)); }));
action('ev-j', a => {
  const sh = edit(), it = sh && sh.items[Number(a.dataset.i)]; if (!it) return;
  const n = Number(a.dataset.n), has = it.jours.includes(n);
  if (has && it.jours.length === 1) { toast('Garde au moins un jour.'); return; }
  it.jours = has ? it.jours.filter(x => x !== n) : [...it.jours, n].sort(); renderSheet();
});
action('ev-pre', a => { const sh = edit(), it = sh && sh.items[Number(a.dataset.i)], p = PRESETS.find(x => x[0] === a.dataset.p); if (it && p) { it.jours = p[2].slice(); renderSheet(); } });

/* ---- Mese et Anno ---- */
action('rl-obj', a => { const sh = edit(), it = sh && sh.items[Number(a.dataset.i)]; if (!it) return; it.objectif = Math.max(1, Math.min(365, (Number(it.objectif) || 1) + Number(a.dataset.d))); renderSheet(); });
action('rl-per', a => { const sh = cur(); if (!sh) return; const d = Number(a.dataset.d); sh.off = d === 0 ? 0 : Math.min(0, (sh.off || 0) + d); renderSheet(); enHaut(); });
/* Jour noté quand on coche : aujourd'hui, ou le premier jour de la période affichée si elle est passée */
const jourFait = sh => { const p = periode(sh.tab, sh.off || 0); return p.courante ? S.today : p.debut; };
const titreP = (t, id) => { const it = itemsP(t).find(x => x.id === id); return it ? it.titre : 'élément'; };
async function ajouterLigne(itId, etat) {
  const sh = cur(); if (!sh) return;
  const f = $('#rl-new-' + itId), texte = f ? f.value.trim() : '';
  if (etat === 'prevu' && !texte) { if (f) f.focus(); toast('Écris d’abord ce qui est prévu.'); return; }
  const L = lignes(itId); L.push({ id: newId('l'), texte, fait: etat === 'fait' ? jourFait(sh) : null, cree: S.today });
  await saveLignes(itId, L);
  toast((etat === 'fait' ? 'Fait : ' : 'À faire : ') + titreP(sh.tab, itId) + (texte ? ', ' + texte : ''));
}
action('rl-add', a => guarded(() => ajouterLigne(a.dataset.it, a.dataset.etat)));
action('rl-ck', a => guarded(async () => {
  const sh = cur(); if (!sh) return;
  const L = lignes(a.dataset.it), l = L.find(x => x.id === a.dataset.l); if (!l) return;
  l.fait = l.fait ? null : jourFait(sh);
  await saveLignes(a.dataset.it, L);
  toast((l.fait ? 'Fait : ' : 'Remis à faire : ') + (l.texte || titreP(sh.tab, a.dataset.it)));
}));
action('rl-del', a => guarded(async () => {
  const L = lignes(a.dataset.it), l = L.find(x => x.id === a.dataset.l); if (!l) return;
  await saveLignes(a.dataset.it, L.filter(x => x.id !== l.id));
  toast('Ligne supprimée' + (l.texte ? ' : ' + l.texte : ''));
}));
action('rl-edit', a => { const sh = cur(); if (!sh) return; sh.editL = a.dataset.l; renderSheet(); const f = $('.rl-in[data-l="' + a.dataset.l + '"]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } });
onChange('@rl-txt', el => guarded(async () => {
  const sh = cur(); if (sh) sh.editL = null;
  const L = lignes(el.dataset.it), l = L.find(x => x.id === el.dataset.l);
  if (!l || l.texte === el.value.trim()) { renderSheet(); return; }
  l.texte = el.value.trim(); await saveLignes(el.dataset.it, L); toast('Ligne corrigée');
}));
/* Entrée : ajoute (nouvel élément en édition ; nouvelle ligne, comme prévue) */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target) return;
  if (e.target.id === 'ev-new') { e.preventDefault(); addFromInput(); }
  else if (e.target.classList && e.target.classList.contains('rl-new')) { e.preventDefault(); guarded(() => ajouterLigne(e.target.dataset.it, 'prevu')); }
  else if (e.target.classList && e.target.classList.contains('rl-in')) { e.preventDefault(); e.target.blur(); }
});

/* =================== En-tête : le cadre ROUTINE =================== */
function anneau(n, tot) {
  const r = 15, c = 2 * Math.PI * r, p = tot ? n / tot : 0;
  return `<svg class="ev-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="${r}" class="ev-ring-bg"/>${p ? `<circle cx="18" cy="18" r="${r}" class="ev-ring-fg" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 18 18)"/>` : ''}</svg>`;
}
function renderBtn(t) {
  const b = $('#rt-' + t); if (!b) return;
  const e = S.db ? (t === 'giorno' ? etatG() : etatP(t)) : { n: 0, tot: 0, vide: true }, fini = e.tot && e.n === e.tot;
  b.dataset.state = e.vide ? 'vide' : (fini ? 'fini' : 'cours');
  b.innerHTML = `<span class="ev-ic">${anneau(e.n, e.tot)}<b>${fini ? CHECK : (e.tot ? e.n + '/' + e.tot : '')}</b></span><span class="rt-l">${NOM[t]}</span>`;
  const quand = t === 'giorno' ? 'aujourd’hui' : (t === 'mese' ? 'ce mois-ci' : 'cette année');
  const tt = e.vide ? `${NOM[t]} : à créer` : (e.tot ? `${NOM[t]} : ${e.n} sur ${e.tot} ${t === 'giorno' ? 'fait' + (e.n > 1 ? 's' : '') : 'objectif' + (e.n > 1 ? 's' : '') + ' atteint' + (e.n > 1 ? 's' : '')} ${quand}` : `${NOM[t]} : rien de prévu ${quand}`);
  b.title = tt; b.setAttribute('aria-label', tt);
}
export function routineRefresh() {
  for (const [t] of ONGLETS) renderBtn(t);
  const sh = cur(); if (sh && !sh.edit) renderSheet();
}
