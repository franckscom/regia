/* OGGI : la liste du jour. Bouton rond à côté de la date ; on ne lit que les titres, on coche, on retire.
   Base automatique : tâches non faites dont l'échéance est aujourd'hui ou passée.
   On peut y ajouter n'importe quelle tâche existante (la création reste dans l'onglet Tâches).
   Choix du jour enregistrés dans reglages/oggi (synchronisés) : { jour, ajouts: [ids], retraits: [ids] }. */
import { S, get, rg, put, guarded } from '../core/store.js';
import { $, esc, ICON } from '../core/util.js';
import { fShort } from '../core/dates.js';
import { sheet, action, onInput, openSheet, renderSheet, ui, head } from '../core/ui.js';
import { tasks, dueOf, visible, dom, domColor, toggleTask, openTaskEditor } from './taches.js';

function etat() {
  const o = rg('oggi');
  if (o.jour !== S.today) return { jour: S.today, ajouts: [], retraits: [] };
  return { jour: S.today, ajouts: Array.isArray(o.ajouts) ? o.ajouts.slice() : [], retraits: Array.isArray(o.retraits) ? o.retraits.slice() : [] };
}
async function saveEtat(fn) { const e = etat(); fn(e); await put('reglages', 'oggi', e); }

function ouverte(t) { return t.statut !== 'fait' && t.statut !== 'annule'; }
function auto(t) { const d = dueOf(t); return !!d && d <= S.today; }

/* La liste du jour : à faire d'abord (dans l'ordre d'échéance), puis celles cochées aujourd'hui */
export function oggiList() {
  const e = etat(), aj = new Set(e.ajouts), re = new Set(e.retraits);
  const L = tasks().filter(t => visible(t) && !re.has(t.id) && (aj.has(t.id) || auto(t)) && (ouverte(t) || t.faitLe === S.today));
  const rank = t => (ouverte(t) ? 0 : 1);
  return L.sort((a, b) => (rank(a) - rank(b)) || String(dueOf(a) || '9999').localeCompare(String(dueOf(b) || '9999')) || String(a.titre).localeCompare(String(b.titre), 'fr'));
}
export function oggiRestant() { return oggiList().filter(ouverte).length; }

/* Bouton rond de l'en-tête */
export function renderOggiBtn() {
  const b = $('#oggi-btn'); if (!b) return;
  const n = S.db ? oggiRestant() : 0;
  b.innerHTML = `<span>OGGI</span>${n ? `<b class="oggi-n">${n}</b>` : ''}`;
  b.setAttribute('aria-label', n ? `Oggi : ${n} à faire` : 'Oggi');
}

function rowHTML(t) {
  const fait = !ouverte(t), c = domColor(dom(t.domaine));
  return `<li class="oggi-row${fait ? ' fait' : ''}" style="--c:${c}"><button type="button" class="oggi-check" data-action="oggi-check" data-id="${esc(t.id)}" aria-pressed="${fait}" aria-label="${fait ? 'Rouvrir' : 'Cocher'} : ${esc(t.titre)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button><button type="button" class="oggi-t" data-action="oggi-open" data-id="${esc(t.id)}">${esc(t.titre)}</button><button type="button" class="oggi-x" data-action="oggi-retirer" data-id="${esc(t.id)}" aria-label="Retirer de la liste du jour">${ICON.close}</button></li>`;
}
function pickRows(q) {
  const inList = new Set(oggiList().map(t => t.id)), s = String(q || '').trim().toLowerCase();
  const L = tasks().filter(t => visible(t) && ouverte(t) && !inList.has(t.id) && (!s || String(t.titre).toLowerCase().includes(s)))
    .sort((a, b) => String(dueOf(a) || '9999').localeCompare(String(dueOf(b) || '9999')) || String(a.titre).localeCompare(String(b.titre), 'fr'));
  if (!L.length) return `<p class="muted">${s ? 'Aucune tâche ne correspond.' : 'Toutes tes tâches ouvertes sont déjà dans la liste.'}</p>`;
  return `<ul class="oggi-list">${L.map(t => { const d = dueOf(t); return `<li><button type="button" class="oggi-pick" data-action="oggi-ajouter" data-id="${esc(t.id)}" style="--c:${domColor(dom(t.domaine))}"><span class="oggi-pt">${esc(t.titre)}</span><small>${esc(dom(t.domaine).nom)}${d ? ' · ' + esc(fShort(d)) : ''}</small></button></li>`; }).join('')}</ul>`;
}

sheet('oggi', {
  render(sh) {
    if (sh.pick) {
      return head('Ajouter à OGGI') + `<div class="sheet-body"><input type="search" id="oggi-q" class="input" placeholder="Chercher une tâche…" value="${esc(sh.q || '')}" autocomplete="off" data-autofocus><div id="oggi-pick">${pickRows(sh.q)}</div><button type="button" class="btn btn-ghost" data-action="oggi-retour">${ICON.left} Retour à la liste</button></div>`;
    }
    const L = oggiList(), n = L.filter(ouverte).length;
    const body = L.length
      ? `<p class="oggi-sum">${n ? (n === 1 ? '1 chose à faire' : n + ' choses à faire') : 'Tout est fait. Bravo !'}</p><ul class="oggi-list">${L.map(rowHTML).join('')}</ul>`
      : `<p class="muted">Rien d'échu pour aujourd'hui. Ajoute une tâche si tu veux t'en fixer une.</p>`;
    return head('OGGI · ' + fShort(S.today)) + `<div class="sheet-body">${body}<button type="button" class="btn" data-action="oggi-pick">${ICON.plus} Ajouter une tâche existante</button></div>`;
  }
});

action('oggi', () => openSheet({ kind: 'oggi' }));
action('oggi-check', a => guarded(() => toggleTask(a.dataset.id)));
action('oggi-open', a => { if (get('taches', a.dataset.id)) openTaskEditor(a.dataset.id); });
action('oggi-retirer', a => guarded(() => saveEtat(e => { const id = a.dataset.id; e.ajouts = e.ajouts.filter(x => x !== id); if (!e.retraits.includes(id)) e.retraits.push(id); })));
action('oggi-ajouter', a => guarded(async () => { const id = a.dataset.id; await saveEtat(e => { e.retraits = e.retraits.filter(x => x !== id); if (!e.ajouts.includes(id)) e.ajouts.push(id); }); if (ui.sheet) { ui.sheet.pick = false; ui.sheet.q = ''; renderSheet(); } }));
action('oggi-pick', () => { if (ui.sheet) { ui.sheet.pick = true; renderSheet(); setTimeout(() => { const f = $('#oggi-q'); if (f) f.focus(); }, 40); } });
action('oggi-retour', () => { if (ui.sheet) { ui.sheet.pick = false; renderSheet(); } });
onInput('oggi-q', el => { if (!ui.sheet) return; ui.sheet.q = el.value; const box = $('#oggi-pick'); if (box) box.innerHTML = pickRows(el.value); });

/* Appelé à chaque rafraîchissement : bouton à jour, liste à jour si elle est ouverte */
export function oggiRefresh() {
  renderOggiBtn();
  if (ui.sheet && ui.sheet.kind === 'oggi' && !ui.sheet.pick) renderSheet();
}
