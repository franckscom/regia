/* Dates : chaînes AAAA-MM-JJ en heure locale. */

export function pad(n) { return String(n).padStart(2, '0'); }
export function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
export function isTime(s) { return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s); }
export function parseD(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
export function addDays(s, n) { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); }
export function addMonths(s, n) {
  const d = parseD(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return ymd(d);
}
export function diff(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }
export function mondayOf(s) { const d = parseD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }
function isoParts(s) {
  const d = parseD(s); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { y: t.getUTCFullYear(), w: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
}
export function isoWeek(s) { return isoParts(s).w; }
/* Clé de semaine : 2026-W45 */
export function weekKey(s) { const p = isoParts(s); return p.y + '-W' + pad(p.w); }

export const F_SHORT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
export const F_LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
export const F_MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
export const F_WD = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
export const F_DM = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
export const F_DAYM = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
export function fShort(s) { return F_SHORT.format(parseD(s)); }
export function fDayM(s) { return F_DAYM.format(parseD(s)); }
export function fFull(s) { const d = parseD(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
export function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
/* Suffixe de nom de fichier : 31.10.26 */
export function stamp(s) { const d = parseD(s); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2); }
export function hm(ms) { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
export function dayOfMs(ms) { return ymd(new Date(ms)); }
/* Date et heure locales vers millisecondes */
export function localMs(date, time) {
  const [y, m, d] = date.split('-').map(Number); const [h, mi] = (isTime(time) ? time : '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, h, mi, 0).getTime();
}
/* Semaine lisible : « 2 – 8 nov. » sans tiret long */
export function weekLabel(monday) { const sun = addDays(monday, 6); return fDayM(monday) + ' au ' + fDayM(sun); }
