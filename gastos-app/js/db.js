'use strict';
/* Armazenamento local (IndexedDB) e backup. Só guarda movimentos e valores iniciais. */
const DB = (() => {
  const NOME = 'gastos-app', VERSAO_DB = 1;
  const FORMATO = 'gastos-app-backup', VERSAO_BACKUP = 1;
  const LISTAS = ['movements', 'categories', 'recurrences', 'periods', 'goals'];
  const STORES = ['settings'].concat(LISTAS);
  let aberta = null;

  function abrir() {
    if (!aberta) aberta = new Promise((ok, erro) => {
      const r = indexedDB.open(NOME, VERSAO_DB);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('settings');
        LISTAS.forEach(s => d.createObjectStore(s, { keyPath: 'id', autoIncrement: true }));
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
    });
    return aberta;
  }
  function pedido(store, modo, fn) {
    return abrir().then(d => new Promise((ok, erro) => {
      const req = fn(d.transaction(store, modo).objectStore(store));
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    }));
  }
  const getSettings = () => pedido('settings', 'readonly', s => s.get('main')).then(v => v || null);
  const setSettings = o => pedido('settings', 'readwrite', s => s.put(o, 'main'));

  async function exportAll() {
    const out = { format: FORMATO, version: VERSAO_BACKUP, exportedAt: new Date().toISOString(), settings: await getSettings() };
    for (const k of LISTAS) out[k] = await pedido(k, 'readonly', s => s.getAll());
    return out;
  }

  /** Valida um backup. Devolve {ok, erro} ou {ok, resumo}. */
  function validate(d) {
    const falha = erro => ({ ok: false, erro });
    if (!d || typeof d !== 'object' || d.format !== FORMATO) return falha('O ficheiro não é um backup desta app.');
    if (!Number.isInteger(d.version) || d.version < 1) return falha('O número de versão do backup é inválido.');
    if (d.version > VERSAO_BACKUP) return falha('Este backup foi criado por uma versão mais recente da app.');
    const s = d.settings;
    if (!s || !Number.isSafeInteger(s.initialSavings) || !Number.isSafeInteger(s.initialInvested) || s.initialInvested < 0 ||
        !Util.validISO(s.startDate) || !Number.isInteger(s.backupReminderDays) || s.backupReminderDays < 1 || s.backupReminderDays > 365 ||
        !(s.lastBackup === null || typeof s.lastBackup === 'string'))
      return falha('Os valores iniciais no backup estão em falta ou inválidos.');
    for (const k of LISTAS) {
      if (!Array.isArray(d[k])) return falha('Falta a lista «' + k + '» no backup.');
      if (d[k].some(x => !x || typeof x !== 'object' || !Number.isInteger(x.id))) return falha('A lista «' + k + '» tem registos inválidos.');
    }
    return { ok: true, resumo: { settings: s, movimentos: d.movements.length, categorias: d.categories.length,
      recorrentes: d.recurrences.length, periodos: d.periods.length, metas: d.goals.length, exportadoEm: d.exportedAt } };
  }

  /** Substitui tudo numa só transação: se falhar, os dados atuais ficam intactos. */
  async function importAll(d) {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const t = db.transaction(STORES, 'readwrite');
      STORES.forEach(s => t.objectStore(s).clear());
      t.objectStore('settings').put(d.settings, 'main');
      LISTAS.forEach(k => d[k].forEach(it => t.objectStore(k).put(it)));
      t.oncomplete = () => ok();
      t.onerror = t.onabort = () => erro(t.error || new Error('Importação cancelada.'));
    });
  }
  async function clearAll() {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const t = db.transaction(STORES, 'readwrite');
      STORES.forEach(s => t.objectStore(s).clear());
      t.oncomplete = () => ok();
      t.onerror = t.onabort = () => erro(t.error);
    });
  }
  return { getSettings, setSettings, exportAll, validate, importAll, clearAll };
})();
