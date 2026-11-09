/* OGGI et DOMANI : les listes du jour et du lendemain. Deux boutons ronds à côté de la date ;
   on lit les titres, on coche, on reporte (+1), on retire, on ajoute une tâche existante
   (la création reste dans l'onglet Tâches).
   Base automatique : OGGI = tâches non faites dont l'échéance est aujourd'hui ou passée ;
   DOMANI = tâches non faites dont l'échéance est demain.
   Ordre : priorité (haute, normale, basse), puis la dernière programmée ou ajoutée en haut ; les tâches cochées à la fin.
   Choix enregistrés dans reglages/oggi et reglages/domani (synchronisés) :
   { jour, ajouts: [ids], retraits: [ids], quand: { id: moment de l'ajout en ms } }.
   Le lendemain, les choix faits dans DOMANI passent automatiquement dans OGGI. */
import { S, get, rg, put, guarded } from '../core/store.js';
import { $, esc, ICON } from '../core/util.js';
import { fShort, addDays, diff } from '../core/dates.js';
import { sheet, action, onInput, openSheet, renderSheet, ui, head } from '../core/ui.js';
import { tasks, dueOf, visible, dom, domColor, toggleTask, openTaskEditor, reprogrammer, parentOf, childrenOf, prioOf, prioRank, prioIcon, prioBadge, planifMs, byDue } from './taches.js';

const LISTES = {
  oggi: { nom: 'OGGI', jour: () => S.today, report: 'demain', fait: 'Fait aujourd’hui', vide: 'Rien d’échu pour aujourd’hui. Ajoute une tâche si tu veux t’en fixer une.', auto: d => d <= S.today },
  domani: { nom: 'DOMANI', jour: () => addDays(S.today, 1), report: 'après-demain', fait: 'Déjà fait', vide: 'Rien de prévu pour demain. Ajoute une tâche si tu veux t’en fixer une.', auto: d => d === addDays(S.today, 1) }
};
const GROUPES = [['haute', 'Priorité haute'], ['normale', 'Priorité normale'], ['basse', 'Priorité basse']];
const K = k => (k === 'domani' ? 'domani' : 'oggi');
const arr = v => (Array.isArray(v) ? v : []);

function lu(key, jour) {
  const o = rg(key);
  if (o.jour !== jour) return { ajouts: [], retraits: [], quand: {} };
  return { ajouts: arr(o.ajouts), retraits: arr(o.retraits), quand: (o.quand && typeof o.quand === 'object' && !Array.isArray(o.quand)) ? o.quand : {} };
}
function etat(k) {
  const jour = LISTES[k].jour(), e = lu(k, jour);
  return { jour, ajouts: e.ajouts.slice(), retraits: e.retraits.slice(), quand: Object.assign({}, e.quand) };
}
/* Pour OGGI, on ajoute ce qui avait été préparé hier dans DOMANI (avec le moment de l'ajout) */
function choix(k) {
  const e = etat(k);
  if (k === 'oggi') {
    const h = lu('domani', S.today), venus = h.ajouts.filter(x => !e.retraits.includes(x));
    e.ajouts = [...new Set([...e.ajouts, ...venus])];
    for (const x of venus) if (!e.quand[x] && h.quand[x]) e.quand[x] = h.quand[x];
    e.retraits = [...new Set([...e.retraits, ...h.retraits.filter(x => !e.ajouts.includes(x))])];
  }
  return e;
}
async function saveEtat(k, fn) { const e = choix(k); fn(e); await put('reglages', k, e); }

function ouverte(t) { return t.statut !== 'fait' && t.statut !== 'annule'; }
/* Moment d'entrée dans la liste : date donnée à la tâche, ou ajout à la main s'il est plus récent */
const entree = (t, quand) => Math.max(planifMs(t), Number(quand[t.id]) || 0);

/* La liste : à faire d'abord (priorité, puis la plus récente en haut), puis celles cochées aujourd'hui */
export function liste(k) {
  k = K(k);
  const e = choix(k), aj = new Set(e.ajouts), re = new Set(e.retraits), L0 = LISTES[k];
  const L = tasks().filter(t => { const d = dueOf(t); return visible(t) && !re.has(t.id) && (aj.has(t.id) || (!!d && L0.auto(d))) && (ouverte(t) || t.faitLe === S.today); });
  const rank = t => (ouverte(t) ? 0 : 1);
  return L.sort((a, b) => (rank(a) - rank(b)) || (ouverte(a) ? prioRank(a) - prioRank(b) : 0) || (entree(b, e.quand) - entree(a, e.quand)) || String(a.titre).localeCompare(String(b.titre), 'fr'));
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

/* Étape d'un rétroplanning : la tâche principale et l'avancement de ses étapes */
function parentLine(t) {
  const p = parentOf(t); if (!p) return '';
  const kids = childrenOf(p.id), n = kids.filter(x => x.statut === 'fait').length;
  return `<button type="button" class="oggi-parent" data-action="oggi-open" data-id="${esc(p.id)}" title="Ouvrir la tâche principale">Étape de <b>${esc(p.titre)}</b> · ${n}/${kids.length} étapes faites</button>`;
}
/* Sous le titre, seulement ce qui aide à décider : retard, date si ce n'est pas celle de la liste, statut */
function metaLine(t, k) {
  if (!ouverte(t)) return '';
  const d = dueOf(t), jour = LISTES[k].jour(), m = [];
  if (!d) m.push('<span class="tag tag-q">sans date</span>');
  else if (d < S.today) m.push(`<span class="tag tag-late">retard ${diff(d, S.today)} j</span>`);
  else if (d === S.today && d !== jour) m.push('<span class="tag tag-today">prévue aujourd’hui</span>');
  else if (d !== jour) m.push(`<span class="tag">échéance ${esc(fShort(d))}</span>`);
  if (t.statut === 'en_cours') m.push('<span class="st st-cours">en cours</span>');
  if (t.statut === 'attente') m.push('<span class="st st-att">en attente</span>');
  return m.length ? `<span class="oggi-meta">${m.join('')}</span>` : '';
}
function rowHTML(t, k) {
  const fait = !ouverte(t), c = domColor(dom(t.domaine)), quand = LISTES[k].report, p = fait ? '' : prioOf(t);
  return `<li class="oggi-row${fait ? ' fait' : ' p-' + p}" style="--c:${c}"><button type="button" class="oggi-check" data-action="oggi-check" data-id="${esc(t.id)}" aria-pressed="${fait}" aria-label="${fait ? 'Rouvrir' : 'Cocher'} : ${esc(t.titre)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button><div class="oggi-tw"><button type="button" class="oggi-t" data-action="oggi-open" data-id="${esc(t.id)}">${esc(t.titre)}</button>${metaLine(t, k)}${parentLine(t)}</div>${fait ? '' : `<button type="button" class="oggi-plus1" data-action="oggi-plus1" data-id="${esc(t.id)}" aria-label="Reporter à ${quand} : ${esc(t.titre)}" title="Reporter à ${quand}">+1</button>`}<button type="button" class="oggi-x" data-action="oggi-retirer" data-id="${esc(t.id)}" aria-label="Retirer de la liste : ${esc(t.titre)}" title="Retirer de la liste (la tâche reste dans Tâches)">${ICON.close}</button></li>`;
}
const ul = (L, k) => `<ul class="oggi-list">${L.map(t => rowHTML(t, k)).join('')}</ul>`;
const groupH = (cls, label, n, icon) => `<h3 class="oggi-g ${cls}">${icon || ''}<span>${label}</span><span class="cnt">${n}</span></h3>`;
/* Groupes par priorité dès qu'une tâche n'est pas en priorité normale ; sinon une seule liste */
function listesHTML(L, k) {
  const open = L.filter(ouverte), done = L.filter(t => !ouverte(t));
  let h = '';
  if (open.some(t => prioOf(t) !== 'normale')) {
    for (const [p, label] of GROUPES) { const G = open.filter(t => prioOf(t) === p); if (G.length) h += `<section class="oggi-sec">${groupH('g-' + p, label, G.length, prioIcon(p))}${ul(G, k)}</section>`; }
  } else if (open.length) h += ul(open, k);
  if (done.length) h += `<section class="oggi-sec">${groupH('g-fait', LISTES[k].fait, done.length)}${ul(done, k)}</section>`;
  return h;
}
function pickRows(k, q) {
  const inList = new Set(liste(k).map(t => t.id)), s = String(q || '').trim().toLowerCase();
  const L = tasks().filter(t => visible(t) && ouverte(t) && !inList.has(t.id) && (!s || String(t.titre).toLowerCase().includes(s))).sort(byDue);
  if (!L.length) return `<p class="muted">${s ? 'Aucune tâche ne correspond.' : 'Toutes tes tâches ouvertes sont déjà dans la liste.'}</p>`;
  return `<ul class="oggi-list">${L.map(t => { const d = dueOf(t), p = parentOf(t); return `<li><button type="button" class="oggi-pick" data-action="oggi-ajouter" data-id="${esc(t.id)}" style="--c:${domColor(dom(t.domaine))}"><span class="oggi-pt">${esc(t.titre)}</span><small>${prioBadge(t)}<span>${esc(dom(t.domaine).nom)}${p ? ' › ' + esc(p.titre) : ''}${d ? ' · ' + (d < S.today ? 'retard ' + diff(d, S.today) + ' j' : esc(fShort(d))) : ' · sans date'}</span></small></button></li>`; }).join('')}</ul>`;
}

sheet('oggi', {
  render(sh) {
    const k = K(sh.k), L0 = LISTES[k];
    if (sh.pick) {
      return head('Ajouter à ' + L0.nom) + `<div class="sheet-body"><input type="search" id="oggi-q" class="input" placeholder="Chercher une tâche…" value="${esc(sh.q || '')}" autocomplete="off" data-autofocus><div id="oggi-pick">${pickRows(k, sh.q)}</div><button type="button" class="btn btn-ghost" data-action="oggi-retour">${ICON.left} Retour à la liste</button></div>`;
    }
    const L = liste(k), open = L.filter(ouverte), n = open.length;
    const late = open.filter(t => { const d = dueOf(t); return d && d < S.today; }).length;
    const sum = n ? `${n === 1 ? '1 chose à faire' : n + ' choses à faire'}${late ? ` · <span class="sum-late">${late} en retard</span>` : ''}` : 'Tout est fait. Bravo !';
    const body = L.length
      ? `<p class="oggi-sum">${sum}</p>${listesHTML(L, k)}${n ? `<p class="hint oggi-help">En haut : la priorité la plus haute, puis la dernière tâche programmée. <b>+1</b> reporte à ${L0.report}. <b>✕</b> retire de la liste sans supprimer la tâche.</p>` : ''}`
      : `<p class="muted">${L0.vide}</p>`;
    return head(L0.nom + ' · ' + fShort(L0.jour())) + `<div class="sheet-body oggi-${k}">${body}<button type="button" class="btn" data-action="oggi-pick">${ICON.plus} Ajouter une tâche existante</button></div>`;
  }
});

const cur = () => K(ui.sheet && ui.sheet.k);
const sansQuand = (e, id) => { if (e.quand) delete e.quand[id]; };
action('oggi', () => openSheet({ kind: 'oggi', k: 'oggi' }));
action('domani', () => openSheet({ kind: 'oggi', k: 'domani' }));
action('oggi-check', a => guarded(() => toggleTask(a.dataset.id)));
action('oggi-open', a => { if (get('taches', a.dataset.id)) openTaskEditor(a.dataset.id); });
/* +1 : OGGI → demain (la tâche rejoint DOMANI, en tête), DOMANI → après-demain */
action('oggi-plus1', a => guarded(async () => {
  const id = a.dataset.id, k = cur();
  await saveEtat(k, e => { e.ajouts = e.ajouts.filter(x => x !== id); sansQuand(e, id); });
  await reprogrammer(id, addDays(LISTES[k].jour(), 1));
}));
action('oggi-retirer', a => guarded(() => saveEtat(cur(), e => { const id = a.dataset.id; e.ajouts = e.ajouts.filter(x => x !== id); sansQuand(e, id); if (!e.retraits.includes(id)) e.retraits.push(id); })));
/* Ajout à la main : la tâche arrive en tête de son groupe de priorité */
action('oggi-ajouter', a => guarded(async () => {
  const id = a.dataset.id;
  await saveEtat(cur(), e => { e.retraits = e.retraits.filter(x => x !== id); if (!e.ajouts.includes(id)) e.ajouts.push(id); e.quand[id] = Date.now(); });
  if (ui.sheet) { ui.sheet.pick = false; ui.sheet.q = ''; renderSheet(); }
}));
action('oggi-pick', () => { if (ui.sheet) { ui.sheet.pick = true; renderSheet(); setTimeout(() => { const f = $('#oggi-q'); if (f) f.focus(); }, 40); } });
action('oggi-retour', () => { if (ui.sheet) { ui.sheet.pick = false; renderSheet(); } });
onInput('oggi-q', el => { if (!ui.sheet) return; ui.sheet.q = el.value; const box = $('#oggi-pick'); if (box) box.innerHTML = pickRows(cur(), el.value); });

/* Appelé à chaque rafraîchissement : boutons à jour, liste à jour si elle est ouverte */
export function oggiRefresh() {
  renderBtn('oggi'); renderBtn('domani');
  if (ui.sheet && ui.sheet.kind === 'oggi' && !ui.sheet.pick) renderSheet();
}
