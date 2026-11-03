/* OGGI et DOMANI : les listes du jour et du lendemain. Deux boutons ronds à côté de la date ;
   on ne lit que les titres, on coche, on reporte (+1), on retire, on ajoute une tâche existante
   (la création reste dans l'onglet Tâches).
   Base automatique : OGGI = tâches non faites dont l'échéance est aujourd'hui ou passée ;
   DOMANI = tâches non faites dont l'échéance est demain.
   Choix enregistrés dans reglages/oggi et reglages/domani (synchronisés) : { jour, ajouts: [ids], retraits: [ids] }.
   Le lendemain, les choix faits dans DOMANI passent automatiquement dans OGGI. */
import { S, get, rg, put, guarded } from '../core/store.js';
import { $, esc, ICON } from '../core/util.js';
import { fShort, addDays } from '../core/dates.js';
import { sheet, action, onInput, openSheet, renderSheet, ui, head } from '../core/ui.js';
import { tasks, dueOf, visible, dom, domColor, toggleTask, openTaskEditor, reprogrammer } from './taches.js';

const LISTES = {
  oggi: { nom: 'OGGI', jour: () => S.today, vide: 'Rien d’échu pour aujourd’hui. Ajoute une tâche si tu veux t’en fixer une.', auto: d => d <= S.today },
  domani: { nom: 'DOMANI', jour: () => addDays(S.today, 1), vide: 'Rien de prévu pour demain. Ajoute une tâche si tu veux t’en fixer une.', auto: d => d === addDays(S.today, 1) }
};
const K = k => (k === 'domani' ? 'domani' : 'oggi');

function lu(key, jour) {
  const o = rg(key);
  return o.jour === jour ? { ajouts: Array.isArray(o.ajouts) ? o.ajouts : [], retraits: Array.isArray(o.retraits) ? o.retraits : [] } : { ajouts: [], retraits: [] };
}
function etat(k) {
  const jour = LISTES[k].jour(), e = lu(k, jour);
  return { jour, ajouts: e.ajouts.slice(), retraits: e.retraits.slice() };
}
/* Pour OGGI, on ajoute ce qui avait été préparé hier dans DOMANI */
function choix(k) {
  const e = etat(k);
  if (k === 'oggi') { const h = lu('domani', S.today); e.ajouts = [...new Set([...e.ajouts, ...h.ajouts.filter(x => !e.retraits.includes(x))])]; e.retraits = [...new Set([...e.retraits, ...h.retraits.filter(x => !e.ajouts.includes(x))])]; }
  return e;
}
async function saveEtat(k, fn) { const e = choix(k); fn(e); await put('reglages', k, e); }

function ouverte(t) { return t.statut !== 'fait' && t.statut !== 'annule'; }

/* La liste : à faire d'abord (dans l'ordre d'échéance), puis celles cochées aujourd'hui */
export function liste(k) {
  k = K(k);
  const e = choix(k), aj = new Set(e.ajouts), re = new Set(e.retraits), L0 = LISTES[k];
  const L = tasks().filter(t => { const d = dueOf(t); return visible(t) && !re.has(t.id) && (aj.has(t.id) || (!!d && L0.auto(d))) && (ouverte(t) || t.faitLe === S.today); });
  const rank = t => (ouverte(t) ? 0 : 1);
  return L.sort((a, b) => (rank(a) - rank(b)) || String(dueOf(a) || '9999').localeCompare(String(dueOf(b) || '9999')) || String(a.titre).localeCompare(String(b.titre), 'fr'));
}
export const oggiList = () => liste('oggi');
const restant = k => liste(k).filter(ouverte).length;

/* Boutons ronds de l'en-tête */
function renderBtn(k) {
  const b = $('#' + k + '-btn'); if (!b) return;
  const n = S.db ? restant(k) : 0, nom = LISTES[k].nom;
  b.innerHTML = `<span>${nom}</span>${n ? `<b class="oggi-n">${n}</b>` : ''}`;
  b.setAttribute('aria-label', n ? `${nom} : ${n} à faire` : nom);
}

function rowHTML(t, k) {
  const fait = !ouverte(t), c = domColor(dom(t.domaine)), quand = k === 'domani' ? 'après-demain' : 'demain';
  return `<li class="oggi-row${fait ? ' fait' : ''}" style="--c:${c}"><button type="button" class="oggi-check" data-action="oggi-check" data-id="${esc(t.id)}" aria-pressed="${fait}" aria-label="${fait ? 'Rouvrir' : 'Cocher'} : ${esc(t.titre)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button><button type="button" class="oggi-t" data-action="oggi-open" data-id="${esc(t.id)}">${esc(t.titre)}</button>${fait ? '' : `<button type="button" class="oggi-plus1" data-action="oggi-plus1" data-id="${esc(t.id)}" aria-label="Reporter à ${quand} : ${esc(t.titre)}" title="Reporter à ${quand}">+1</button>`}<button type="button" class="oggi-x" data-action="oggi-retirer" data-id="${esc(t.id)}" aria-label="Retirer de la liste">${ICON.close}</button></li>`;
}
function pickRows(k, q) {
  const inList = new Set(liste(k).map(t => t.id)), s = String(q || '').trim().toLowerCase();
  const L = tasks().filter(t => visible(t) && ouverte(t) && !inList.has(t.id) && (!s || String(t.titre).toLowerCase().includes(s)))
    .sort((a, b) => String(dueOf(a) || '9999').localeCompare(String(dueOf(b) || '9999')) || String(a.titre).localeCompare(String(b.titre), 'fr'));
  if (!L.length) return `<p class="muted">${s ? 'Aucune tâche ne correspond.' : 'Toutes tes tâches ouvertes sont déjà dans la liste.'}</p>`;
  return `<ul class="oggi-list">${L.map(t => { const d = dueOf(t); return `<li><button type="button" class="oggi-pick" data-action="oggi-ajouter" data-id="${esc(t.id)}" style="--c:${domColor(dom(t.domaine))}"><span class="oggi-pt">${esc(t.titre)}</span><small>${esc(dom(t.domaine).nom)}${d ? ' · ' + esc(fShort(d)) : ''}</small></button></li>`; }).join('')}</ul>`;
}

sheet('oggi', {
  render(sh) {
    const k = K(sh.k), L0 = LISTES[k];
    if (sh.pick) {
      return head('Ajouter à ' + L0.nom) + `<div class="sheet-body"><input type="search" id="oggi-q" class="input" placeholder="Chercher une tâche…" value="${esc(sh.q || '')}" autocomplete="off" data-autofocus><div id="oggi-pick">${pickRows(k, sh.q)}</div><button type="button" class="btn btn-ghost" data-action="oggi-retour">${ICON.left} Retour à la liste</button></div>`;
    }
    const L = liste(k), n = L.filter(ouverte).length;
    const body = L.length
      ? `<p class="oggi-sum">${n ? (n === 1 ? '1 chose à faire' : n + ' choses à faire') : 'Tout est fait. Bravo !'}</p><ul class="oggi-list">${L.map(t => rowHTML(t, k)).join('')}</ul>`
      : `<p class="muted">${L0.vide}</p>`;
    return head(L0.nom + ' · ' + fShort(L0.jour())) + `<div class="sheet-body oggi-${k}">${body}<button type="button" class="btn" data-action="oggi-pick">${ICON.plus} Ajouter une tâche existante</button></div>`;
  }
});

const cur = () => K(ui.sheet && ui.sheet.k);
action('oggi', () => openSheet({ kind: 'oggi', k: 'oggi' }));
action('domani', () => openSheet({ kind: 'oggi', k: 'domani' }));
action('oggi-check', a => guarded(() => toggleTask(a.dataset.id)));
action('oggi-open', a => { if (get('taches', a.dataset.id)) openTaskEditor(a.dataset.id); });
/* +1 : OGGI → demain (la tâche rejoint DOMANI), DOMANI → après-demain */
action('oggi-plus1', a => guarded(async () => {
  const id = a.dataset.id, k = cur();
  await saveEtat(k, e => { e.ajouts = e.ajouts.filter(x => x !== id); });
  await reprogrammer(id, addDays(LISTES[k].jour(), 1));
}));
action('oggi-retirer', a => guarded(() => saveEtat(cur(), e => { const id = a.dataset.id; e.ajouts = e.ajouts.filter(x => x !== id); if (!e.retraits.includes(id)) e.retraits.push(id); })));
action('oggi-ajouter', a => guarded(async () => { const id = a.dataset.id; await saveEtat(cur(), e => { e.retraits = e.retraits.filter(x => x !== id); if (!e.ajouts.includes(id)) e.ajouts.push(id); }); if (ui.sheet) { ui.sheet.pick = false; ui.sheet.q = ''; renderSheet(); } }));
action('oggi-pick', () => { if (ui.sheet) { ui.sheet.pick = true; renderSheet(); setTimeout(() => { const f = $('#oggi-q'); if (f) f.focus(); }, 40); } });
action('oggi-retour', () => { if (ui.sheet) { ui.sheet.pick = false; renderSheet(); } });
onInput('oggi-q', el => { if (!ui.sheet) return; ui.sheet.q = el.value; const box = $('#oggi-pick'); if (box) box.innerHTML = pickRows(cur(), el.value); });

/* Appelé à chaque rafraîchissement : boutons à jour, liste à jour si elle est ouverte */
export function oggiRefresh() {
  renderBtn('oggi'); renderBtn('domani');
  if (ui.sheet && ui.sheet.kind === 'oggi' && !ui.sheet.pick) renderSheet();
}
