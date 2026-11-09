/* Planning : Gantt et échéances (rétroplanning global), calculés à partir des dates des tâches. */
import { S, saveUI } from '../core/store.js';
import { $, esc } from '../core/util.js';
import { isDate, addDays, diff, mondayOf, isoWeek, parseD, fShort, F_MONTH, F_WD } from '../core/dates.js';
import { view, action, gate, empty, refresh } from '../core/ui.js';
import { tasks, domList, dom, domColor, childrenOf, parentOf, isTop, dueOf, byDue, visible, prioBadge } from './taches.js';

const ZOOMS = { '4sem': { l: '4 sem.', w: 30, span: 28 }, '3mois': { l: '3 mois', w: 12, span: 91 }, '6mois': { l: '6 mois', w: 6, span: 182 } };

function ganttHTML() {
  const Z = ZOOMS[S.ui.zoom] || ZOOMS['3mois'], dw = Z.w, t0 = S.today;
  let lo = addDays(t0, -7), hi = addDays(t0, Z.span);
  const floor = addDays(t0, -56);
  const rows = []; let undated = 0;
  for (const d of domList(false)) {
    if (S.ui.hidden.includes(d.id)) continue;
    const items = [];
    const tops = tasks().filter(t => t.domaine === d.id && isTop(t) && (S.ui.showDone || t.statut !== 'fait')).sort(byDue);
    for (const t of tops) {
      const kids = childrenOf(t.id).filter(k => S.ui.showDone || k.statut !== 'fait');
      const kd = kids.map(dueOf).filter(Boolean).sort();
      const due = dueOf(t);
      const end = due || (kd.length ? kd[kd.length - 1] : null);
      if (!end) { undated++; continue; }
      let s = (isDate(t.debut) && t.debut < end) ? t.debut : null;
      if (kd.length && kd[0] < end && (!s || kd[0] < s)) s = kd[0];
      const kind = (kids.length && kd.length) ? 'sum' : (s ? 'bar' : 'pt');
      items.push({ t, lvl: 0, s: s || end, e: end, kind });
      for (const k of kids.slice().sort(byDue)) {
        const ke = dueOf(k); if (!ke) continue;
        const ks = (isDate(k.debut) && k.debut < ke) ? k.debut : null;
        items.push({ t: k, lvl: 1, s: ks || ke, e: ke, kind: ks ? 'bar' : 'pt' });
      }
    }
    if (items.length) { rows.push({ dom: d }); for (const it of items) { rows.push(it); if (it.s < lo) lo = it.s; if (it.e > hi) hi = it.e; } }
  }
  if (!rows.length) return empty('Rien à afficher sur le Gantt.', 'Donne une échéance à tes tâches pour les voir apparaître ici.');
  if (lo < floor) lo = floor;
  const start = mondayOf(lo), end = addDays(mondayOf(hi), 13);
  const days = diff(start, end) + 1, W = days * dw;
  const X = s => diff(start, s) * dw;
  let months = '', weeks = '', bg = '';
  for (let i = 0; i < days; i++) {
    const s = addDays(start, i), dt = parseD(s), wd = dt.getDay();
    if (dt.getDate() === 1 || i === 0) {
      const nextFirst = new Date(dt.getFullYear(), dt.getMonth() + 1, 1, 12);
      const room = Math.round((nextFirst - dt) / 86400000) * dw;
      if (dt.getDate() === 1 || room >= 110) months += `<span class="g-month" style="left:${X(s) + 5}px">${esc(F_MONTH.format(dt))}</span>`;
    }
    if (wd === 1) { weeks += `<span class="g-week" style="left:${X(s)}px;width:${7 * dw}px">S${isoWeek(s)}${dw >= 12 ? ' · ' + dt.getDate() : ''}</span>`; bg += `<i class="g-wl" style="left:${X(s)}px"></i>`; }
    if (dw >= 12 && wd === 6) bg += `<i class="g-we" style="left:${X(s)}px;width:${2 * dw}px"></i>`;
  }
  const tx = X(t0) + dw / 2;
  let body = '';
  for (const r of rows) {
    if (r.dom) { body += `<div class="g-row g-dom" style="--c:${domColor(r.dom)}"><div class="g-label">${esc(r.dom.nom)}</div><div class="g-track" style="width:${W}px"></div></div>`; continue; }
    const t = r.t, done = t.statut === 'fait', late = !done && r.e < t0;
    const cls = (done ? ' g-done' : '') + (late ? ' g-late' : '');
    const tip = esc(t.titre + ' · ' + (r.s !== r.e ? fShort(r.s) + ' → ' : '') + fShort(r.e));
    const sx = Math.max(0, X(r.s)), wpx = Math.max(X(r.e) + dw - sx, 6);
    let mark;
    if (r.kind === 'bar') mark = `<button type="button" class="g-bar${cls}${X(r.s) < 0 ? ' g-cut' : ''}" style="left:${sx}px;width:${wpx}px" data-action="edit" data-id="${esc(t.id)}" title="${tip}" aria-label="${tip}"></button>`;
    else if (r.kind === 'sum') mark = `<button type="button" class="g-sum${cls}" style="left:${sx}px;width:${wpx}px" data-action="edit" data-id="${esc(t.id)}" title="${tip}" aria-label="${tip}"></button><i class="g-pt g-end${cls}" style="left:${X(r.e) + dw / 2 - 6}px" aria-hidden="true"></i>`;
    else mark = `<button type="button" class="g-pt${t.jalon ? '' : ' dot'}${cls}" style="left:${X(r.e) + dw / 2 - (t.jalon ? 6 : 5.5)}px" data-action="edit" data-id="${esc(t.id)}" title="${tip}" aria-label="${tip}"></button>`;
    body += `<div class="g-row${r.lvl ? ' g-child' : ''}" style="--c:${domColor(dom(t.domaine))}"><button type="button" class="g-label" data-action="edit" data-id="${esc(t.id)}" title="${esc(t.titre)}">${esc(t.titre)}</button><div class="g-track" style="width:${W}px">${mark}</div></div>`;
  }
  return `<div class="g-scroll" id="g-scroll" data-today="${Math.round(tx)}"><div class="g-inner" style="width:calc(var(--label-w) + ${W}px)"><div class="g-head"><div class="g-corner">Tâches</div><div class="g-scale" style="width:${W}px">${months}${weeks}<span class="g-tlabel" style="left:${tx}px">Auj.</span></div></div><div class="g-body"><div class="g-bg" style="width:${W}px">${bg}<i class="g-today" style="left:${tx}px"></i></div>${body}</div></div></div>${undated ? `<p class="hint gap">${undated} tâche${undated > 1 ? 's' : ''} sans date ${undated > 1 ? 'ne figurent' : 'ne figure'} pas sur le Gantt : retrouve-les dans « À planifier ».</p>` : ''}`;
}
function agRow(t, tbc) {
  const d = dueOf(t), n = d ? diff(S.today, d) : null, dd = dom(t.domaine), p = parentOf(t), done = t.statut === 'fait';
  const jl = tbc ? '?' : (done ? 'fait' : (n < 0 ? 'retard ' + (-n) + ' j' : (n === 0 ? 'Jour J' : 'J-' + n)));
  const date = tbc ? '<div class="ag-date"><b>?</b></div>' : `<div class="ag-date"><b>${parseD(d).getDate()}</b><span>${esc(F_WD.format(parseD(d)))}</span><span class="wk">S${isoWeek(d)}</span></div>`;
  return `<div class="ag-row${n === 0 ? ' is-today' : ''}${(n !== null && n < 0 && !done) ? ' is-late' : ''}${done ? ' is-done' : ''}">${date}<button type="button" class="ag-main" data-action="edit" data-id="${esc(t.id)}"><span class="row-title">${t.jalon ? '<span class="jal">◆</span> ' : ''}${esc(t.titre)}</span><span class="row-meta">${done ? '' : prioBadge(t)}<span class="dom" style="--c:${domColor(dd)}">${esc(dd.nom)}</span>${p ? `<span>› ${esc(p.titre)}</span>` : ''}</span></button><span class="ag-j">${jl}</span></div>`;
}
function agendaHTML() {
  const t0 = S.today;
  const T = tasks().filter(t => visible(t) && !S.ui.hidden.includes(t.domaine) && (S.ui.showDone || t.statut !== 'fait'));
  const dated = T.filter(t => dueOf(t)).sort(byDue);
  const late = dated.filter(t => t.statut !== 'fait' && dueOf(t) < t0);
  const rest = dated.filter(t => !(t.statut !== 'fait' && dueOf(t) < t0) && (S.ui.showDone || dueOf(t) >= t0));
  const tbc = T.filter(t => t.jalon && !dueOf(t) && t.statut !== 'fait');
  if (!late.length && !rest.length && !tbc.length) return empty('Aucune échéance.', 'Les tâches datées apparaissent ici, mois par mois.');
  let h = '';
  if (late.length) h += '<h2 class="ag-month late">En retard</h2>' + late.map(t => agRow(t)).join('');
  let cur = '';
  for (const t of rest) { const d = dueOf(t), m = d.slice(0, 7); if (m !== cur) { cur = m; h += `<h2 class="ag-month">${esc(F_MONTH.format(parseD(d)))}</h2>`; } h += agRow(t); }
  if (tbc.length) h += '<h2 class="ag-month">Date à confirmer</h2>' + tbc.map(t => agRow(t, true)).join('');
  return `<div class="agenda">${h}</div>`;
}
function renderPlanning() {
  const el = $('#v-plan'); if (!gate(el)) return;
  const sc = $('#g-scroll'); const prev = sc ? sc.scrollLeft : null;
  const mode = S.ui.planMode === 'echeances' ? 'echeances' : 'gantt';
  let h = `<div class="toolbar"><div class="seg" role="group" aria-label="Affichage"><button type="button" data-action="plan-mode" data-value="gantt" aria-pressed="${mode === 'gantt'}">Gantt</button><button type="button" data-action="plan-mode" data-value="echeances" aria-pressed="${mode === 'echeances'}">Échéances</button></div>`;
  if (mode === 'gantt') h += `<div class="seg" role="group" aria-label="Zoom">${Object.keys(ZOOMS).map(k => `<button type="button" data-action="zoom" data-value="${k}" aria-pressed="${S.ui.zoom === k}">${ZOOMS[k].l}</button>`).join('')}</div><button type="button" class="btn btn-sm" data-action="goto-today">Aujourd’hui</button>`;
  h += `<label class="toggle"><input type="checkbox" id="pl-done" data-action="show-done"${S.ui.showDone ? ' checked' : ''}>Afficher les tâches faites</label></div>`;
  h += `<div class="chips" role="group" aria-label="Domaines affichés">${domList(false).map(d => `<button type="button" class="chip" data-action="dom-filter" data-id="${esc(d.id)}" aria-pressed="${!S.ui.hidden.includes(d.id)}" style="--c:${domColor(d)}">${esc(d.nom)}</button>`).join('')}</div>`;
  h += mode === 'gantt' ? ganttHTML() : agendaHTML();
  el.innerHTML = h;
  if (mode === 'gantt') {
    const s2 = $('#g-scroll');
    if (s2) { if (S.ganttCenter || prev === null) { s2.scrollLeft = Math.max(0, Number(s2.dataset.today || 0) - 56); S.ganttCenter = false; } else s2.scrollLeft = prev; }
  }
}
view('planning', {
  label: 'Planning', masquable: true,
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M4 6h9M8 12h11M6 18h7"/></svg>',
  shell: () => `<div class="v-head v-head-row"><div><h1><span class="hl">Planning</span></h1><p class="v-sub">Gantt et échéances, calculés à partir des dates de tes tâches</p></div><button type="button" class="btn" data-action="new-task">+ Nouvelle tâche</button></div><div id="v-plan"></div>`,
  render: renderPlanning,
  onMount: () => { S.ganttCenter = true; }
});
action('plan-mode', a => { S.ui.planMode = a.dataset.value; S.ganttCenter = true; saveUI(); refresh(); });
action('zoom', a => { S.ui.zoom = a.dataset.value; S.ganttCenter = true; saveUI(); refresh(); });
action('goto-today', () => { S.ganttCenter = true; refresh(); });
action('show-done', () => { S.ui.showDone = !S.ui.showDone; saveUI(); refresh(); });
action('dom-filter', a => { const id = a.dataset.id, i = S.ui.hidden.indexOf(id); if (i >= 0) S.ui.hidden.splice(i, 1); else S.ui.hidden.push(id); saveUI(); refresh(); });
