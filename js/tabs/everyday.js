/* EVERYDAY : la routine du jour. Bouton à gauche de « Synchroniser » ; on coche ce qui est fait.
   Chaque élément a ses jours (lundi = 1 … dimanche = 7). Pour chacun : la série (jours prévus d'affilée faits)
   et les 7 derniers jours, que l'on peut cocher après coup (oubli d'hier).
   Données (synchronisées, dans reglages) :
   - reglages/routine : { items: [{ id, titre, jours: [1..7], cree: AAAA-MM-JJ }] } (l'ordre de la liste est celui affiché) ;
   - reglages/routine-AAAA-MM-JJ : { jour, faits: [ids] }, une fiche par jour. */
import { S, rg, put, guarded } from '../core/store.js';
import { $, esc, clone, newId, toast, ICON } from '../core/util.js';
import { addDays, parseD, fShort, F_WD, isDate } from '../core/dates.js';
import { sheet, action, openSheet, renderSheet, ui, head } from '../core/ui.js';

const JOURS = [[1, 'L', 'lundi'], [2, 'M', 'mardi'], [3, 'M', 'mercredi'], [4, 'J', 'jeudi'], [5, 'V', 'vendredi'], [6, 'S', 'samedi'], [7, 'D', 'dimanche']];
const TOUS = [1, 2, 3, 4, 5, 6, 7], OUVRES = [1, 2, 3, 4, 5], WE = [6, 7];
const PRESETS = [['tous', 'Tous les jours', TOUS], ['ouvres', 'Lun. à ven.', OUVRES], ['we', 'Week-end', WE]];

/* ---- Données ---- */
export function items() {
  const L = rg('routine').items;
  return (Array.isArray(L) ? L : []).filter(x => x && x.id).map(x => ({ id: String(x.id), titre: String(x.titre || ''), jours: joursOk(x.jours), cree: isDate(x.cree) ? x.cree : null }));
}
function joursOk(j) { const a = (Array.isArray(j) ? j : TOUS).map(Number).filter(n => n >= 1 && n <= 7); return a.length ? [...new Set(a)].sort() : TOUS.slice(); }
const iso = d => ((parseD(d).getDay() + 6) % 7) + 1;
const prevu = (it, d) => it.jours.includes(iso(d)) && (!it.cree || d >= it.cree);
function faits(d) { const f = rg('routine-' + d).faits; return new Set(Array.isArray(f) ? f.map(String) : []); }
const fait = (it, d) => faits(d).has(it.id);
export function duJour() { return items().filter(it => prevu(it, S.today)); }

/* Série : jours prévus faits d'affilée. Aujourd'hui pas encore coché ne casse pas la série. */
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

/* ---- Écritures ---- */
async function basculer(id, d) {
  const f = faits(d), oui = !f.has(id);
  if (oui) f.add(id); else f.delete(id);
  await put('reglages', 'routine-' + d, { jour: d, faits: [...f] });
  return oui;
}

/* ---- Bouton de l'en-tête : anneau de progression ---- */
function anneau(n, tot) {
  const r = 15, c = 2 * Math.PI * r, p = tot ? n / tot : 0;
  return `<svg class="ev-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="${r}" class="ev-ring-bg"/>${p ? `<circle cx="18" cy="18" r="${r}" class="ev-ring-fg" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 18 18)"/>` : ''}</svg>`;
}
function renderBtn() {
  const b = $('#every-btn'); if (!b) return;
  const L = S.db ? duJour() : [], f = faits(S.today), n = L.filter(it => f.has(it.id)).length, tot = L.length;
  const fini = tot && n === tot;
  b.dataset.state = !items().length ? 'vide' : (fini ? 'fini' : 'cours');
  b.innerHTML = `<span class="ev-ic">${anneau(n, tot)}<b>${fini ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : (tot ? n + '/' + tot : '')}</b></span><span class="ev-l">Everyday</span>`;
  const t = !items().length ? 'Everyday : crée ta routine' : (tot ? `Everyday : ${n} sur ${tot} fait${n > 1 ? 's' : ''} aujourd’hui` : 'Everyday : rien de prévu aujourd’hui');
  b.title = t; b.setAttribute('aria-label', t);
}

/* ---- Feuille : la routine du jour ---- */
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function semaine(it) {
  let h = '';
  for (let i = 6; i >= 0; i--) {
    const d = addDays(S.today, -i), wd = F_WD.format(parseD(d)).replace('.', ''), lib = `${fShort(d)}`;
    if (!prevu(it, d)) { h += `<span class="ev-dot off" title="${esc(lib)} : pas prévu"><i>${esc(wd.charAt(0).toUpperCase())}</i></span>`; continue; }
    const ok = fait(it, d);
    h += `<button type="button" class="ev-dot${ok ? ' ok' : ''}${i === 0 ? ' auj' : ''}" data-action="ev-jour" data-id="${esc(it.id)}" data-d="${d}" aria-pressed="${ok}" aria-label="${esc(it.titre)}, ${esc(lib)} : ${ok ? 'fait' : 'pas fait'}" title="${esc(lib)}"><i>${esc(wd.charAt(0).toUpperCase())}</i></button>`;
  }
  return `<span class="ev-week">${h}</span>`;
}
function ligne(it, aujourdhui) {
  const ok = aujourdhui && fait(it, S.today), s = serie(it);
  const sr = s ? `<span class="ev-serie${s >= 7 ? ' fort' : ''}">${s} j d’affilée</span>` : '';
  return `<li class="ev-row${ok ? ' fait' : ''}${aujourdhui ? '' : ' repos'}">${aujourdhui ? `<button type="button" class="oggi-check ev-check" data-action="ev-check" data-id="${esc(it.id)}" aria-pressed="${ok}" aria-label="${ok ? 'Décocher' : 'Cocher'} : ${esc(it.titre)}">${CHECK}</button>` : ''}<div class="ev-tw"><span class="ev-t">${esc(it.titre)}</span><span class="ev-meta">${semaine(it)}${sr}</span></div></li>`;
}
function vueJour() {
  const all = items();
  if (!all.length) return head('Everyday') + `<div class="sheet-body"><div class="empty"><p class="empty-t">Ta routine est vide</p><p>Ajoute ce que tu veux faire chaque jour (ou certains jours seulement), puis coche au fil de la journée.</p></div><button type="button" class="btn btn-primary" data-action="ev-edit">${ICON.plus} Créer ma routine</button></div>`;
  const L = all.filter(it => prevu(it, S.today)), repos = all.filter(it => !prevu(it, S.today));
  const f = faits(S.today), n = L.filter(it => f.has(it.id)).length;
  const afaire = L.filter(it => !f.has(it.id)), faitsL = L.filter(it => f.has(it.id));
  let h = `<p class="oggi-sum">${!L.length ? 'Rien de prévu aujourd’hui.' : (n === L.length ? `Tout est fait : ${n} sur ${L.length}. Bravo !` : `${n} sur ${L.length} fait${n > 1 ? 's' : ''}`)}</p>`;
  if (afaire.length) h += `<ul class="ev-list">${afaire.map(it => ligne(it, true)).join('')}</ul>`;
  if (faitsL.length) h += `<section class="oggi-sec"><h3 class="oggi-g g-fait"><span>Fait aujourd’hui</span><span class="cnt">${faitsL.length}</span></h3><ul class="ev-list">${faitsL.map(it => ligne(it, true)).join('')}</ul></section>`;
  if (repos.length) h += `<section class="oggi-sec"><h3 class="oggi-g"><span>Pas prévu aujourd’hui</span><span class="cnt">${repos.length}</span></h3><ul class="ev-list">${repos.map(it => ligne(it, false)).join('')}</ul></section>`;
  h += '<p class="hint">Les pastilles montrent les 7 derniers jours : touche celle d’un jour passé pour le cocher après coup.</p>';
  h += `<button type="button" class="btn" data-action="ev-edit">Modifier la routine</button>`;
  return head('Everyday · ' + fShort(S.today)) + `<div class="sheet-body">${h}</div>`;
}

/* ---- Feuille : modifier la routine ---- */
function chipsJours(i, jours) {
  return `<span class="ev-jours" role="group" aria-label="Jours">${JOURS.map(([n, l, nom]) => `<button type="button" class="ev-j" data-action="ev-j" data-i="${i}" data-n="${n}" aria-pressed="${jours.includes(n)}" aria-label="${nom}" title="${nom}">${l}</button>`).join('')}</span>`;
}
function presets(i, jours) {
  const k = jours.join(',');
  return `<span class="ev-pre">${PRESETS.map(([id, l, J]) => `<button type="button" class="linkbtn${J.join(',') === k ? ' on' : ''}" data-action="ev-pre" data-i="${i}" data-p="${id}">${l}</button>`).join('')}</span>`;
}
function vueEdit(sh) {
  const L = sh.items;
  let h = '<p class="hint">Pour chaque élément, choisis ses jours. L’ordre ici est celui de ta liste.</p>';
  h += L.length ? `<ul class="ev-elist">${L.map((it, i) => `<li class="ev-erow"><div class="ev-etop"><input class="ev-ein" data-ev-i="${i}" value="${esc(it.titre)}" aria-label="Intitulé"><button type="button" class="icon-btn sm" data-action="ev-up" data-i="${i}" aria-label="Monter"${i ? '' : ' disabled'}>${ICON.up}</button><button type="button" class="icon-btn sm" data-action="ev-down" data-i="${i}" aria-label="Descendre"${i < L.length - 1 ? '' : ' disabled'}>${ICON.down}</button><button type="button" class="icon-btn sm" data-action="ev-del" data-i="${i}" aria-label="Retirer : ${esc(it.titre)}">${ICON.close}</button></div><div class="ev-ebot">${chipsJours(i, it.jours)}${presets(i, it.jours)}</div></li>`).join('')}</ul>` : '<p class="muted">Aucun élément pour l’instant.</p>';
  h += `<div class="retro-add"><input id="ev-new" value="${esc(sh.nouveau || '')}" placeholder="Nouvel élément (ex. 20 min de lecture)" aria-label="Nouvel élément"${L.length ? '' : ' data-autofocus'}><button type="button" class="btn btn-sm" data-action="ev-add">Ajouter</button></div>`;
  return head('Modifier la routine') + `<div class="sheet-body">${h}</div><footer class="sheet-foot"><span class="spacer"></span><button type="button" class="btn btn-ghost" data-action="ev-back">Annuler</button><button type="button" class="btn btn-primary" data-action="ev-save">Enregistrer</button></footer>`;
}

sheet('every', {
  render: sh => sh.edit ? vueEdit(sh) : vueJour(),
  field(sh, t) {
    if (!sh.edit) return;
    if (t.id === 'ev-new') { sh.nouveau = t.value; return; }
    if (t.dataset.evI != null) { const it = sh.items[Number(t.dataset.evI)]; if (it) it.titre = t.value; }
  }
});

/* ---- Actions ---- */
const edit = () => ui.sheet && ui.sheet.kind === 'every' && ui.sheet.edit ? ui.sheet : null;
function addFromInput() {
  const sh = edit(), f = $('#ev-new'); if (!sh || !f) return;
  const titre = f.value.trim(); if (!titre) { f.focus(); return; }
  sh.items.push({ id: newId('r'), titre, jours: TOUS.slice(), cree: S.today });
  sh.nouveau = '';
  renderSheet(); const g = $('#ev-new'); if (g) g.focus();
}
action('every', () => openSheet({ kind: 'every' }));
const titreDe = id => { const it = items().find(x => x.id === id); return it ? it.titre : 'élément'; };
action('ev-check', a => guarded(async () => { const oui = await basculer(a.dataset.id, S.today); toast((oui ? 'Fait : ' : 'Décoché : ') + titreDe(a.dataset.id)); }));
action('ev-jour', a => guarded(async () => { const oui = await basculer(a.dataset.id, a.dataset.d); toast((oui ? 'Fait le ' : 'Décoché le ') + fShort(a.dataset.d) + ' : ' + titreDe(a.dataset.id)); }));
action('ev-edit', () => { if (!ui.sheet) return; ui.sheet.edit = true; ui.sheet.nouveau = ''; ui.sheet.items = clone(items()); renderSheet(); });
action('ev-back', () => { if (!ui.sheet) return; ui.sheet.edit = false; renderSheet(); });
action('ev-add', () => addFromInput());
action('ev-del', a => { const sh = edit(); if (!sh) return; sh.items.splice(Number(a.dataset.i), 1); renderSheet(); });
action('ev-up', a => { const sh = edit(), i = Number(a.dataset.i); if (!sh || i < 1) return; [sh.items[i - 1], sh.items[i]] = [sh.items[i], sh.items[i - 1]]; renderSheet(); });
action('ev-down', a => { const sh = edit(), i = Number(a.dataset.i); if (!sh || i >= sh.items.length - 1) return; [sh.items[i + 1], sh.items[i]] = [sh.items[i], sh.items[i + 1]]; renderSheet(); });
action('ev-j', a => {
  const sh = edit(), it = sh && sh.items[Number(a.dataset.i)]; if (!it) return;
  const n = Number(a.dataset.n), has = it.jours.includes(n);
  if (has && it.jours.length === 1) { toast('Garde au moins un jour.'); return; }
  it.jours = has ? it.jours.filter(x => x !== n) : [...it.jours, n].sort(); renderSheet();
});
action('ev-pre', a => { const sh = edit(), it = sh && sh.items[Number(a.dataset.i)], p = PRESETS.find(x => x[0] === a.dataset.p); if (it && p) { it.jours = p[2].slice(); renderSheet(); } });
action('ev-save', () => guarded(async () => {
  const sh = edit(); if (!sh) return;
  const nf = $('#ev-new'); if (nf && nf.value.trim()) sh.items.push({ id: newId('r'), titre: nf.value.trim(), jours: TOUS.slice(), cree: S.today });
  const L = sh.items.map(it => ({ id: it.id, titre: String(it.titre || '').trim(), jours: joursOk(it.jours), cree: it.cree || S.today })).filter(it => it.titre);
  await put('reglages', 'routine', { items: L });
  sh.edit = false; renderSheet(); toast('Routine enregistrée');
}));
/* Entrée dans le champ « Nouvel élément » : ajoute */
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'ev-new') { e.preventDefault(); addFromInput(); } });

/* Appelé à chaque rafraîchissement */
export function everyRefresh() {
  renderBtn();
  if (ui.sheet && ui.sheet.kind === 'every' && !ui.sheet.edit) renderSheet();
}
