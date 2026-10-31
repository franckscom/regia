/* Regia : libellés et listes. Pour changer un libellé ou une valeur par défaut, c'est ici. */

export const APP = { nom: 'Regia', db: 'regia', uiKey: 'regia-ui-v1', scriptMin: 2 };

/* Collections de données (une ligne du Google Sheet = une fiche d'une collection) */
export const COLLS = ['domaines', 'taches', 'modeles', 'reunions', 'reglages', 'notes', 'agenda', 'contenus', 'exercices', 'reponses', 'suggestions', 'interactions'];

export const PALETTE = ['encre', 'sapin', 'prune', 'orange', 'framboise', 'lagon', 'ocre', 'ardoise'];
export const PALETTE_NOMS = { encre: 'Encre', sapin: 'Sapin', prune: 'Prune', orange: 'Orange', framboise: 'Framboise', lagon: 'Lagon', ocre: 'Ocre', ardoise: 'Ardoise' };
export const color = k => 'var(--d-' + (PALETTE.includes(k) ? k : 'ardoise') + ')';

/* Tâches */
export const STATUTS = [['a_faire', 'À faire'], ['en_cours', 'En cours'], ['attente', 'En attente'], ['fait', 'Fait']];
export const PRIORITES = [['haute', 'Haute'], ['normale', 'Normale'], ['basse', 'Basse']];
export const RECURRENCES = [['aucune', 'Aucune'], ['hebdo', 'Chaque semaine'], ['mensuel', 'Chaque mois']];
export const TACHE_DEFAUT = { statut: 'a_faire', priorite: 'normale', echeance: null, debut: null, aConfirmer: false, jalon: false, recurrence: 'aucune', notes: '', parentId: null, offset: null, faitLe: null };
export const DOMAINE_CANDID = 'candid';

/* Catégories partagées (réunions, notes) : clé, libellé, couleur */
export const CATEGORIES = [['takeoff', 'TakeOff!', 'framboise'], ['m2', 'M2', 'encre'], ['stage', 'Stage', 'sapin'], ['franckscom', 'Franckscom', 'prune'], ['demarches', 'Démarches', 'ocre'], ['party', 'Party', 'orange']];
export function catInfo(k) { const c = CATEGORIES.find(x => x[0] === k); return c ? { id: c[0], nom: c[1], c: color(c[2]) } : null; }

/* Réunions */
export const REU_TYPES = [['presentiel', 'Présentiel'], ['visio', 'Visio'], ['entretien', 'Entretien'], ['rdv', 'RDV']];
export const REU_DEFAUT = { titre: '', date: null, heure: '', type: 'presentiel', lieu: '', avec: '', categories: [], compteRendu: '', liens: '' };

/* Candidatures : outils reliés (remplacés par reglages/general.liens s'il existe) */
export const LIENS_DEFAUT = [
  { nom: 'Candidatures 2026-27', desc: 'Cibles, messages, envois et relances du jour', url: 'https://claude.ai/artifact/7j9rT6RG5GWWMrzGrJvB9m', raccourci: true },
  { nom: 'Base d’entreprises Occitanie', desc: 'Les entreprises du Top Économique et leurs responsables', url: 'https://claude.ai/artifact/DptzLkMN3RuxL7i9YBzxyu' },
  { nom: 'Modèles messages et LM', desc: 'Messages d’approche et lettres de motivation', url: 'https://claude.ai/artifact/5vW7Ye5p5hp2Wno72L26zg' },
  { nom: 'Modifications CV1 à CV4', desc: 'Les versions de ton CV', url: 'https://claude.ai/artifact/1FJwMbCW2PduUb1guWp4zw' },
  { nom: 'Mappa competenze', desc: 'Compétences demandées par les offres et ton niveau', url: 'https://claude.ai/artifact/7SiDWYigHcyw8ZWsHZdxpG' }
];

/* Notes */
export const TRI_ACTIONS = [['tache', 'Tâche'], ['evenement', 'Événement'], ['contenu', 'Contenu'], ['note', 'Note'], ['idee', 'Idée'], ['veille', 'Veille']];
export const NOTE_TYPES = [['note', 'Note'], ['idee', 'Idée'], ['veille', 'Veille']];
export const IDEE_GENRES = [['service', 'Idée de service'], ['concept', 'Concept'], ['reflexion', 'Réflexion']];
export const VEILLE_GENRES = [['personne', 'Personne'], ['organisation', 'Organisation'], ['site', 'Site web'], ['app', 'App ou outil'], ['autre', 'Autre']];
export const VEILLE_SUIVI = [['a_approfondir', 'À approfondir'], ['approfondi', 'Approfondi'], ['suivi', 'Suivi sur LinkedIn']];

/* Contenus : plateformes, étapes, comptes */
export const PLATEFORMES = {
  linkedin: { nom: 'LinkedIn', etapes: [['idee', 'Idée'], ['redaction', 'Rédaction'], ['visuel', 'Visuel'], ['pret', 'Prêt'], ['publie', 'Publié']], formats: [['post', 'Post'], ['carrousel', 'Carrousel'], ['article', 'Article'], ['video', 'Vidéo']] },
  youtube: { nom: 'YouTube', etapes: [['idee', 'Idée'], ['script', 'Script'], ['voix', 'Voix off'], ['medias', 'Médias'], ['montage', 'Montage'], ['pret', 'Prêt'], ['publie', 'Publié']], formats: [['video', 'Vidéo'], ['short', 'Short']] }
};
export const COMPTES_DEFAUT = [
  { id: 'li-franck', nom: 'LinkedIn Franck', court: 'Franck', plateforme: 'linkedin', couleur: 'encre', rythme: 1, pause: false },
  { id: 'li-takeoff', nom: 'LinkedIn TakeOff!', court: 'TakeOff!', plateforme: 'linkedin', couleur: 'framboise', rythme: 2, pause: false },
  { id: 'yt-tfh', nom: 'The French Habit', court: 'TFH', plateforme: 'youtube', couleur: 'sapin', rythme: 1, pause: true },
  { id: 'yt-fc', nom: 'Français Connecté', court: 'FC', plateforme: 'youtube', couleur: 'lagon', rythme: 1, pause: true },
  { id: 'yt-iei', nom: 'Impatto & Influenza', court: 'IeI', plateforme: 'youtube', couleur: 'prune', rythme: 1, pause: true },
  { id: 'yt-edr', nom: 'Eje de Recursos', court: 'EdR', plateforme: 'youtube', couleur: 'ocre', rythme: 1, pause: true },
  { id: 'yt-ai', nom: 'Artificial Insight', court: 'AI', plateforme: 'youtube', couleur: 'orange', rythme: 1, pause: true }
];
export const MEDIA_SOURCES = [['banque', 'Banque gratuite'], ['perso', 'Mes images'], ['ia', 'Généré par IA']];
export const BANQUES = [
  { nom: 'Pexels', url: 'https://www.pexels.com' }, { nom: 'Pixabay', url: 'https://pixabay.com' },
  { nom: 'Unsplash', url: 'https://unsplash.com' }, { nom: 'Mixkit', url: 'https://mixkit.co' }
];

/* Interactions LinkedIn : objectifs par jour (modifiables dans les Réglages) */
export const INTER_COMPTES = [
  { id: 'franck', nom: 'LinkedIn Franck', couleur: 'encre', actions: [['likes', 'Likes ciblés', 5], ['commentaires', 'Commentaires utiles', 2], ['relations', 'Demandes de relation', 3]] },
  { id: 'takeoff', nom: 'Page TakeOff!', couleur: 'framboise', actions: [['likes', 'Likes en tant que page', 3], ['commentaires', 'Commentaires en tant que page', 1], ['invitations', 'Invitations à suivre la page', 5]] }
];

/* Exercices */
export const LANGUES = [['en', 'Business English', 'EN'], ['it', 'Italiano degli affari', 'IT'], ['fr', 'Français', 'FR']];
export const FORMATS_EXO = [['vocabulaire', 'Vocabulaire en contexte'], ['reecriture', 'Réécriture'], ['situation', 'Mise en situation'], ['rhetorique', 'Rhétorique et culture G'], ['copywriting', 'Copywriting']];

export const XLSX_URL = 'vendor/xlsx.mini.min.js';
