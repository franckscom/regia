/* Démo (adresse terminée par ?demo) : base séparée « regia-demo », vidée et remplie de contenus fictifs
   à chaque ouverture. Aucune synchro : rien ne quitte l'appareil du visiteur et tes vraies données ne sont jamais lues. */
import { APP } from './config.js';
import { LocalDB } from './db.js';
import { toast } from './util.js';
import { ymd, addDays, localMs, weekKey } from './dates.js';
import { action } from './ui.js';

export function demoReset() {
  return new Promise(ok => { try { const r = indexedDB.deleteDatabase(APP.db); r.onsuccess = r.onerror = r.onblocked = () => ok(); } catch (e) { ok(); } });
}

const T0 = { statut: 'a_faire', priorite: 'normale', echeance: null, debut: null, aConfirmer: false, jalon: false, recurrence: 'aucune', notes: '', parentId: null, offset: null, faitLe: null };

function donnees() {
  const t = ymd(new Date()), D = n => addDays(t, n), sem = weekKey(t);
  const R = [];
  const add = (c, id, data) => R.push([c, id, data]);

  /* Domaines */
  [['univ', 'Université', 'prune', 1], ['candid', 'Candidatures', 'orange', 2], ['franckscom', 'Franckscom', 'lagon', 3], ['linkedin', 'LinkedIn perso', 'encre', 4], ['asso', 'Association', 'sapin', 5], ['admin', 'Admin', 'ardoise', 6], ['perso', 'Perso', 'ocre', 7]]
    .forEach(([id, nom, couleur, ordre]) => add('domaines', id, { nom, couleur, ordre, archive: false }));

  /* Tâches */
  const T = (id, o) => add('taches', id, Object.assign({}, T0, { creeLe: D(-10) }, o));
  T('d-rapport', { titre: 'Rapport de stage : relire l’introduction', domaine: 'univ', echeance: t, priorite: 'haute' });
  T('d-relance', { titre: 'Relancer la galerie Lumen (candidature)', domaine: 'candid', echeance: D(-1) });
  T('d-audit', { titre: 'Audit offert : préparer la grille pour la cave Valmont', domaine: 'franckscom', echeance: t, statut: 'en_cours' });
  T('d-facture', { titre: 'Envoyer l’attestation à la mutuelle', domaine: 'admin', echeance: D(-2), notes: 'Formulaire en ligne, rubrique « Mes démarches ».' });
  T('d-courses', { titre: 'Faire le ménage', domaine: 'perso', echeance: D(2), recurrence: 'hebdo', notes: 'De préférence le matin.' });
  T('d-kpi', { titre: 'Relevé mensuel des statistiques de la page', domaine: 'asso', echeance: D(5), recurrence: 'mensuel' });
  T('d-demain', { titre: 'Appeler la cave Valmont pour fixer le rendez-vous', domaine: 'franckscom', echeance: D(1) });
  T('d-demain2', { titre: 'Imprimer le dossier de candidature', domaine: 'candid', echeance: D(1) });
  T('d-site', { titre: 'Landing page : rédiger la section « Méthode »', domaine: 'franckscom', echeance: D(3) });
  T('d-mentions', { titre: 'Landing page : mentions légales', domaine: 'franckscom', aConfirmer: true });
  T('d-substack', { titre: 'Article Substack n° 2', domaine: 'franckscom', echeance: D(9), notes: 'Un article toutes les deux semaines, le même jour.' });
  T('d-vieux', { titre: 'Créer le compte GitHub', domaine: 'perso', statut: 'fait', echeance: D(-4), faitLe: D(-4) });
  /* Un projet avec ses étapes calées sur l'échéance (rétroplanning) */
  T('d-pitch', { titre: 'Pitch de fin de semestre', domaine: 'univ', echeance: D(21), jalon: true, statut: 'en_cours', notes: 'Étapes créées à partir du modèle « Présentation orale ».' });
  [['Finaliser le contenu', -21, 'fait'], ['Support prêt', -14, 'a_faire'], ['Répétition', -7, 'a_faire'], ['Dernière relecture', -1, 'a_faire']]
    .forEach(([titre, offset, statut], i) => T('d-pitch-' + i, { titre, domaine: 'univ', parentId: 'd-pitch', offset, statut, faitLe: statut === 'fait' ? D(-1) : null }));
  T('d-salon', { titre: 'Forum des métiers de la communication', domaine: 'asso', echeance: D(12), jalon: true, priorite: 'haute' });
  [['Démarcher les sponsors', -10], ['Envoyer le communiqué', -5], ['Remercier et partager le bilan', 3]]
    .forEach(([titre, offset], i) => T('d-salon-' + i, { titre, domaine: 'asso', parentId: 'd-salon', offset }));

  /* Modèles de rétroplanning */
  add('modeles', 'oral', { nom: 'Présentation orale', etapes: [{ offset: -21, titre: 'Finaliser le contenu' }, { offset: -14, titre: 'Support prêt' }, { offset: -7, titre: 'Répétition' }, { offset: -1, titre: 'Dernière relecture' }] });
  add('modeles', 'post', { nom: 'Post LinkedIn', etapes: [{ offset: -6, titre: 'Rédiger le texte' }, { offset: -5, titre: 'Préparer le visuel' }, { offset: -1, titre: 'Programmer la publication' }] });

  /* Notes dictées à Claude, à trier, et carnet */
  add('notes', 'n-d1', { titre: 'Demander l’attestation de stage au secrétariat', resume: 'Demander au secrétariat l’attestation de stage avant vendredi.', texte: 'Il faut que je demande l’attestation de stage au secrétariat, avant vendredi.', liens: '', categories: ['stage'], statut: 'a_trier', source: 'claude', creeLe: t + 'T08:40', proposition: { action: 'tache', date: D(3), domaine: 'univ' } });
  add('notes', 'n-d2', { titre: 'Café avec Léa, responsable com d’un musée', resume: 'Rendez-vous jeudi à 10 h au café du musée pour parler du stage.', texte: 'Café avec Léa jeudi à 10 h, au café du musée, pour parler d’un stage.', liens: '', categories: [], statut: 'a_trier', source: 'claude', creeLe: t + 'T09:05', proposition: { action: 'evenement', date: D(2), heure: '10:00', duree: 60, lieu: 'Café du musée', reunion: true, type: 'rdv' } });
  add('notes', 'n-d3', { titre: 'Idée de service : diagnostic express de la page LinkedIn d’une PME', resume: 'Un audit court de la page LinkedIn d’une PME, livré en une page, comme porte d’entrée.', texte: 'Idée : proposer un diagnostic express de la page LinkedIn des PME, une page de constats, comme porte d’entrée vers l’audit complet.', liens: '', categories: ['franckscom'], statut: 'a_trier', source: 'claude', creeLe: D(-1) + 'T18:20', proposition: { action: 'idee', genre: 'service' } });
  add('notes', 'n-d4', { titre: 'Musée imaginaire de Toulouse', resume: 'Organisation à suivre sur LinkedIn : publie souvent sur la médiation.', texte: '', liens: 'https://example.com', categories: [], statut: 'rangee', type: 'veille', genre: 'organisation', suivi: 'a_approfondir', lien: 'https://example.com', source: 'app', creeLe: D(-6) + 'T12:00' });
  add('notes', 'n-d5', { titre: 'Le récit avant la langue', resume: 'À l’export, le problème est souvent le récit de marque, pas la traduction.', texte: '', liens: '', categories: ['franckscom'], statut: 'rangee', type: 'idee', genre: 'reflexion', source: 'app', creeLe: D(-8) + 'T21:00' });

  add('notes', 'n-d6', { titre: 'Bourdieu, La Distinction (1979)', resume: 'Le capital culturel explique pourquoi la visite de musée paraît naturelle aux uns et intimidante aux autres.', texte: '', liens: '', categories: ['culture'], statut: 'rangee', type: 'note', source: 'app', creeLe: D(-4) + 'T20:00' });
  add('notes', 'n-d7', { titre: 'Chiffres de l’export des PME en Occitanie', resume: 'Chercher la part des PME exportatrices et les secteurs les plus actifs.', texte: '', liens: '', categories: ['franckscom'], statut: 'rangee', type: 'recherche', source: 'app', creeLe: D(-2) + 'T10:00' });
  /* Réunions */
  add('reunions', 'r-d1', { titre: 'Point d’étape projet de groupe', date: D(-3), heure: '14:00', type: 'visio', lieu: '', avec: 'Équipe projet', categories: ['m2'], compteRendu: 'RÉSUMÉ\nLe plan est validé. Chacun prend une partie.\n\nACTIONS\n• Moi : rédiger la partie stratégie\n• Équipe : relecture croisée la semaine prochaine', liens: '', creeLe: D(-3), modifieLe: D(-3) });
  add('reunions', 'r-d2', { titre: 'Rencontre avec la cave Valmont', date: D(4), heure: '10:30', type: 'presentiel', lieu: 'Domaine Valmont', avec: 'Gérante de la cave', categories: ['franckscom'], compteRendu: '', liens: '', creeLe: D(-1), modifieLe: D(-1) });

  /* Calendrier éditorial */
  add('contenus', 'c-d1', { titre: 'Post : ce que 20 ans de visites guidées m’ont appris sur les publics', compte: 'li-franck', etape: 'pret', format: 'post', datePub: D(1), notes: '', lien: '', creeLe: D(-5) });
  add('contenus', 'c-d2', { titre: 'Carrousel : 5 erreurs de com à l’export', compte: 'li-franck', etape: 'redaction', format: 'carrousel', datePub: D(8), notes: '', lien: '', creeLe: D(-2) });
  add('contenus', 'c-d3', { titre: 'Annonce du forum des métiers', compte: 'li-takeoff', etape: 'visuel', format: 'post', datePub: D(4), notes: '', lien: '', creeLe: D(-3) });
  add('contenus', 'c-d4', { titre: 'Portrait d’une ancienne étudiante', compte: 'li-takeoff', etape: 'idee', format: 'post', datePub: null, notes: '', lien: '', creeLe: D(-1) });
  add('contenus', 'c-d5', { titre: 'Post publié la semaine dernière', compte: 'li-franck', etape: 'publie', format: 'post', datePub: D(-6), notes: '', lien: '', creeLe: D(-12) });
  add('interactions', t, { franck: { likes: 3, commentaires: 1, relations: 1 }, takeoff: { likes: 2 } });
  add('interactions', D(-1), { franck: { likes: 5, commentaires: 2, relations: 3 }, takeoff: { likes: 3, commentaires: 1, invitations: 5 } });

  /* Cibles LinkedIn de la semaine */
  [['franck', 'page', 'Une agence régionale d’export', 'Réseau d’accompagnement des PME exportatrices.', 'Suivre la page et commenter une réussite export.'],
   ['franck', 'relation', 'Responsables des publics de musées', 'Profil type à inviter cette semaine.', 'Bonjour, je travaille sur le développement des publics culturels : ravi d’échanger.'],
   ['takeoff', 'page', 'Offices de tourisme de la région', 'Partenaires possibles pour des projets étudiants.', 'Suivre la page et commenter avec une idée concrète.']]
    .forEach(([compte, type, nom, pourquoi, message], i) => add('suggestions', 's-demo-' + i, { semaine: sem, compte, type, nom, pourquoi, lien: 'https://www.linkedin.com', message, fait: i === 0 }));

  /* Exercices du jour et des jours suivants */
  const EX = {
    en: ['vocabulaire', 'Audience development vocabulary', 'Fill each gap with the right term: footfall, outreach, earned media.', 'Last year the museum’s (1) ___ dropped. The team launched an (2) ___ programme and secured (3) ___ through press coverage.', '1 footfall · 2 outreach · 3 earned media.'],
    it: ['situation', 'Rispondere a un buyer in fiera', 'Un buyer ti chiede che cosa distingue la tua azienda. Rispondi in 4 frasi con un dato concreto e una proposta di seguito.', 'Dati fittizi: cantina di famiglia, 40 ettari, biologico certificato.', 'Esempio: «Siamo una cantina di famiglia… Le faccio avere una campionatura la settimana prossima?»'],
    fr: ['reecriture', 'Désadministrer un paragraphe', 'Réécris ce paragraphe en style communicant, 40 mots au plus.', 'Il est porté à la connaissance des adhérents qu’une réunion d’information se tiendra jeudi à 18 heures.', '« Réunion d’information jeudi à 18 h : venez nombreux ! »']
  };
  for (let i = 0; i < 3; i++) for (const lg of ['en', 'it', 'fr']) {
    const [format, titre, consigne, contexte, corrige] = EX[lg];
    add('exercices', `x-demo-${i}-${lg}`, { date: D(i), langue: lg, format, titre: titre + (i ? ' (' + (i + 1) + ')' : ''), consigne, contexte, corrige, duree: 5, semaine: weekKey(D(i)) });
  }

  /* Réglages : liens fictifs, rythmes */
  add('reglages', 'general', { delaiRelance: 7, ongletsMasques: [], liens: [
    { nom: 'Suivi des candidatures', desc: 'Exemple de lien vers un outil externe', url: 'https://example.com', raccourci: true },
    { nom: 'Modèles de messages', desc: 'Exemple de lien', url: 'https://example.com' }] });
  add('reglages', 'comptes', { liste: [{ id: 'li-franck', rythme: 1, pause: false }, { id: 'li-takeoff', rythme: 2, pause: false }] });

  /* Agenda Google fictif (aujourd'hui et demain) */
  const ev = (d, h1, h2, titre, lieu) => ({ titre, lieu: lieu || '', journee: false, debut: localMs(d, h1), fin: localMs(d, h2) });
  const agenda = { maj: Date.now(), evenements: [ev(t, '09:00', '10:30', 'Cours de stratégie de marque', 'Amphi B'), ev(t, '15:00', '15:30', 'Appel découverte avec une PME', 'Visio'), ev(D(1), '11:00', '12:00', 'Réunion de l’association')] };
  return { R, agenda };
}

export async function demoSeed() {
  const { R, agenda } = donnees();
  const now = Date.now(), tx = LocalDB.db.transaction(['records', 'meta'], 'readwrite'), st = tx.objectStore('records'), cols = new Set();
  R.forEach(([c, id, data], i) => { const r = { k: c + '/' + id, c, id: String(id), u: now - 1000 + i, del: false, data }; LocalDB.rec.set(r.k, r); st.put(r); cols.add(c); });
  const meta = { agenda, lastSync: now, scriptV: APP.scriptMin, device: 'Démo' };
  for (const k of Object.keys(meta)) tx.objectStore('meta').put({ key: k, value: meta[k] });
  Object.assign(LocalDB.meta, meta);
  await new Promise((ok, ko) => { tx.oncomplete = ok; tx.onerror = () => ko(tx.error); });
  document.documentElement.classList.add('demo');
  if (!document.getElementById('demo-bar')) document.body.insertAdjacentHTML('afterbegin', '<div class="demo-bar" id="demo-bar" role="note"><b>Démo</b> Contenus fictifs. Essaie tout : tes changements restent sur ton appareil et s’effacent quand tu recharges la page.</div>');
}

/* En démo, pas de synchro ni d'adresse de script */
if (/[?&]demo(=|&|$)/.test(location.search)) {
  const off = () => toast('Démo : la synchronisation est désactivée.');
  ['sync', 'sync-save', 'sync-test'].forEach(a => action(a, off));
}
