/* Réglages : synchronisation, domaines, onglets, comptes et rythmes, interactions, modèles, sauvegarde. */
import { S, list, get, put, patch, remove, guarded, rg } from '../core/store.js';
import { $, esc, clone, clean, toast, ICON } from '../core/util.js';
import { stamp } from '../core/dates.js';
import { APP, COLLS, PALETTE, PALETTE_NOMS, INTER_COMPTES, color } from '../core/config.js';
import { VIEWS, view, action, onChange, sheet, openSheet, head, foot, gate, masques, refresh } from '../core/ui.js';
import { LocalDB } from '../core/db.js';
import { syncSection } from '../core/sync.js';
import { saveFile } from '../core/files.js';
import { tasks, domList, domColor, jTxt, openModeleEditor, dom } from './taches.js';
import { comptes } from './contenus.js';

export const NAV_ORDER = ['aujourdhui', 'notes', 'taches', 'contenus', 'planning', 'reunions', 'exercices', 'candidatures'];

function renderSettings() {
  const el = $('#v-set'); if (!gate(el)) return;
  const doms = domList(true), counts = {}, m = masques();
  for (const t of tasks()) counts[t.domaine] = (counts[t.domaine] || 0) + 1;
  let h = syncSection();
  h += `<section class="set-sec"><div class="set-h"><h2 class="sec-h">Domaines</h2><button type="button" class="btn btn-sm" data-action="new-dom">+ Domaine</button></div>`;
  h += doms.map((d, i) => { const n = counts[d.id] || 0; return `<div class="set-row"><span class="sq" style="--c:${domColor(d)}"></span><div class="set-txt"><span class="set-name">${esc(d.nom)}</span><span class="set-meta">${n} tâche${n > 1 ? 's' : ''}${d.archive ? ' · archivé' : ''}</span></div><div class="set-actions"><button type="button" class="icon-btn sm" data-action="dom-move" data-id="${esc(d.id)}" data-dir="-1" aria-label="Monter ${esc(d.nom)}"${i === 0 ? ' disabled' : ''}>${ICON.up}</button><button type="button" class="icon-btn sm" data-action="dom-move" data-id="${esc(d.id)}" data-dir="1" aria-label="Descendre ${esc(d.nom)}"${i === doms.length - 1 ? ' disabled' : ''}>${ICON.down}</button><button type="button" class="btn btn-sm" data-action="edit-dom" data-id="${esc(d.id)}">Modifier</button></div></div>`; }).join('') || '<p class="empty-line">Aucun domaine.</p>';
  h += '</section>';
  h += `<section class="set-sec"><div class="set-h"><h2 class="sec-h">Onglets</h2></div>`;
  h += NAV_ORDER.filter(k => VIEWS.has(k) && VIEWS.get(k).masquable).map(k => `<div class="set-row set-row-2"><div class="set-txt"><span class="set-name">${esc(VIEWS.get(k).label)}</span><span class="set-meta">${m.includes(k) ? 'masqué' : 'affiché'}</span></div><div class="set-actions"><button type="button" class="btn btn-sm" data-action="toggle-onglet" data-id="${k}">${m.includes(k) ? 'Afficher' : 'Masquer'}</button></div></div>`).join('');
  h += `<p class="prose">« Aujourd’hui » et les Réglages restent toujours visibles. Sur téléphone, les premiers onglets affichés vont dans la barre du bas, les autres dans « Plus ». Pour un nouvel onglet ou une nouvelle fonction, demande-le à Claude : il met l’app à jour et tes données ne bougent pas.</p></section>`;
  h += `<section class="set-sec"><div class="set-h"><h2 class="sec-h">Comptes et rythmes</h2></div><p class="prose">Nombre de contenus par semaine pour chaque compte. Un compte en pause n’apparaît pas dans la couverture du calendrier.</p>`;
  h += comptes().map(c => `<div class="set-row"><span class="sq" style="--c:${color(c.couleur)}"></span><div class="set-txt"><span class="set-name">${esc(c.nom)}</span><span class="set-meta">${c.plateforme === 'youtube' ? 'YouTube' : 'LinkedIn'}${c.pause ? ' · en pause' : ''}</span></div><div class="set-actions"><label class="num"><input type="number" min="0" max="14" inputmode="numeric" data-change="rythme" data-id="${esc(c.id)}" value="${c.rythme}" aria-label="Contenus par semaine pour ${esc(c.nom)}"><span>/ sem.</span></label><button type="button" class="btn btn-sm${c.pause ? '' : ' btn-ghost'}" data-action="compte-pause" data-id="${esc(c.id)}">${c.pause ? 'Réactiver' : 'Mettre en pause'}</button></div></div>`).join('');
  h += '</section>';
  const io = rg('interactions');
  h += `<section class="set-sec"><div class="set-h"><h2 class="sec-h">Interactions LinkedIn</h2></div><p class="prose">Objectifs par jour. Mets 0 pour retirer une action de la liste du jour.</p>`;
  for (const ac of INTER_COMPTES) {
    h += `<h3 class="set-sub" style="--c:${color(ac.couleur)}">${esc(ac.nom)}</h3>`;
    h += ac.actions.map(([k, l, n]) => { const v = io[ac.id] && Number.isFinite(Number(io[ac.id][k])) ? Number(io[ac.id][k]) : n; return `<div class="set-row set-row-2"><div class="set-txt"><span class="set-name">${esc(l)}</span></div><div class="set-actions"><label class="num"><input type="number" min="0" max="50" inputmode="numeric" data-change="inter" data-compte="${ac.id}" data-k="${k}" value="${v}" aria-label="${esc(l)} par jour"><span>/ jour</span></label></div></div>`; }).join('');
  }
  h += '</section>';
  const mods = list('modeles').sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
  h += `<section class="set-sec"><div class="set-h"><h2 class="sec-h">Modèles de rétroplanning</h2><button type="button" class="btn btn-sm" data-action="new-modele">+ Modèle</button></div>`;
  h += mods.map(md => `<div class="set-row set-row-2"><div class="set-txt"><span class="set-name">${esc(md.nom)}</span><span class="set-meta mono">${(Array.isArray(md.etapes) ? md.etapes : []).map(e => jTxt(e.offset)).join(' · ') || 'aucune étape'}</span>${Array.isArray(md.domaines) && md.domaines.length ? `<span class="set-meta">Suggéré pour : ${esc(md.domaines.map(x => dom(x).nom).join(', '))}</span>` : ''}</div><div class="set-actions"><button type="button" class="btn btn-sm" data-action="edit-modele" data-id="${esc(md.id)}">Modifier</button></div></div>`).join('') || '<p class="empty-line">Aucun modèle.</p>';
  h += '</section>';
  h += `<section class="set-sec"><div class="set-h"><h2 class="sec-h">Sauvegarde</h2></div><p class="prose">Télécharge une copie complète de tes données (fichier JSON), ou réimporte une copie : les fiches importées seront envoyées à tes autres appareils à la prochaine synchro.</p><div class="set-btns"><button type="button" class="btn" data-action="export">Télécharger une sauvegarde</button><button type="button" class="btn" data-action="import">Importer une sauvegarde</button></div></section>`;
  h += `<section class="set-sec"><div class="set-h"><h2 class="sec-h">Avec Claude</h2></div><p class="prose">Dans n’importe quelle conversation Claude, dicte « Note : … » : Claude la résume, propose un classement et la dépose dans « À trier ». Tu peux aussi demander « Ajoute dans Regia le rendu du projet final le 15 décembre » ou « Mets ce compte-rendu dans la réunion du 5 novembre ». Chaque lundi, Claude corrige tes exercices, prépare ceux de la semaine et propose des cibles LinkedIn. Touche Synchroniser pour voir tout cela ici.</p></section>`;
  el.innerHTML = h;
}
view('reglages', {
  label: 'Réglages',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M19 7h1M4 17h3M13 17h7"/><circle cx="16" cy="7" r="2.4"/><circle cx="10" cy="17" r="2.4"/></svg>',
  shell: () => `<div class="v-head"><h1><span class="hl">Réglages</span></h1><p class="v-sub">Synchronisation, domaines, onglets, comptes, modèles et sauvegarde</p></div><div id="v-set"></div>`,
  render: renderSettings
});

/* ---- Actions ---- */
action('toggle-onglet', a => guarded(async () => {
  const g = clone(rg('general')) || {}, mm = Array.isArray(g.ongletsMasques) ? g.ongletsMasques.slice() : [], id = a.dataset.id, i = mm.indexOf(id);
  if (i >= 0) mm.splice(i, 1); else mm.push(id);
  await put('reglages', 'general', Object.assign(clean(g), { ongletsMasques: mm }));
  toast(i >= 0 ? 'Onglet affiché' : 'Onglet masqué');
}));
async function saveComptes(fn) {
  const L = comptes().map(c => ({ id: c.id, rythme: c.rythme, pause: c.pause }));
  fn(L); await put('reglages', 'comptes', { liste: L });
}
action('compte-pause', a => guarded(async () => { await saveComptes(L => { const c = L.find(x => x.id === a.dataset.id); if (c) c.pause = !c.pause; }); toast('Enregistré'); }));
onChange('@rythme', el => guarded(async () => { const v = Math.max(0, Math.min(14, Math.round(Number(el.value) || 0))); await saveComptes(L => { const c = L.find(x => x.id === el.dataset.id); if (c) c.rythme = v; }); toast('Rythme enregistré'); }));
onChange('@inter', el => guarded(async () => {
  const o = clean(clone(rg('interactions')) || {}), c = el.dataset.compte;
  o[c] = Object.assign({}, o[c] || {}, { [el.dataset.k]: Math.max(0, Math.min(50, Math.round(Number(el.value) || 0))) });
  await put('reglages', 'interactions', o); toast('Objectif enregistré');
}));
action('new-modele', () => openModeleEditor(null));
action('edit-modele', a => openModeleEditor(a.dataset.id));
action('dom-move', a => guarded(async () => {
  const L = domList(true), i = L.findIndex(d => d.id === a.dataset.id), j = i + Number(a.dataset.dir);
  if (i < 0 || j < 0 || j >= L.length) return;
  const order = L.map(d => d.id); const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  for (let k = 0; k < order.length; k++) { const d = get('domaines', order[k]); if (d && d.ordre !== k + 1) await patch('domaines', d.id, { ordre: k + 1 }); }
}));

/* ---- Domaine ---- */
function openDomEditor(id) {
  const d = id ? get('domaines', id) : null;
  const used = domList(true).map(x => x.couleur);
  const draft = d ? clone(d) : { nom: '', couleur: PALETTE.find(k => !used.includes(k)) || 'ardoise', archive: false, ordre: domList(true).length + 1 };
  draft.id = d ? d.id : null;
  openSheet({ kind: 'dom', draft, isNew: !d });
}
function slugId(nom) {
  const s = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'domaine';
  let id = s, i = 2; while (S.data.domaines.has(id)) id = s + '-' + (i++); return id;
}
sheet('dom', {
  render(sh) {
    const d = sh.draft, n = d.id ? tasks().filter(t => t.domaine === d.id).length : 0;
    let h = head(sh.isNew ? 'Nouveau domaine' : 'Domaine') + '<div class="sheet-body">';
    h += `<label class="fld"><span class="fld-l">Nom</span><input id="d-nom" data-field="nom" value="${esc(d.nom)}"${sh.isNew ? ' data-autofocus' : ''}></label>`;
    h += `<div class="fld"><span class="fld-l">Couleur</span><div class="swatches">${PALETTE.map(k => `<button type="button" class="sw" data-action="set-field" data-field="couleur" data-value="${k}" aria-pressed="${d.couleur === k}" aria-label="${PALETTE_NOMS[k]}" title="${PALETTE_NOMS[k]}" style="--c:var(--d-${k})"></button>`).join('')}</div></div>`;
    h += `<div class="checks"><label class="ck"><input id="d-arch" type="checkbox" data-field="archive"${d.archive ? ' checked' : ''}>Archiver (masqué d’« Aujourd’hui » et du Planning)</label></div>`;
    if (!sh.isNew) h += `<p class="hint">${n} tâche${n > 1 ? 's' : ''} dans ce domaine.${n ? ' Pour le supprimer, déplace ou supprime d’abord ses tâches, ou archive-le.' : ''}</p>`;
    return h + '</div>' + foot(!sh.isNew && n === 0);
  },
  async save(sh) {
    const d = sh.draft, nom = String(d.nom || '').trim();
    if (!nom) throw { code: 'form', message: 'Donne un nom au domaine.' };
    await put('domaines', d.id || slugId(nom), { nom, couleur: PALETTE.includes(d.couleur) ? d.couleur : 'ardoise', archive: !!d.archive, ordre: Number(d.ordre) || domList(true).length + 1 });
  },
  del: sh => remove('domaines', sh.draft.id)
});
action('new-dom', () => openDomEditor(null));
action('edit-dom', a => openDomEditor(a.dataset.id));

/* ---- Sauvegarde ---- */
function collect() {
  const out = { app: APP.nom, version: 2, exporteLe: new Date().toISOString() };
  for (const c of COLLS) out[c] = list(c).map(v => Object.assign({}, v));
  return out;
}
action('export', async () => {
  const r = await saveFile('Sauvegarde Regia_' + stamp(S.today) + '.json', new Blob([JSON.stringify(collect(), null, 2)], { type: 'application/json' }));
  if (r === 'saved') toast('Sauvegarde téléchargée');
});
action('import', () => { const f = $('#import-file'); if (f) f.click(); });
export async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast('Fichier illisible : choisis une sauvegarde .json de Regia ou du Planning.', 'err'); return; }
  if (!data || typeof data !== 'object') { toast('Fichier illisible.', 'err'); return; }
  await guarded(async () => {
    let n = 0;
    for (const c of COLLS) {
      const v = data[c];
      if (c === 'reglages' && v && !Array.isArray(v) && typeof v === 'object') { await LocalDB.local('reglages', 'general', clean(v), false); n++; continue; } // ancien format
      for (const d of (Array.isArray(v) ? v : [])) { if (!d || d.id == null) continue; await LocalDB.local(c, String(d.id), clean(d), false); n++; }
    }
    toast(n + ' fiche' + (n > 1 ? 's' : '') + ' importée' + (n > 1 ? 's' : '') + '. Synchronise pour les envoyer à tes autres appareils.');
  });
}
