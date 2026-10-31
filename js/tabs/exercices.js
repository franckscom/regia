/* Exercices du jour : Business English, Italiano degli affari, français (préparés et corrigés par Claude chaque semaine). */
import { S, list, get, put, saveUI, guarded } from '../core/store.js';
import { $, esc, toast, rich, ICON } from '../core/util.js';
import { isDate, addDays, mondayOf, fShort, F_LONG, F_WD, parseD, cap, isoWeek } from '../core/dates.js';
import { LANGUES, FORMATS_EXO } from '../core/config.js';
import { view, action, onInput, gate, empty, section, refresh } from '../core/ui.js';

const LORD = Object.fromEntries(LANGUES.map((l, i) => [l[0], i]));
const drafts = new Map();     // réponses en cours de frappe (non enregistrées)
const shown = new Set();      // corrigés affichés

export function exosDu(d) { return list('exercices').filter(e => e.date === d).sort((a, b) => (LORD[a.langue] ?? 9) - (LORD[b.langue] ?? 9)); }
function rep(e) { return get('reponses', e.id); }
function answered(e) { const r = rep(e); return !!(r && String(r.texte || '').trim()); }
export function exosJour() { const L = exosDu(S.today); return { total: L.length, faits: L.filter(answered).length }; }
function serie() {
  let d = S.today, n = 0;
  const L0 = exosDu(d); if (!(L0.length && L0.every(answered))) d = addDays(d, -1);
  for (let i = 0; i < 400; i++) { const L = exosDu(d); if (!L.length || !L.every(answered)) break; n++; d = addDays(d, -1); }
  return n;
}
function enRetard() { return list('exercices').filter(e => isDate(e.date) && e.date < S.today && e.date >= addDays(S.today, -14) && !answered(e)).sort((a, b) => a.date < b.date ? -1 : (a.date > b.date ? 1 : (LORD[a.langue] ?? 9) - (LORD[b.langue] ?? 9))); }
function langInfo(k) { const l = LANGUES.find(x => x[0] === k); return l ? { nom: l[1], code: l[2] } : { nom: k || 'Exercice', code: '?' }; }
function formatNom(k) { const f = FORMATS_EXO.find(x => x[0] === k); return f ? f[1] : (k || ''); }

function exoCard(e, o) {
  o = o || {};
  const r = rep(e), ok = answered(e), L = langInfo(e.langue), corr = e.correction && typeof e.correction === 'object' ? e.correction : (e.correction ? { texte: String(e.correction) } : null);
  const val = drafts.has(e.id) ? drafts.get(e.id) : (r ? r.texte || '' : '');
  const open = shown.has(e.id);
  let h = `<article class="exo lang-${esc(e.langue || 'x')}" id="exo-${esc(e.id)}"><header class="exo-h"><span class="lang">${esc(L.code)}</span><span class="exo-f">${esc(formatNom(e.format))}</span><span class="mini">≈ ${Number(e.duree) || 5} min</span>${o.date ? `<span class="mini">${esc(fShort(e.date))}</span>` : ''}<span class="spacer"></span>${corr ? '<span class="st st-ok">corrigé par Claude</span>' : (ok ? '<span class="st st-cours">répondu</span>' : '')}</header>`;
  h += `<h3 class="exo-t">${esc(e.titre || L.nom)}</h3><div class="rich exo-c">${rich(e.consigne)}</div>`;
  if (e.contexte) h += `<div class="rich exo-x">${rich(e.contexte)}</div>`;
  h += `<label class="fld"><span class="fld-l">Ta réponse</span><textarea id="rep-${esc(e.id)}" rows="5" data-input="exo" data-id="${esc(e.id)}" lang="${esc(e.langue || 'fr')}" spellcheck="true">${esc(val)}</textarea></label>`;
  h += `<div class="exo-act"><button type="button" class="btn btn-sm btn-primary" data-action="exo-save" data-id="${esc(e.id)}">${ok ? 'Mettre à jour ma réponse' : 'Enregistrer ma réponse'}</button>${(e.corrige && (ok || open)) ? `<button type="button" class="btn btn-sm" data-action="exo-corrige" data-id="${esc(e.id)}">${open ? 'Masquer le corrigé' : 'Voir le corrigé'}</button>` : (e.corrige ? '<span class="hint">Le corrigé type s’affiche après ta réponse.</span>' : '')}</div>`;
  if (e.corrige && open) h += `<div class="exo-k"><h4>Corrigé type</h4><div class="rich">${rich(e.corrige)}</div></div>`;
  if (corr) h += `<div class="exo-p"><h4>Correction de Claude${corr.le && isDate(corr.le) ? ' · ' + esc(fShort(corr.le)) : ''}</h4><div class="rich">${rich(corr.texte || '')}</div></div>`;
  return h + '</article>';
}
function renderExos() {
  const el = $('#v-exo'); if (!gate(el)) return;
  const d = isDate(S.ui.exoDate) ? S.ui.exoDate : S.today;
  const mon = mondayOf(S.today); let t = 0, f = 0;
  for (let i = 0; i < 7; i++) { const L = exosDu(addDays(mon, i)); t += L.length; f += L.filter(answered).length; }
  const sub = $('#ex-sub'); if (sub) { const n = serie(); sub.textContent = `Cette semaine : ${f}/${t} · série en cours : ${n} jour${n > 1 ? 's' : ''}`; }
  const all = list('exercices');
  if (!all.length) { el.innerHTML = empty('Pas encore d’exercices.', 'Chaque lundi, Claude prépare 3 exercices par jour (anglais et italien des affaires, français) et corrige tes réponses de la semaine. Ils arrivent ici à la synchro.'); return; }
  /* Semaine affichée : 7 jours cliquables */
  const wm = mondayOf(d);
  let days = '<div class="xdays" role="group" aria-label="Jours de la semaine">';
  for (let i = 0; i < 7; i++) {
    const x = addDays(wm, i), L = exosDu(x), n = L.filter(answered).length;
    days += `<button type="button" class="xday${x === d ? ' cur' : ''}${x === S.today ? ' today' : ''}${L.length && n === L.length ? ' full' : ''}" data-action="exo-day" data-d="${x}" aria-pressed="${x === d}"><small>${esc(F_WD.format(parseD(x)).replace('.', ''))}</small><b>${parseD(x).getDate()}</b><i>${L.length ? n + '/' + L.length : '·'}</i></button>`;
  }
  days += '</div>';
  let h = `<div class="xnav"><button type="button" class="icon-btn" data-action="exo-day" data-d="${addDays(wm, -7)}" aria-label="Semaine précédente">${ICON.left}</button>${days}<button type="button" class="icon-btn" data-action="exo-day" data-d="${addDays(wm, 7)}" aria-label="Semaine suivante">${ICON.right}</button></div>`;
  h += `<h2 class="xdate">${esc(cap(F_LONG.format(parseD(d))))}${d !== S.today ? ` <button type="button" class="linkbtn" data-action="exo-day" data-d="${S.today}">revenir à aujourd’hui</button>` : ''}</h2>`;
  const L = exosDu(d);
  h += L.length ? L.map(e => exoCard(e)).join('') : `<p class="empty-line">Pas d’exercice prévu ce jour-là.${d > S.today ? ' Claude prépare la semaine chaque lundi.' : ''}</p>`;
  if (d === S.today) { const late = enRetard(); if (late.length) h += section('exo-late', 'À rattraper (14 derniers jours)', late.length, late.map(e => exoCard(e, { date: true })).join(''), { collapsible: true }); }
  el.innerHTML = h;
}
view('exercices', {
  label: 'Exercices', masquable: true,
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/><path d="M7 8h2M15 8h2M15 11h2"/></svg>',
  shell: () => `<div class="v-head"><h1><span class="hl">Exercices</span></h1><p class="v-sub" id="ex-sub"></p></div><div id="v-exo"></div>`,
  render: renderExos,
  onMount: () => { S.ui.exoDate = null; }
});
onInput('@exo', el => { drafts.set(el.dataset.id, el.value); });
action('exo-day', a => { S.ui.exoDate = a.dataset.d === S.today ? null : a.dataset.d; saveUI(); refresh(); });
action('exo-corrige', a => { const id = a.dataset.id; if (shown.has(id)) shown.delete(id); else shown.add(id); refresh(); });
action('exo-save', a => guarded(async () => {
  const id = a.dataset.id, e = get('exercices', id); if (!e) return;
  const ta = document.getElementById('rep-' + id), txt = String(ta ? ta.value : (drafts.get(id) || '')).trim();
  if (!txt) { toast('Écris ta réponse avant de l’enregistrer.', 'err'); if (ta) ta.focus(); return; }
  shown.add(id);
  await put('reponses', id, { texte: txt, le: S.today, ms: Date.now(), langue: e.langue || '', date: e.date || '' });
  drafts.delete(id); refresh();
  toast(e.corrige ? 'Réponse enregistrée : compare avec le corrigé' : 'Réponse enregistrée');
}));
