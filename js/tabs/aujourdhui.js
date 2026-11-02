/* Aujourd'hui : l'écran d'accueil qui résume tout (tâches, agenda, notes à trier, contenus, exercices, interactions). */
import { S, list, saveUI, guarded, patch } from '../core/store.js';
import { $, esc, ICON, toast } from '../core/util.js';
import { isDate, addDays, diff, F_LONG, parseD, cap, isoWeek, fShort, hm, dayOfMs, pad } from '../core/dates.js';
import { view, action, onSubmit, section, gate, liens, tabOn, refresh } from '../core/ui.js';
import { tasks, visible, dueOf, byDue, taskRow, dom, domColor, fillDomSelect, parentOf, createTask } from './taches.js';
import { reunions, byReu, reuRow } from './reunions.js';
import { aTrier } from './notes.js';
import { semaineContenus, contRow, interactionsJour } from './contenus.js';
import { exosJour } from './exercices.js';
import { agendaCache, syncUrl, fAgo } from '../core/sync.js';
import { LocalDB } from '../core/db.js';

function renderShortcuts() {
  const el = $('#v-short'); if (!el) return;
  const L = liens().filter(l => l.raccourci);
  el.innerHTML = L.length ? `<div class="shortcuts">${L.map(l => `<a class="shortcut" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.nom)} ${ICON.ext}</a>`).join('')}</div>` : '';
}
function tile(o) {
  return `<button type="button" class="tile${o.hot ? ' hot' : ''}${o.done ? ' done' : ''}" data-action="goto" data-view="${o.view}"${o.mode ? ` data-mode="${o.mode}"` : ''}><b>${esc(o.n)}</b><span>${esc(o.l)}</span></button>`;
}
function renderTiles() {
  const el = $('#v-tiles'); if (!el) return;
  if (!S.db) { el.innerHTML = ''; return; }
  const T = [];
  if (tabOn('notes')) { const n = aTrier().length; if (n) T.push(tile({ view: 'notes', n, l: n > 1 ? 'notes à trier' : 'note à trier', hot: true })); }
  if (tabOn('exercices')) { const e = exosJour(); if (e.total) T.push(tile({ view: 'exercices', n: e.faits + '/' + e.total, l: 'exercices du jour', hot: e.faits < e.total, done: e.faits >= e.total })); }
  if (tabOn('contenus')) {
    const i = interactionsJour(); if (i.total) T.push(tile({ view: 'contenus', mode: 'interactions', n: i.fait + '/' + i.total, l: 'interactions LinkedIn', done: i.fait >= i.total }));
    const s = semaineContenus(); if (s.cible) T.push(tile({ view: 'contenus', mode: 'calendrier', n: s.prevus + '/' + s.cible, l: 'contenus prévus cette semaine', done: s.prevus >= s.cible }));
  }
  el.innerHTML = T.length ? `<div class="tiles">${T.join('')}</div>` : '';
}
function renderStrip() {
  const el = $('#v-strip'); if (!el) return;
  if (!S.db) { el.innerHTML = ''; return; }
  const J = tasks().filter(t => visible(t) && t.jalon && t.statut !== 'fait');
  const dated = J.filter(t => { const d = dueOf(t); return d && d >= S.today; }).sort(byDue);
  const tbc = J.filter(t => !dueOf(t)).sort((a, b) => String(a.titre).localeCompare(String(b.titre), 'fr'));
  if (!dated.length && !tbc.length) { el.innerHTML = ''; return; }
  const chip = (t, i, isTbc) => {
    const d = dueOf(t), n = d ? diff(S.today, d) : null, dd = dom(t.domaine);
    return `<button type="button" class="jalon${(!isTbc && i === 0) ? ' next' : ''}${isTbc ? ' tbc' : ''}" data-action="edit" data-id="${esc(t.id)}" style="--c:${domColor(dd)}"><span class="j">${isTbc ? 'J-?' : (n === 0 ? 'Jour J' : 'J-' + n)}</span><span class="jt">${esc(t.titre)}</span><span class="jd"><i class="sqi" aria-hidden="true"></i>${isTbc ? 'date à confirmer' : esc(fShort(d)) + ' · S' + isoWeek(d)}</span></button>`;
  };
  el.innerHTML = `<section class="strip-wrap" aria-label="Prochains jalons"><h2 class="strip-h">Prochains jalons</h2><div class="strip">${dated.map((t, i) => chip(t, i, false)).join('')}${tbc.map((t, i) => chip(t, i, true)).join('')}</div></section>`;
}
/* Agenda Google : aujourd'hui et demain, d'après la dernière synchro */
function evDay(e) { return e.journee ? e.date : dayOfMs(e.debut); }
function evOn(e, d) { return e.journee ? (e.date <= d && (e.dateFin && e.dateFin >= e.date ? e.dateFin : e.date) >= d) : evDay(e) === d; }
function calLink(a, d) { const p = d.split('-'); return `https://calendar.google.com/calendar/r/day/${Number(p[0])}/${Number(p[1])}/${Number(p[2])}${a && a.agenda ? '?authuser=' + encodeURIComponent(a.agenda) : ''}`; }
function agendaHTML() {
  const a = agendaCache(), pend = list('agenda').filter(x => x.etat === 'a_creer' || x.etat === 'erreur');
  if (!a && !pend.length) return '';
  const t0 = S.today, t1 = addDays(t0, 1), ev = a ? a.evenements : [];
  const row = (e, d) => `<a class="evrow" href="${esc(calLink(a, d))}" target="_blank" rel="noopener"><span class="evt">${e.journee ? 'Journée' : esc(hm(e.debut) + '-' + hm(e.fin))}</span><span class="evn">${esc(e.titre || 'Sans titre')}${e.lieu ? `<small>${esc(e.lieu)}</small>` : ''}</span></a>`;
  const sortEv = (x, y) => (x.journee ? 0 : x.debut) - (y.journee ? 0 : y.debut);
  const E0 = ev.filter(e => evOn(e, t0)).sort(sortEv), E1 = ev.filter(e => evOn(e, t1)).sort(sortEv);
  let h = '';
  if (a) h += `<div class="evday"><h3>Aujourd’hui</h3>${E0.length ? E0.map(e => row(e, t0)).join('') : '<p class="empty-line">Aucun rendez-vous.</p>'}</div><div class="evday"><h3>Demain</h3>${E1.length ? E1.map(e => row(e, t1)).join('') : '<p class="empty-line">Aucun rendez-vous.</p>'}</div>`;
  if (pend.length) h += pend.map(p => `<div class="evrow pend"><span class="evt">${p.journee ? 'Journée' : esc(p.heure || '')}</span><span class="evn">${esc(p.titre)}<small>${p.etat === 'erreur' ? 'Erreur Google Agenda : ' + esc(p.erreur || '') : esc(fShort(p.date)) + ' · envoi à la prochaine synchro'}</small></span>${p.etat === 'erreur' ? `<button type="button" class="btn btn-sm" data-action="ag-retry" data-id="${esc(p.id)}">Réessayer</button>` : ''}</div>`).join('');
  return section('agenda', 'Agenda', a ? '' : pend.length, `<div class="evs">${h}</div>${a ? `<p class="hint">Google Agenda, mis à jour ${esc(fAgo(a.maj || LocalDB.meta.lastSync || Date.now()))}.</p>` : ''}`);
}
function renderToday() {
  const el = $('#v-today');
  if (!gate(el)) return;
  const t0 = S.today, w = addDays(t0, 7);
  const T = tasks().filter(visible);
  const ag = agendaHTML();
  if (!T.length && !ag) { el.innerHTML = `<div class="empty"><p class="empty-t">Ton planning est vide.</p><p>${syncUrl() ? 'Ajoute une tâche avec le champ ci-dessus, ou touche Synchroniser pour récupérer tes données.' : 'Pour récupérer tes données, colle l’adresse de ton script Google dans les <a href="#reglages">Réglages</a>, puis synchronise. Tu peux aussi ajouter une tâche avec le champ ci-dessus.'}</p></div>`; return; }
  const open = T.filter(t => t.statut === 'a_faire' || t.statut === 'en_cours');
  const late = open.filter(t => { const d = dueOf(t); return d && d < t0; }).sort(byDue);
  const tod = open.filter(t => dueOf(t) === t0).sort(byDue);
  const week = open.filter(t => { const d = dueOf(t); return d && d > t0 && d <= w; }).sort(byDue);
  const shownIds = new Set(late.concat(tod, week).map(t => t.id));
  const att = T.filter(t => t.statut === 'attente').sort(byDue);
  const cours = open.filter(t => t.statut === 'en_cours' && !shownIds.has(t.id)).sort(byDue);
  const plan = T.filter(t => t.statut === 'a_faire' && !dueOf(t) && !(t.parentId && S.data.taches.has(t.parentId) && !dueOf(parentOf(t)))).sort(byDue);
  const recent = T.filter(t => t.statut === 'fait' && isDate(t.faitLe) && diff(t.faitLe, t0) <= 2).sort((a, b) => a.faitLe < b.faitLe ? 1 : -1);
  const rows = L => L.map(t => taskRow(t)).join('');
  let h = '';
  if (late.length) h += section('late', 'En retard', late.length, rows(late), { cls: 'sec-late' });
  h += ag;
  h += section('today', 'Aujourd’hui', tod.length, tod.length ? rows(tod) : `<p class="empty-line">${late.length ? 'Rien d’autre de prévu aujourd’hui.' : 'Rien de prévu aujourd’hui.'}</p>`);
  if (tabOn('contenus')) {
    const s = semaineContenus(), C = s.retard.concat(s.aPublier);
    if (C.length) h += section('cont7', 'Contenus à publier', C.length, C.map(x => contRow(x)).join(''), { link: '#contenus', linkLabel: 'Calendrier' });
  }
  const R = reunions().filter(r => isDate(r.date) && r.date >= t0 && r.date <= w).sort(byReu);
  if (R.length) h += section('reu7', 'Réunions des 7 prochains jours', R.length, R.map(r => reuRow(r, { noSel: true })).join(''));
  h += section('week', 'Les 7 prochains jours', week.length, week.length ? rows(week) : '<p class="empty-line">Rien d’autre de daté cette semaine.</p>');
  if (att.length) h += section('att', 'En attente d’un retour', att.length, rows(att));
  if (cours.length) h += section('cours', 'En cours', cours.length, rows(cours));
  if (plan.length) h += section('planifier', 'À planifier', plan.length, rows(plan), { collapsible: true });
  if (recent.length) h += section('faits', 'Fait récemment', recent.length, rows(recent), { collapsible: true });
  el.innerHTML = h;
}
view('aujourdhui', {
  label: 'Aujourd’hui',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><rect x="11" y="12.5" width="4" height="4" rx=".6" fill="currentColor" stroke="none"/></svg>',
  shell: () => `<div class="v-head"><h1><span class="hl">Regia</span></h1><p class="v-sub" id="v-sub"></p></div>
    <form class="qa" id="qa-form" autocomplete="off"><label class="sr-only" for="qa-titre">Nouvelle tâche</label><input id="qa-titre" placeholder="Nouvelle tâche…"><label class="sr-only" for="qa-dom">Domaine</label><select id="qa-dom"></select><label class="sr-only" for="qa-date">Échéance</label><input id="qa-date" type="date"><button class="btn btn-primary" type="submit">Ajouter</button></form>
    <div id="v-short"></div><div id="v-tiles"></div><div id="v-strip"></div><div id="v-today"></div>`,
  render() {
    fillDomSelect($('#qa-dom'));
    const sub = $('#v-sub'); if (sub) sub.textContent = cap(F_LONG.format(parseD(S.today))) + ' · semaine ' + isoWeek(S.today);
    renderShortcuts(); renderTiles(); renderStrip(); renderToday();
  }
});
onSubmit('qa-form', async () => {
  const ti = $('#qa-titre'), titre = ti.value.trim(); if (!titre) { ti.focus(); return; }
  const domaine = $('#qa-dom').value, date = $('#qa-date').value || null;
  const ok = await guarded(() => createTask({ titre, domaine, echeance: date }));
  if (ok) { ti.value = ''; $('#qa-date').value = ''; S.ui.lastDom = domaine; saveUI(); toast(date ? 'Ajoutée pour le ' + fShort(date) : 'Ajoutée dans « À planifier »'); }
});
action('goto', a => { if (a.dataset.mode && a.dataset.view === 'contenus') { S.ui.contMode = a.dataset.mode; saveUI(); } if (location.hash === '#' + a.dataset.view) refresh(); else location.hash = '#' + a.dataset.view; });
action('ag-retry', a => guarded(async () => { await patch('agenda', a.dataset.id, { etat: 'a_creer', erreur: null }); toast('Nouvel essai à la prochaine synchro'); }));
