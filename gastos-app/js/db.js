'use strict';
/* Armazenamento local (IndexedDB) e backup. Só guarda movimentos, descrições dos dias, categorias e valores iniciais. */
const DB = (() => {
  const NOME = 'gastos-app', VERSAO_DB = 2;
  const FORMATO = 'gastos-app-backup', VERSAO_BACKUP = 3;
  const LISTAS = ['movements', 'categories', 'recurrences', 'periods', 'goals'];   // registos com id automático
  const STORES = ['settings', 'days'].concat(LISTAS);                              // 'days' usa a data como chave
  let aberta = null;

  const ouv = { bloqueado: null, libertado: null, novaVersao: null };
  /** Avisos para a interface: outra janela com versão antiga bloqueia a atualização da base de dados. */
  const aoBloquear = f => { ouv.bloqueado = f; };
  const aoLibertar = f => { ouv.libertado = f; };
  const aoNovaVersao = f => { ouv.novaVersao = f; };

  function abrir() {
    if (!aberta) aberta = new Promise((ok, erro) => {
      const r = indexedDB.open(NOME, VERSAO_DB);
      r.onupgradeneeded = () => {
        const d = r.result, tem = n => d.objectStoreNames.contains(n);
        if (!tem('settings')) d.createObjectStore('settings');
        if (!tem('days')) d.createObjectStore('days', { keyPath: 'date' });
        LISTAS.forEach(s => { if (!tem(s)) d.createObjectStore(s, { keyPath: 'id', autoIncrement: true }); });
      };
      // Outra janela (por exemplo a app instalada, com a versão antiga) ainda usa a base de dados: avisa em vez de ficar parado.
      r.onblocked = () => { if (ouv.bloqueado) ouv.bloqueado(); };
      r.onsuccess = () => {
        const d = r.result;
        // Se outra janela precisar de atualizar a base de dados, esta larga-a para não a bloquear.
        d.onversionchange = () => { d.close(); aberta = null; if (ouv.novaVersao) ouv.novaVersao(); };
        if (ouv.libertado) ouv.libertado();
        ok(d);
      };
      r.onerror = () => { aberta = null; erro(r.error); };
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
  const all = store => pedido(store, 'readonly', s => s.getAll());
  const put = (store, obj) => pedido(store, 'readwrite', s => s.put(obj));   // devolve a chave
  const del = (store, chave) => pedido(store, 'readwrite', s => s.delete(chave));

  async function exportAll() {
    const out = { format: FORMATO, version: VERSAO_BACKUP, exportedAt: new Date().toISOString(), settings: await getSettings() };
    out.days = await all('days');
    for (const k of LISTAS) out[k] = await all(k);
    return out;
  }

  /** Valida um backup. Devolve {ok:false, erro} ou {ok:true, resumo}. Aceita backups da versão 1 (sem 'days'). */
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
    if (d.movements.some(m => !Util.validISO(m.date) || !['ganho', 'gasto', 'investimento', 'ajuste'].includes(m.type) || !Number.isSafeInteger(m.cents)))
      return falha('Há movimentos inválidos no backup.');
    if (d.recurrences.some(r => !Number.isSafeInteger(r.cents) || r.cents <= 0 || !Number.isInteger(r.weekday) || r.weekday < 0 || r.weekday > 6 ||
        !Util.validISO(r.startDate) || (r.endDate != null && !Util.validISO(r.endDate)) || typeof r.active !== 'boolean'))
      return falha('Há investimentos recorrentes inválidos no backup.');
    if (d.goals.some(g => !['poupanca', 'investimento'].includes(g.kind) || !Number.isSafeInteger(g.targetCents) || g.targetCents <= 0 || (g.date != null && !Util.validISO(g.date))))
      return falha('Há metas inválidas no backup.');
    if (d.periods.some(p => typeof p.name !== 'string' || !p.name.trim() || !Util.validISO(p.start) || !Util.validISO(p.end) || p.end < p.start))
      return falha('Há períodos inválidos no backup.');
    for (let i = 0; i < d.periods.length; i++) for (let j = i + 1; j < d.periods.length; j++)
      if (Calc.sobrepoe(d.periods[i], d.periods[j])) return falha('Há períodos que se sobrepõem no backup.');
    if (d.days === undefined) d.days = [];
    if (!Array.isArray(d.days) || d.days.some(x => !x || !Util.validISO(x.date) || typeof x.text !== 'string')) return falha('As descrições dos dias no backup são inválidas.');
    return { ok: true, resumo: { settings: s, movimentos: d.movements.length, dias: d.days.length, categorias: d.categories.length,
      recorrentes: d.recurrences.length, periodos: d.periods.length, metas: d.goals.length, exportadoEm: d.exportedAt } };
  }

  /** Substitui tudo numa só transação: se falhar, os dados atuais ficam intactos. */
  async function importAll(d) {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const t = db.transaction(STORES, 'readwrite');
      STORES.forEach(s => t.objectStore(s).clear());
      t.objectStore('settings').put(d.settings, 'main');
      d.days.forEach(x => t.objectStore('days').put(x));
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
  /** Cria os investimentos das regras semanais ativas que ainda faltam, até `hoje`. Tudo numa só transação:
      se duas janelas abrirem ao mesmo tempo, nunca há duplicados. Devolve quantos criou. */
  async function gerarRecorrentes(hoje) {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const t = db.transaction(['recurrences', 'movements'], 'readwrite'); let criados = 0;
      const rq = t.objectStore('recurrences').getAll();
      rq.onsuccess = () => {
        const mq = t.objectStore('movements').getAll();
        mq.onsuccess = () => {
          const r = Calc.gerarRecorrentes(rq.result, mq.result, hoje);
          r.novos.forEach(m => t.objectStore('movements').put(m));
          r.recs.forEach(x => t.objectStore('recurrences').put(x));
          criados = r.novos.length;
        };
      };
      t.oncomplete = () => ok(criados);
      t.onerror = t.onabort = () => erro(t.error || new Error('Operação cancelada.'));
    });
  }
  /** Apaga uma categoria; os movimentos que a usavam ficam «Sem categoria». Devolve os ids afetados (para desfazer). */
  async function apagarCategoria(id) {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const t = db.transaction(['categories', 'movements'], 'readwrite'), afetados = [];
      const mq = t.objectStore('movements').getAll();
      mq.onsuccess = () => {
        mq.result.forEach(m => { if (m.categoryId === id) { afetados.push(m.id); t.objectStore('movements').put({ ...m, categoryId: null }); } });
        t.objectStore('categories').delete(id);
      };
      t.oncomplete = () => ok(afetados);
      t.onerror = t.onabort = () => erro(t.error || new Error('Operação cancelada.'));
    });
  }
  async function restaurarCategoria(cat, ids) {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const t = db.transaction(['categories', 'movements'], 'readwrite');
      t.objectStore('categories').put(cat);
      const mq = t.objectStore('movements').getAll();
      mq.onsuccess = () => mq.result.forEach(m => { if (ids.includes(m.id)) t.objectStore('movements').put({ ...m, categoryId: cat.id }); });
      t.oncomplete = () => ok();
      t.onerror = t.onabort = () => erro(t.error || new Error('Operação cancelada.'));
    });
  }
  return { gerarRecorrentes, apagarCategoria, restaurarCategoria, getSettings, setSettings, all, put, del, exportAll, validate, importAll, clearAll, aoBloquear, aoLibertar, aoNovaVersao };
})();
