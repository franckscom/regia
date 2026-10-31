/* Fichiers enregistrés sur l'appareil : export Excel, sauvegarde. */
import { XLSX_URL } from './config.js';

export async function saveFile(name, blob) {
  let file = null; try { file = new File([blob], name, { type: blob.type }); } catch (e) { file = null; }
  const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (file && touch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'saved';
}

/* Bibliothèque Excel chargée seulement au premier export (elle est en cache pour le hors ligne) */
let xlsxP = null;
export function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxP) xlsxP = new Promise((ok, ko) => {
    const sc = document.createElement('script'); sc.src = XLSX_URL;
    sc.onload = () => window.XLSX ? ok(window.XLSX) : ko(new Error('xlsx'));
    sc.onerror = () => { xlsxP = null; ko(new Error('xlsx')); };
    document.head.appendChild(sc);
  });
  return xlsxP;
}
export async function xlsxFile(sheetName, rows, cols) {
  const X = await loadXLSX();
  const ws = X.utils.json_to_sheet(rows);
  if (cols) ws['!cols'] = cols.map(w => ({ wch: w }));
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, sheetName);
  const buf = X.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
