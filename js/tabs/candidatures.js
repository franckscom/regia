/* Candidatures : outils reliés et échéances de la recherche. */
import { S } from '../core/store.js';
import { $, esc, ICON } from '../core/util.js';
import { DOMAINE_CANDID } from '../core/config.js';
import { view, section, liens, NOTICE_OFF } from '../core/ui.js';
import { tasks, byDue, taskRow } from './taches.js';

function renderHub() {
  const el = $('#v-hub'); if (!el) return;
  const L = liens();
  let h = `<div class="hub">${L.map((l, i) => `<a class="hub-item${i === 0 ? ' main' : ''}" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="hub-n">${esc(l.nom)}</span><span class="hub-d">${esc(l.desc || '')}</span><span class="hub-go">Ouvrir ${ICON.ext}</span></a>`).join('')}</div>`;
  if (S.db) {
    const open = tasks().filter(t => t.domaine === DOMAINE_CANDID && t.statut !== 'fait').sort(byDue);
    h += section('candtasks', 'Échéances de la recherche', open.length, open.length ? open.map(t => taskRow(t, { noDom: true })).join('') : '<p class="empty-line">Aucune tâche en cours dans ce domaine.</p>');
  } else if (S.status !== 'connecting') h += NOTICE_OFF;
  el.innerHTML = h;
}
view('candidatures', {
  label: 'Candidatures', masquable: true,
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7.5" width="18" height="12.5" rx="2"/><path d="M9 7.5V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8v1.7M3 13h18"/></svg>',
  shell: () => `<div class="v-head"><h1><span class="hl">Candidatures</span></h1><p class="v-sub">Ton suivi détaillé vit dans l’app Candidatures 2026-27 : ici, tes outils et tes échéances</p></div><div id="v-hub"></div>`,
  render: renderHub
});
