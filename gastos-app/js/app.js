'use strict';
/* Estado partilhado, navegação, categorias, valores iniciais, backup e armazenamento. */
const App = (() => {
  const $ = id => document.getElementById(id);
  const VISTAS = ['Resumo', 'Tabela', 'Dia', 'Def'];
  const CATS_BASE = ['Comida', 'Transportes', 'Experiências', 'Saúde', 'Casa', 'Outros'];
  const padrao = () => ({ initialSavings: 0, initialInvested: 0, startDate: Util.todayISO(), backupReminderDays: 14,
    lastBackup: null, catsSeeded: false, tableFrom: null, tableTo: null });
  /** Estado em memória. Só guardamos movimentos e valores iniciais; o resto calcula-se (ver calc.js). */
  const E = { settings: padrao(), existe: false, movs: [], cats: [], days: [] };
  const ouvintes = [];
  const aoAtualizar = f => ouvintes.push(f);
  const atualizar = () => { ouvintes.forEach(f => f()); desenharDef(); };

  function dizer(texto, ok = true, acao) {
    const m = $('msg'); clearTimeout(dizer.t);
    m.textContent = (ok ? '' : 'Erro: ') + texto; m.className = ok ? 'ok' : 'err';
    if (acao) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = acao.rotulo;
      b.onclick = () => { m.textContent = ''; acao.fn(); }; m.append(' ', b);
      dizer.t = setTimeout(() => { m.textContent = ''; }, 10000);
    }
  }
  function limparErros() { document.querySelectorAll('.erro').forEach(e => e.textContent = ''); }
  function erroCampo(id, t) { $(id).textContent = 'Erro: ' + t; }
  function confirmar(titulo, texto, rotulo) {
    return new Promise(res => {
      const d = $('dlg');
      $('dlgTitle').textContent = titulo; $('dlgText').textContent = texto; $('dlgOk').textContent = rotulo;
      d.returnValue = '';
      d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true });
      d.showModal();
    });
  }
  function ir(v) {
    VISTAS.forEach(x => { $('v' + x).hidden = x !== v; });
    document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-current', b.dataset.v === (v === 'Dia' ? 'Tabela' : v) ? 'page' : 'false'));
    window.scrollTo(0, 0);
    if (v === 'Tabela') setTimeout(() => Registo.focarHoje(), 0);
  }
  async function guardar() { await DB.setSettings(E.settings); E.existe = true; }
  async function carregar() { E.movs = await DB.all('movements'); E.cats = await DB.all('categories'); E.days = await DB.all('days'); }
  /** Na primeira utilização cria as categorias sugeridas (editáveis). */
  async function semear() {
    if (E.settings.catsSeeded) return;
    if (!E.cats.length) for (const n of CATS_BASE) await DB.put('categories', { name: n, archived: false });
    E.settings.catsSeeded = true; await guardar(); await carregar();
  }

  // ---------- Definições ----------
  function desenharDef() {
    const s = E.settings;
    $('iSav').value = Util.toInput(s.initialSavings);
    $('iInv').value = Util.toInput(s.initialInvested);
    $('iDate').value = s.startDate;
    $('iDias').value = s.backupReminderDays;
    $('ultimo').textContent = s.lastBackup ? 'Último backup: ' + Util.isoToPt(s.lastBackup.slice(0, 10)) + '.' : 'Ainda não fizeste nenhum backup.';
    let txt = '';
    if (E.movs.length) {
      if (!s.lastBackup) txt = 'Ainda não fizeste nenhum backup. Exporta um em Definições.';
      else {
        const dias = Math.floor((Date.now() - Date.parse(s.lastBackup)) / 864e5);
        if (dias >= s.backupReminderDays) txt = 'Passaram ' + dias + ' dias desde o último backup. Exporta um novo em Definições.';
      }
    }
    $('aviso').textContent = txt; $('aviso').hidden = !txt;
    desenharCats();
  }
  function desenharCats() {
    const ul = $('listaCats'); ul.textContent = '';
    if (!E.cats.length) { ul.innerHTML = '<li>Sem categorias. Cria a primeira abaixo.</li>'; return; }
    [...E.cats].sort((a, b) => a.name.localeCompare(b.name, 'pt')).forEach(c => {
      const li = document.createElement('li'), i = document.createElement('input'), b = document.createElement('button');
      i.value = c.name; i.setAttribute('aria-label', 'Nome da categoria');
      i.addEventListener('change', async () => {
        const nome = i.value.trim();
        if (!nome || E.cats.some(x => x.id !== c.id && x.name.toLowerCase() === nome.toLowerCase())) { dizer('Escreve um nome que ainda não exista.', false); i.value = c.name; return; }
        await DB.put('categories', { ...c, name: nome }); await carregar(); atualizar(); dizer('Categoria renomeada.');
      });
      b.type = 'button'; b.textContent = c.archived ? 'Restaurar' : 'Arquivar';
      b.onclick = async () => { await DB.put('categories', { ...c, archived: !c.archived }); await carregar(); atualizar(); };
      li.append(i, b);
      if (c.archived) { const s = document.createElement('span'); s.textContent = '(arquivada)'; li.append(s); }
      ul.append(li);
    });
  }
  $('fCat').addEventListener('submit', async e => {
    e.preventDefault();
    const nome = $('iCat').value.trim();
    if (!nome || E.cats.some(x => x.name.toLowerCase() === nome.toLowerCase())) return dizer('Escreve um nome que ainda não exista.', false);
    await DB.put('categories', { name: nome, archived: false }); $('iCat').value = '';
    await carregar(); atualizar(); dizer('Categoria adicionada.');
  });

  $('fIniciais').addEventListener('submit', async e => {
    e.preventDefault(); limparErros();
    const s = Util.parseMoney($('iSav').value), i = Util.parseMoney($('iInv').value), d = $('iDate').value;
    let ok = true;
    if (s === null) { erroCampo('eSav', 'valor inválido. Exemplo: 1 234,56'); ok = false; }
    if (i === null) { erroCampo('eInv', 'valor inválido. Exemplo: 1 234,56'); ok = false; }
    else if (i < 0) { erroCampo('eInv', 'o valor investido não pode ser negativo.'); ok = false; }
    if (!Util.validISO(d)) { erroCampo('eDate', 'escolhe uma data válida.'); ok = false; }
    if (!ok) return dizer('Corrige os campos indicados.', false);
    try { E.settings = { ...E.settings, initialSavings: s, initialInvested: i, startDate: d }; await guardar(); atualizar(); dizer('Valores iniciais guardados.'); }
    catch (err) { dizer('Não foi possível guardar: ' + err.message, false); }
  });
  $('fDias').addEventListener('submit', async e => {
    e.preventDefault(); limparErros();
    const t = $('iDias').value.trim(), n = Number(t);
    if (!/^\d+$/.test(t) || n < 1 || n > 365) { erroCampo('eDias', 'escreve um número inteiro entre 1 e 365.'); return dizer('Corrige os campos indicados.', false); }
    try { E.settings.backupReminderDays = n; await guardar(); atualizar(); dizer('Lembrete guardado.'); }
    catch (err) { dizer('Não foi possível guardar: ' + err.message, false); }
  });

  $('bExp').addEventListener('click', async () => {
    try {
      E.settings.lastBackup = new Date().toISOString(); await guardar();
      const dados = await DB.exportAll();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
      a.download = 'backup-gastos-' + Util.todayISO() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      atualizar(); dizer('Backup exportado. Guarda o ficheiro num local seguro.');
    } catch (err) { dizer('Não foi possível exportar: ' + err.message, false); }
  });
  $('bImp').addEventListener('click', () => $('fImp').click());
  $('fImp').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let dados;
    try { dados = JSON.parse(await f.text()); } catch { return dizer('O ficheiro não é um JSON válido.', false); }
    const v = DB.validate(dados);
    if (!v.ok) return dizer(v.erro, false);
    const r = v.resumo;
    const resumo = 'Saldo inicial da poupança: ' + Util.fmtEUR(r.settings.initialSavings) +
      '\nValor já investido: ' + Util.fmtEUR(r.settings.initialInvested) +
      '\nData de início: ' + Util.isoToPt(r.settings.startDate) +
      '\nMovimentos: ' + r.movimentos + ' | Dias com descrição: ' + r.dias + ' | Categorias: ' + r.categorias +
      '\nRecorrentes: ' + r.recorrentes + ' | Períodos: ' + r.periodos + ' | Metas: ' + r.metas +
      '\n\nIsto substitui todos os dados atuais.';
    if (!await confirmar('Importar este backup?', resumo, 'Substituir dados')) return dizer('Importação cancelada.');
    try {
      await DB.importAll(dados); E.settings = { ...padrao(), ...dados.settings }; E.existe = true;
      await carregar(); await semear(); atualizar(); dizer('Backup importado com sucesso.');
    } catch (err) { dizer('Não foi possível importar. Os dados atuais mantêm-se. ' + err.message, false); }
  });
  $('bDel').addEventListener('click', async () => {
    if (!await confirmar('Apagar todos os dados?', 'Vais apagar valores iniciais e todos os registos deste dispositivo.', 'Continuar')) return;
    if (!await confirmar('Tens a certeza?', 'Esta ação não se pode desfazer. Só os backups que exportaste ficam guardados.', 'Apagar tudo')) return;
    try { await DB.clearAll(); E.settings = padrao(); E.existe = false; await carregar(); await semear(); limparErros(); atualizar(); dizer('Todos os dados foram apagados.'); }
    catch (err) { dizer('Não foi possível apagar: ' + err.message, false); }
  });
  document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => ir(b.dataset.v)));

  async function armazenamento() {
    let t = 'Armazenamento persistente indisponível neste navegador. Faz backups com regularidade.';
    try {
      if (navigator.storage && navigator.storage.persist) {
        let p = await navigator.storage.persisted();
        if (!p) p = await navigator.storage.persist();
        t = p ? 'Armazenamento persistente ativo: o navegador não apaga os teus dados sozinho.'
              : 'O navegador não concedeu armazenamento persistente. Faz backups com regularidade.';
      }
    } catch { /* mantém a mensagem por omissão */ }
    $('stor').textContent = t;
  }
  async function iniciar() {
    try {
      const s = await DB.getSettings();
      if (s) { E.settings = { ...padrao(), ...s }; E.existe = true; }
      await carregar(); await semear();
    } catch (err) { dizer('Não foi possível ler os dados guardados: ' + err.message, false); }
    atualizar(); ir('Resumo'); armazenamento();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => { $('off').textContent = 'Modo offline indisponível aqui.'; });
      navigator.serviceWorker.ready.then(() => { $('off').textContent = 'Pronta para usar offline.'; });
    } else $('off').textContent = 'Modo offline indisponível neste navegador.';
  }
  return { E, dizer, confirmar, ir, guardar, carregar, atualizar, aoAtualizar, iniciar };
})();
