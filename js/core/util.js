/* Petits outils partagés. */

export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
export function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
/* Retire l'identifiant et les champs techniques (préfixés « _ ») avant enregistrement */
export function clean(o) { const r = {}; for (const k of Object.keys(o || {})) { if (k === 'id' || k.charAt(0) === '_') continue; if (o[k] !== undefined) r[k] = o[k]; } return r; }
export function opts(list, cur) { return list.map(([k, l]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(l)}</option>`).join(''); }
export function newId(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export function plural(n, one, many) { return n + ' ' + (n > 1 ? (many || one + 's') : one); }
export function isUrl(s) { return /^https?:\/\/\S+$/i.test(String(s || '').trim()); }

const S_ = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
export const ICON = {
  close: `<svg ${S_} stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  up: `<svg ${S_} stroke-width="2"><path d="M6 14l6-6 6 6"/></svg>`,
  down: `<svg ${S_} stroke-width="2"><path d="M6 10l6 6 6-6"/></svg>`,
  left: `<svg ${S_} stroke-width="2"><path d="M14 6l-6 6 6 6"/></svg>`,
  right: `<svg ${S_} stroke-width="2"><path d="M10 6l6 6-6 6"/></svg>`,
  ext: `<svg ${S_} stroke-width="2"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
  plus: `<svg ${S_} stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
  minus: `<svg ${S_} stroke-width="2"><path d="M5 12h14"/></svg>`,
  copy: `<svg ${S_} stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>`,
  arrow: `<svg ${S_} stroke-width="2"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`,
  cal: `<svg ${S_} stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>`,
  more: `<svg ${S_} stroke-width="2.2"><circle cx="5.5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="18.5" cy="12" r=".8"/></svg>`
};

let toastT = 0;
/* Appelé à chaque message (sert à nommer l'action annulable) */
export const toastHook = { fn: null };
export function toast(msg, kind) {
  const el = $('#toast'); if (!el) return;
  if (toastHook.fn) try { toastHook.fn(msg, kind); } catch (e) { }
  el.textContent = msg; el.className = 'toast' + (kind === 'err' ? ' err' : ''); el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, kind === 'err' ? 5000 : 2600);
}

/* Liens repérés dans un texte : le texte qui précède l'adresse sur la même ligne sert d'intitulé. */
export function textLinks(txt, known) {
  const out = [];
  for (const line of String(txt || '').split('\n')) {
    const re = /https?:\/\/[^\s)]+/g; let m, last = 0;
    while ((m = re.exec(line))) {
      const before = line.slice(last, m.index).replace(/[\s:]+$/, '').trim();
      let label = before;
      if (!label || label.length > 70) {
        const k = (known || []).find(l => l.url === m[0]);
        try { label = k ? k.nom : new URL(m[0]).hostname.replace(/^www\./, ''); } catch (e) { label = 'Lien'; }
      }
      out.push({ u: m[0], l: label }); last = re.lastIndex;
    }
  }
  return out;
}
export function linksHTML(txt, boxId, known) {
  const L = textLinks(txt, known);
  return `<div class="notes-links" id="${boxId}">${L.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.l)} ${ICON.ext}</a>`).join('')}</div>`;
}

/* Texte enrichi minimal : paragraphes, listes « - », **gras**, liens. */
export function rich(txt) {
  const lines = String(txt || '').replace(/\r/g, '').split('\n');
  const inline = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(https?:\/\/[^\s)<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  let h = '', ul = false, para = [];
  const flush = () => { if (para.length) { h += `<p>${para.map(inline).join('<br>')}</p>`; para = []; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    const m = /^\s*[-•]\s+(.*)$/.exec(l);
    if (m) { flush(); if (!ul) { h += '<ul>'; ul = true; } h += `<li>${inline(m[1])}</li>`; continue; }
    if (ul) { h += '</ul>'; ul = false; }
    if (!l.trim()) { flush(); continue; }
    para.push(l);
  }
  flush(); if (ul) h += '</ul>';
  return h;
}

export async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Copié'); return true; }
  catch (e) { toast('Copie impossible ici : sélectionne le texte à la main.', 'err'); return false; }
}
