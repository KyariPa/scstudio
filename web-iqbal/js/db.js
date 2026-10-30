'use strict';
// Penyimpanan lokal berbasis IndexedDB. Semua data hanya ada di browser ini (prototipe).

const DB = (() => {
  const NAMA = 'seleksi-bhayangkara';
  let koneksi;

  function buka() {
    if (!koneksi) {
      koneksi = new Promise((resolve, reject) => {
        const req = indexedDB.open(NAMA, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('users', { keyPath: 'id' });
          db.createObjectStore('codes', { keyPath: 'code' });
          db.createObjectStore('apps', { keyPath: 'userId' });
          db.createObjectStore('files', { keyPath: 'id' });
          db.createObjectStore('kv');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return koneksi;
  }

  async function tx(store, mode, fn) {
    const db = await buka();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  return {
    get: (store, key) => tx(store, 'readonly', s => s.get(key)),
    all: (store) => tx(store, 'readonly', s => s.getAll()),
    put: (store, value, key) => tx(store, 'readwrite', s => (key === undefined ? s.put(value) : s.put(value, key))),
    del: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
    async hapusSemua() {
      const db = await buka();
      db.close();
      koneksi = null;
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(NAMA);
        req.onsuccess = resolve;
        req.onerror = () => reject(req.error);
        req.onblocked = resolve;
      });
    },
  };
})();
