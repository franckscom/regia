/* Synchronisation manuelle (bouton « Synchroniser ») avec le script Google du classeur. */
import { APP } from './config.js';
import { LocalDB } from './db.js';
import { S } from './store.js';
import { $, esc, toast } from './util.js';
import { ymd, pad, F_SHORT } from './dates.js';
import { action, onInput, refresh } from './ui.js';

export const SYNC = { busy: false };
export function syncUrl() { return String(LocalDB.meta.url || ''); }
export function fAgo(ms) {
  const d = Date.now() - ms; if (d < 60000) return 'à l’instant'; if (d < 3600000) return 'il y a ' + Math.round(d / 60000) + ' min';
  const dt = new Date(ms); return (ymd(dt) === S.today ? 'aujourd’hui' : F_SHORT.format(dt)) + ' à ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
}
/* Tes événements Google Agenda, tels que reçus à la dernière synchro */
export function agendaCache() { const a = LocalDB.meta.agenda; return (a && Array.isArray(a.evenements)) ? a : null; }
export function scriptOld() { return !!LocalDB.meta.lastSync && !(Number(LocalDB.meta.scriptV) >= APP.scriptMin); }

export function syncInfoText() {
  const n = LocalDB.pend.size, last = LocalDB.meta.lastSync;
  return `Cet appareil : ${LocalDB.meta.device || 'appareil'} · ${n ? n + ' changement' + (n > 1 ? 's' : '') + ' à envoyer' : 'aucun changement en attente'} · dernière synchro : ${last ? fAgo(last) : 'jamais'}`;
}
export function renderSync() {
  const b = $('#sync-btn'); if (!b || !LocalDB.db) return;
  const n = LocalDB.pend.size, cfg = !!syncUrl(), on = navigator.onLine;
  b.dataset.state = SYNC.busy ? 'busy' : (!cfg ? 'setup' : (n ? 'pending' : 'ok'));
  b.dataset.net = on ? 'on' : 'off';
  const badge = $('#sync-n'); if (badge) { badge.hidden = !n; badge.textContent = n > 99 ? '99+' : String(n); }
  const t = (SYNC.busy ? 'Synchronisation en cours…' : (!cfg ? 'Configurer la synchronisation' : (!on ? 'Hors ligne' : 'Synchroniser'))) + (n ? ` · ${n} changement${n > 1 ? 's' : ''} à envoyer` : '') + (cfg && LocalDB.meta.lastSync ? ` · dernière synchro ${fAgo(LocalDB.meta.lastSync)}` : '');
  b.title = t; b.setAttribute('aria-label', t);
  const info = $('#sync-info'); if (info) info.textContent = syncInfoText();
}
export function syncSection() {
  const url = S.syncDraft != null ? S.syncDraft : syncUrl();
  return `<section class="set-sec"><div class="set-h"><h2 class="sec-h">Synchronisation</h2></div><p class="prose">Tes données sont enregistrées sur cet appareil et restent disponibles sans réseau. Le bouton Synchroniser, en haut, envoie tes changements vers ton Google Sheet et récupère ceux de tes autres appareils, les notes que Claude y a déposées et tes prochains rendez-vous Google Agenda. Si une même fiche a été modifiée à deux endroits, la modification la plus récente l’emporte.</p>
  <label class="fld" style="margin-top:12px"><span class="fld-l">Adresse du script Google (elle se termine par /exec)</span><input id="sync-url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(url)}"></label>
  <div class="set-btns"><button type="button" class="btn btn-primary" data-action="sync-save">Enregistrer et synchroniser</button><button type="button" class="btn" data-action="sync-test">Tester la connexion</button></div>
  ${scriptOld() ? '<p class="notice" style="margin-top:12px">Ton script Google est une ancienne version : la création d’événements et l’affichage de l’agenda sont désactivés. Remplace le code par celui du guide, puis Déployer › Gérer les déploiements › Nouvelle version.</p>' : ''}
  <p class="hint" id="sync-info" style="margin-top:10px">${esc(syncInfoText())}</p></section>`;
}
function syncMsg(sent, recu) {
  if (!sent && !recu) return 'Synchronisé : tout est à jour';
  const a = []; if (sent) a.push(sent + ' envoyé' + (sent > 1 ? 's' : '')); if (recu) a.push(recu + ' reçu' + (recu > 1 ? 's' : ''));
  return 'Synchronisé : ' + a.join(', ');
}
async function postSync(url, since, changes) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 60000);
  let res;
  try { res = await fetch(url, { method: 'POST', body: JSON.stringify({ v: 2, since, appareil: LocalDB.meta.device || '', agenda: true, changes }), redirect: 'follow', signal: ctrl.signal }); }
  finally { clearTimeout(t); }
  if (!res.ok) throw { msg: 'Le script Google a répondu par une erreur (' + res.status + '). Vérifie son déploiement.' };
  let out; try { out = await res.json(); } catch (e) { throw { msg: 'Réponse illisible : vérifie l’adresse du script (elle doit se terminer par /exec) et l’accès « Tout le monde ».' }; }
  if (!out || !out.ok) throw { msg: (out && out.erreur) ? 'Script Google : ' + out.erreur : 'Réponse inattendue du script Google.' };
  return out;
}
export async function syncNow(opts) {
  opts = opts || {};
  if (SYNC.busy || !LocalDB.db) return false;
  const url = syncUrl();
  if (!url) { if (S.view !== 'reglages') location.hash = '#reglages'; toast('Colle d’abord l’adresse de ton script Google dans Réglages › Synchronisation.'); return false; }
  if (!navigator.onLine) { toast('Hors ligne : tes changements restent sur cet appareil. Synchronise dès que tu as du réseau.'); return false; }
  SYNC.busy = true; renderSync();
  const sent = new Map(), changes = [];
  for (const p of LocalDB.pend.values()) { sent.set(p.k, p.u); changes.push({ c: p.c, id: p.id, u: p.u, del: !!p.del, data: p.del ? null : p.data }); }
  try {
    const since = Number(LocalDB.meta.lastRev) || 0;
    let out = await postSync(url, since, changes);
    if (Number(out.rev) < since) out = await postSync(url, 0, []); // classeur réinitialisé : tout récupérer
    const extra = { scriptV: Number(out.v) || 1 };
    if (out.agenda && out.agenda.ok) extra.agenda = out.agenda;
    const recu = await LocalDB.applyRemote(Array.isArray(out.changes) ? out.changes : [], sent, out.rev, extra);
    if (!opts.silent) toast(extra.scriptV >= APP.scriptMin ? syncMsg(changes.length, recu) : syncMsg(changes.length, recu) + '. Script Google à mettre à jour (voir Réglages).');
    return true;
  } catch (e) {
    console.warn(e);
    toast(e && e.msg ? e.msg : (e && e.name === 'AbortError' ? 'Le script Google ne répond pas (délai dépassé). Réessaie.' : 'Synchro impossible : vérifie ta connexion et l’adresse du script.'), 'err');
    return false;
  } finally { SYNC.busy = false; renderSync(); refresh(); }
}
function readSyncInput() {
  const v = String(($('#sync-url') || {}).value || '').trim();
  if (!/^https?:\/\/\S+\/exec(\?\S*)?$/.test(v)) { toast('Adresse non reconnue : elle commence par https:// et se termine par /exec.', 'err'); return null; }
  return v.replace(/\?.*$/, '');
}
async function saveSyncUrl() {
  const v = readSyncInput(); if (!v) return;
  const changed = v !== syncUrl();
  await LocalDB.setMeta(changed ? { url: v, lastRev: 0 } : { url: v });
  S.syncDraft = null; renderSync(); refresh();
  await syncNow();
}
async function testSync() {
  const v = readSyncInput(); if (!v) return;
  if (!navigator.onLine) { toast('Hors ligne : impossible de tester maintenant.', 'err'); return; }
  try {
    const res = await fetch(v + '?ping=1', { redirect: 'follow' });
    const out = await res.json();
    if (out && out.ok) toast(`Connexion OK : ${out.fiches} fiche${out.fiches > 1 ? 's' : ''} dans ton Google Sheet` + ((Number(out.v) || 1) < APP.scriptMin ? ' (script à mettre à jour)' : ''));
    else throw 0;
  } catch (e) { toast('Le script ne répond pas : vérifie l’adresse et que l’accès est « Tout le monde ».', 'err'); }
}
action('sync', () => syncNow());
action('sync-save', () => saveSyncUrl());
action('sync-test', () => testSync());
onInput('sync-url', el => { S.syncDraft = el.value; });
