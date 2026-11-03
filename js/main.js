/* Regia : démarrage, navigation et événements. Chaque onglet vit dans js/tabs/. */
import { S, rebuild, saveUI } from './core/store.js';
import { LocalDB } from './core/db.js';
import { $, esc, toast, ICON } from './core/util.js';
import { ymd, fShort, isoWeek } from './core/dates.js';
import { VIEWS, ACTIONS, INPUTS, CHANGES, SUBMITS, hooks, ui, sheet, head, openSheet, closeSheet, onSheetField, masques } from './core/ui.js';
import { renderSync, agendaCache } from './core/sync.js';
import { stepAdd } from './tabs/taches.js';
import './tabs/aujourdhui.js';
import './tabs/notes.js';
import './tabs/contenus.js';
import './tabs/planning.js';
import './tabs/reunions.js';
import './tabs/exercices.js';
import './tabs/candidatures.js';
import { NAV_ORDER, importBackup } from './tabs/reglages.js';

/* ---- Navigation ---- */
function navViews() { const m = masques(); return NAV_ORDER.filter(v => VIEWS.has(v) && (v === 'aujourdhui' || !m.includes(v))); }
function badgeOf(v) { const def = VIEWS.get(v); if (!def || !def.badge || !S.db) return 0; try { return def.badge() || 0; } catch (e) { return 0; } }
function tabLink(v, cls) {
  const def = VIEWS.get(v), b = badgeOf(v);
  return `<a class="${cls}" href="#${v}" data-view="${v}"${S.view === v ? ' aria-current="page"' : ''}>${def.icon}<span>${esc(def.label)}</span>${b ? `<b class="nbadge" aria-label="${b} à traiter">${b > 99 ? '99+' : b}</b>` : ''}</a>`;
}
function renderNav() {
  const vs = navViews();
  const top = $('#nav-top'); if (top) top.innerHTML = vs.map(v => tabLink(v, 'tab')).join('');
  const bottom = $('#nav-bottom'); if (!bottom) return;
  const main = vs.slice(0, 4), rest = vs.slice(4);
  const inRest = rest.includes(S.view) || S.view === 'reglages';
  const restBadge = rest.reduce((n, v) => n + badgeOf(v), 0);
  bottom.innerHTML = main.map(v => tabLink(v, 'btab')).join('') + `<button type="button" class="btab" data-action="nav-plus"${inRest ? ' aria-current="page"' : ''}>${ICON.more}<span>Plus</span>${restBadge ? `<b class="nbadge">${restBadge}</b>` : ''}</button>`;
}
sheet('plus', {
  render() {
    const rest = navViews().slice(4).concat(['reglages']);
    return head('Plus') + `<div class="sheet-body plus-list">${rest.map(v => tabLink(v, 'plus-item')).join('')}</div>`;
  }
});
ACTIONS.set('nav-plus', () => openSheet({ kind: 'plus' }));

/* ---- Menu des calendriers (clic sur la date en haut à gauche) ---- */
const COMPTE_AGENDA = 'franckscom360@gmail.com';
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
export function gcalUrl(d) {
  const p = (d || S.today).split('-'), a = agendaCache();
  return `https://calendar.google.com/calendar/r/day/${Number(p[0])}/${Number(p[1])}/${Number(p[2])}?authuser=${encodeURIComponent((a && a.agenda) || COMPTE_AGENDA)}`;
}
sheet('cal', {
  render() {
    let h = `<a class="plus-item" href="${esc(gcalUrl())}" target="_blank" rel="noopener" data-action="cal-go">${ICON.cal}<span>Google Agenda<small class="plus-sub">Ta journée d’aujourd’hui</small></span>${ICON.ext}</a>`;
    if (isIOS()) { const sec = Math.floor((Date.now() - Date.UTC(2001, 0, 1)) / 1000); h += `<a class="plus-item" href="calshow:${sec}" data-action="cal-go">${ICON.cal}<span>Calendrier de l’iPhone<small class="plus-sub">L’app Calendrier d’Apple</small></span></a>`; }
    if (VIEWS.has('planning') && !masques().includes('planning')) h += `<button type="button" class="plus-item" data-action="cal-planning">${VIEWS.get('planning').icon}<span>Planning de Regia<small class="plus-sub">Tes échéances, jour par jour</small></span></button>`;
    return head('Calendrier') + `<div class="sheet-body plus-list">${h}</div>`;
  }
});
ACTIONS.set('cal-menu', () => openSheet({ kind: 'cal' }));
ACTIONS.set('cal-go', () => { setTimeout(closeSheet, 300); });
ACTIONS.set('cal-planning', () => { S.ui.planMode = 'echeances'; try { saveUI(); } catch (e) { } closeSheet(); if (location.hash === '#planning') refresh(); else location.hash = '#planning'; });

function currentView() {
  const h = (location.hash || '').slice(1);
  if (h === 'reglages') return h;
  return (VIEWS.has(h) && !masques().includes(h)) ? h : 'aujourdhui';
}
function mountView(v) {
  S.view = v;
  const def = VIEWS.get(v);
  if (def.onMount) def.onMount();
  $('#view').innerHTML = def.shell();
  refresh();
  window.scrollTo(0, 0);
}
function refresh() {
  renderNav();
  if (S.view !== 'reglages' && masques().includes(S.view)) { location.hash = '#aujourdhui'; return; }
  const pill = $('#today-pill'); if (pill) pill.innerHTML = ICON.cal + '<span>' + esc(fShort(S.today) + ' · S' + isoWeek(S.today)) + '</span>';
  const def = VIEWS.get(S.view); if (def) def.render();
  renderSync();
}
let rq = 0;
function schedule() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; refresh(); }); }
hooks.refresh = refresh; hooks.schedule = schedule;

/* ---- Événements ---- */
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-action]'); if (!a) return;
  const fn = ACTIONS.get(a.dataset.action); if (!fn) return;
  try { await fn(a, e); } catch (err) { console.warn(err); toast('Action impossible pour le moment.', 'err'); }
});
document.addEventListener('input', e => {
  const t = e.target;
  const fn = INPUTS.get(t.id) || (t.dataset && t.dataset.input && INPUTS.get('@' + t.dataset.input));
  if (fn) { fn(t); return; }
  if (ui.sheet && t.closest('#sheet-root')) onSheetField(t, false);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'import-file') { const f = t.files && t.files[0]; t.value = ''; if (f) importBackup(f); return; }
  const fn = CHANGES.get(t.id) || (t.dataset && t.dataset.change && CHANGES.get('@' + t.dataset.change));
  if (fn) { fn(t); return; }
  if (ui.sheet && t.closest('#sheet-root')) onSheetField(t, true);
});
document.addEventListener('submit', e => {
  const fn = e.target && SUBMITS.get(e.target.id); if (!fn) return;
  e.preventDefault(); fn(e.target);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.sheet) { closeSheet(); return; }
  if (e.key === 'Enter' && e.target && e.target.id === 'f-st-t') { e.preventDefault(); stepAdd(); }
});
window.addEventListener('hashchange', () => { closeSheet(); mountView(currentView()); });
window.addEventListener('online', () => { renderSync(); if (LocalDB.pend.size) toast('De retour en ligne : pense à synchroniser.'); });
window.addEventListener('offline', () => { renderSync(); toast('Hors ligne : tout reste enregistré sur cet appareil.'); });
function checkDay() { const t = ymd(new Date()); if (t !== S.today) { S.today = t; refresh(); } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
setInterval(checkDay, 60000);
LocalDB.onChange(cols => { rebuild(cols); schedule(); });

/* ---- Mise à jour de l'app (service worker) ---- */
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let had = !!navigator.serviceWorker.controller, reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had) { had = true; return; } if (reloading) return; reloading = true; location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    S.swReg = reg;
    const offer = () => { const bar = $('#update-bar'); if (bar && reg.waiting) bar.hidden = false; };
    if (reg.waiting && navigator.serviceWorker.controller) offer();
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(); }); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && navigator.onLine) reg.update().catch(() => { }); });
  }).catch(e => console.warn('Service worker', e));
}
ACTIONS.set('update-app', () => { if (S.swReg && S.swReg.waiting) S.swReg.waiting.postMessage('skipWaiting'); else location.reload(); });

/* ---- Démarrage ---- */
async function start() {
  mountView(currentView());
  registerSW();
  try { S.db = await LocalDB.open(); }
  catch (e) { console.warn(e); S.db = null; S.status = 'off'; refresh(); toast('Stockage local indisponible sur cet appareil.', 'err'); return; }
  S.status = 'ok';
  rebuild(Object.keys(S.data));
  refresh();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
}
start();
