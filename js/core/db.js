/* Stockage sur l'appareil (IndexedDB). Chaque écriture est datée (u) et mise en attente d'envoi. */
import { APP } from './config.js';
import { clone } from './util.js';

function idbDone(tx) { return new Promise((ok, ko) => { tx.oncomplete = () => ok(); tx.onerror = () => ko(tx.error); tx.onabort = () => ko(tx.error || new Error('abort')); }); }
function idbReq(r) { return new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
function deviceLabel() {
  const ua = navigator.userAgent || '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'PC';
  return 'Appareil';
}

export const LocalDB = {
  db: null, rec: new Map(), pend: new Map(), meta: {}, listeners: new Set(),
  async open() {
    const req = indexedDB.open(APP.db, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('records')) d.createObjectStore('records', { keyPath: 'k' });
      if (!d.objectStoreNames.contains('pending')) d.createObjectStore('pending', { keyPath: 'k' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
    };
    this.db = await idbReq(req);
    const tx = this.db.transaction(['records', 'pending', 'meta']);
    const [recs, pends, metas] = await Promise.all([idbReq(tx.objectStore('records').getAll()), idbReq(tx.objectStore('pending').getAll()), idbReq(tx.objectStore('meta').getAll())]);
    for (const r of recs) this.rec.set(r.k, r);
    for (const p of pends) this.pend.set(p.k, p);
    for (const m of metas) this.meta[m.key] = m.value;
    if (!this.meta.device) await this.setMeta({ device: deviceLabel() });
    return this;
  },
  onChange(fn) { this.listeners.add(fn); },
  emit(cols) { for (const fn of this.listeners) fn(cols); },
  async setMeta(obj) {
    Object.assign(this.meta, obj);
    const tx = this.db.transaction('meta', 'readwrite');
    for (const k of Object.keys(obj)) tx.objectStore('meta').put({ key: k, value: obj[k] });
    await idbDone(tx);
  },
  get(c, id) { const r = this.rec.get(c + '/' + id); return (r && !r.del) ? r.data : null; },
  /* Fiches d'une collection, avec leur identifiant */
  all(c) { const out = []; for (const r of this.rec.values()) if (r.c === c && !r.del) out.push(Object.assign(clone(r.data) || {}, { id: r.id })); return out; },
  async local(c, id, data, del) {
    const k = c + '/' + id, prev = this.rec.get(k);
    const u = Math.max(Date.now(), prev ? prev.u + 1 : 0);
    const r = { k, c, id, u, del: !!del, data: del ? null : data };
    this.rec.set(k, r); this.pend.set(k, r);
    this.emit(new Set([c]));
    const tx = this.db.transaction(['records', 'pending'], 'readwrite');
    tx.objectStore('records').put(r); tx.objectStore('pending').put(r);
    await idbDone(tx);
  },
  /* Applique la réponse du script : pour chaque fiche, la version la plus récente l'emporte. */
  async applyRemote(changes, sent, rev, extraMeta) {
    const touched = new Set(), puts = [], drops = []; let n = 0;
    for (const ch of changes) {
      if (!ch || typeof ch.c !== 'string' || typeof ch.id !== 'string') continue;
      const k = ch.c + '/' + ch.id, loc = this.rec.get(k), u = Number(ch.u) || 0;
      if (loc && loc.u > u) continue; // modification locale plus récente : partira à la prochaine synchro
      if (!loc || u > loc.u) {
        const r = { k, c: ch.c, id: ch.id, u, del: !!ch.del, data: ch.del ? null : (ch.data && typeof ch.data === 'object' ? ch.data : {}) };
        this.rec.set(k, r); puts.push(r); touched.add(ch.c); n++;
      }
      const p = this.pend.get(k); if (p && p.u <= u) { this.pend.delete(k); drops.push(k); }
    }
    for (const [k, u] of sent) { const p = this.pend.get(k); if (p && p.u === u) { this.pend.delete(k); drops.push(k); } }
    const meta = Object.assign({ lastRev: Number(rev) || 0, lastSync: Date.now() }, extraMeta || {});
    Object.assign(this.meta, meta);
    const tx = this.db.transaction(['records', 'pending', 'meta'], 'readwrite');
    const R = tx.objectStore('records'), P = tx.objectStore('pending'), M = tx.objectStore('meta');
    for (const r of puts) R.put(r);
    for (const k of drops) P.delete(k);
    for (const key of Object.keys(meta)) M.put({ key, value: meta[key] });
    await idbDone(tx);
    if (touched.size) this.emit(touched);
    return n;
  }
};
