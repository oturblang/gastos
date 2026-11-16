'use strict';
/* Estado partilhado, navegação, mensagens, categorias, valores iniciais, backup e armazenamento. */
const App = (() => {
  const $ = id => document.getElementById(id);
  const VISTAS = ['Inicio', 'Tabela', 'Graficos', 'Poupanca', 'Invest', 'Calculos', 'Periodos', 'Periodo', 'Dia'];
  const CATS_BASE = ['Comida', 'Transportes', 'Experiências', 'Saúde', 'Casa', 'Outros'];
  const padrao = () => ({ initialSavings: 0, initialInvested: 0, startDate: Util.todayISO(), backupReminderDays: 14,
    lastBackup: null, catsSeeded: false, configured: false, tableFrom: null, tableTo: null });
  /** Estado em memória. Só guardamos movimentos e valores iniciais; o resto calcula-se (ver calc.js). */
  const E = { settings: padrao(), existe: false, movs: [], cats: [], days: [], recs: [], goals: [], pers: [] };
  const ouvintes = [];
  const aoAtualizar = f => ouvintes.push(f);
  let ultimaConfig = null, novaCat = null;

  /** Mensagem fixa no fundo do ecrã (visível em qualquer ponto da página). */
  function dizer(texto, ok = true, acao) {
    const t = $('toast'); clearTimeout(dizer.t);
    t.textContent = '';
    const s = document.createElement('span'); s.textContent = (ok ? '' : 'Erro: ') + texto; t.append(s);
    if (acao) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = acao.rotulo;
      b.onclick = () => { t.hidden = true; acao.fn(); }; t.append(b);
    }
    t.className = ok ? 'ok' : 'err'; t.hidden = false;
    dizer.t = setTimeout(() => { t.hidden = true; }, acao ? 9000 : ok ? 4500 : 9000);
  }
  $('toast').addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') $('toast').hidden = true; });
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
    const nav = v === 'Dia' ? 'Tabela' : v === 'Periodo' ? 'Periodos' : v;
    document.querySelectorAll('nav button').forEach(b => {
      b.setAttribute('aria-current', b.dataset.v === nav ? 'page' : 'false');
      if (b.dataset.v === nav && b.parentElement.scrollWidth > b.parentElement.clientWidth) b.parentElement.scrollLeft = b.offsetLeft - 16;
    });
    window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent('vista', { detail: v }));
  }
  async function guardar() { await DB.setSettings(E.settings); E.existe = true; }
  async function carregar() {
    E.movs = await DB.all('movements'); E.cats = await DB.all('categories'); E.days = await DB.all('days');
    E.recs = await DB.all('recurrences'); E.goals = await DB.all('goals'); E.pers = await DB.all('periods');
  }
  /** Cria os investimentos recorrentes que faltam (sem duplicar). Corre ao abrir a app e quando volta a ficar visível. */
  async function gerarRec() {
    if (!E.settings.configured) return;
    try {
      const n = await DB.gerarRecorrentes(Util.todayISO());
      if (n) { await carregar(); atualizar(); dizer(n === 1 ? '1 investimento recorrente criado automaticamente.' : n + ' investimentos recorrentes criados automaticamente.'); }
    } catch (err) { dizer('Não foi possível gerar os investimentos recorrentes: ' + err.message, false); }
  }
  /** Na primeira utilização cria as categorias sugeridas (editáveis). */
  async function semear() {
    if (E.settings.catsSeeded) return;
    if (!E.cats.length) for (const n of CATS_BASE) await DB.put('categories', { name: n, archived: false });
    E.settings.catsSeeded = true; await guardar(); await carregar();
  }
  function atualizar() { ouvintes.forEach(f => f()); desenharEstado(); }

  // ---------- Início ----------
  function preencherForm() {
    const s = E.settings;
    $('iSav').value = Util.toInput(s.initialSavings);
    $('iInv').value = Util.toInput(s.initialInvested);
    $('iDate').value = s.startDate;
    $('iDias').value = s.backupReminderDays;
  }
  function desenharEstado() {
    const s = E.settings, cfg = s.configured;
    $('fab').hidden = !cfg;
    $('intro').hidden = cfg;
    $('bIniciais').textContent = cfg ? 'Guardar alterações' : 'Guardar e criar a tabela';
    if (ultimaConfig !== cfg) { $('dIniciais').open = !cfg; ultimaConfig = cfg; }
    $('ultimo').textContent = s.lastBackup ? 'Último backup: ' + Util.isoToPt(s.lastBackup.slice(0, 10)) + '.' : 'Ainda não fizeste nenhum backup.';
    let txt = '';
    if (E.movs.length) {
      if (!s.lastBackup) txt = 'Ainda não fizeste nenhum backup. Exporta um em Início, Backup.';
      else {
        const dias = Math.floor((Date.now() - Date.parse(s.lastBackup)) / 864e5);
        if (dias >= s.backupReminderDays) txt = 'Passaram ' + dias + ' dias desde o último backup. Exporta um novo em Início, Backup.';
      }
    }
    $('aviso').textContent = txt; $('aviso').hidden = !txt;
    desenharCats();
  }
  function desenharCats() {
    const ul = $('listaCats'); ul.textContent = '';
    if (!E.cats.length) { const li = document.createElement('li'); li.textContent = 'Sem categorias. Cria a primeira abaixo.'; ul.append(li); return; }
    [...E.cats].sort((a, b) => a.name.localeCompare(b.name, 'pt')).forEach(c => {
      const li = document.createElement('li'), i = document.createElement('input'), b = document.createElement('button');
      i.value = c.name; i.setAttribute('aria-label', 'Nome da categoria');
      i.addEventListener('change', async () => {
        const nome = i.value.trim();
        if (!nome || E.cats.some(x => x.id !== c.id && x.name.toLowerCase() === nome.toLowerCase())) { dizer('Escreve um nome que ainda não exista.', false); i.value = c.name; return; }
        try { await DB.put('categories', { ...c, name: nome }); await carregar(); atualizar(); dizer('Categoria renomeada: ' + nome + '.'); }
        catch (err) { dizer('Não foi possível guardar: ' + err.message, false); }
      });
      b.type = 'button'; b.textContent = c.archived ? 'Restaurar' : 'Arquivar';
      b.onclick = async () => {
        try { await DB.put('categories', { ...c, archived: !c.archived }); await carregar(); atualizar(); dizer(c.archived ? 'Categoria restaurada: ' + c.name + '.' : 'Categoria arquivada: ' + c.name + '.'); }
        catch (err) { dizer('Não foi possível guardar: ' + err.message, false); }
      };
      const ap = document.createElement('button'); ap.type = 'button'; ap.textContent = 'Apagar'; ap.className = 'perigo';
      ap.onclick = async () => {
        const usos = E.movs.filter(m => m.categoryId === c.id).length;
        const txt = usos ? usos + (usos === 1 ? ' movimento fica' : ' movimentos ficam') + ' «Sem categoria». Os valores não mudam.' : 'Nenhum movimento usa esta categoria.';
        if (!await confirmar('Apagar a categoria «' + c.name + '»?', txt, 'Apagar')) return;
        try {
          const ids = await DB.apagarCategoria(c.id); await carregar(); atualizar();
          dizer('Categoria apagada: ' + c.name + '.', true, { rotulo: 'Desfazer', fn: async () => {
            try { await DB.restaurarCategoria(c, ids); await carregar(); atualizar(); dizer('Categoria reposta: ' + c.name + '.'); }
            catch (err) { dizer('Não foi possível repor: ' + err.message, false); } } });
        } catch (err) { dizer('Não foi possível apagar: ' + err.message, false); }
      };
      li.append(i, b, ap);
      if (c.archived) { const s = document.createElement('span'); s.textContent = '(arquivada)'; li.append(s); }
      if (novaCat && c.name === novaCat) { li.classList.add('nova'); setTimeout(() => li.scrollIntoView({ block: 'nearest' }), 0); }
      ul.append(li);
    });
    novaCat = null;
  }
  $('fCat').addEventListener('submit', async e => {
    e.preventDefault();
    const nome = $('iCat').value.trim();
    if (!nome) return dizer('Escreve o nome da categoria.', false);
    if (E.cats.some(x => x.name.toLowerCase() === nome.toLowerCase())) return dizer('Já existe uma categoria com esse nome.', false);
    try {
      await DB.put('categories', { name: nome, archived: false }); $('iCat').value = ''; novaCat = nome;
      await carregar(); atualizar(); dizer('+ Categoria adicionada: ' + nome + '.');
    } catch (err) { dizer('Não foi possível guardar: ' + err.message, false); }
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
    const eraConfigurado = E.settings.configured;
    try {
      E.settings = { ...E.settings, initialSavings: s, initialInvested: i, startDate: d, configured: true };
      await guardar(); preencherForm(); atualizar();
      if (eraConfigurado) dizer('Valores iniciais guardados.');
      else { ir('Tabela'); dizer('Tabela criada. Já podes preencher os valores.'); }
    } catch (err) { E.settings.configured = eraConfigurado; dizer('Não foi possível guardar: ' + err.message, false); }
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
  function descarregar(nome, conteudo) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' })); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  $('bCsvMov').addEventListener('click', () => {
    if (!E.movs.length) return dizer('Ainda não há movimentos para exportar.', false);
    descarregar('movimentos-' + Util.todayISO() + '.csv', Csv.movimentos(E.movs, E.cats, E.pers)); dizer('Ficheiro de movimentos exportado (CSV).');
  });
  $('bCsvHist').addEventListener('click', () => {
    if (!E.settings.configured) return dizer('Define primeiro os valores iniciais.', false);
    descarregar('historico-poupanca-' + Util.todayISO() + '.csv', Csv.historico(E.settings, E.movs, E.cats)); dizer('Histórico da poupança exportado (CSV).');
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
      await DB.importAll(dados); E.settings = { ...padrao(), ...dados.settings, configured: true }; await guardar();
      await carregar(); await semear(); preencherForm(); atualizar(); dizer('Backup importado com sucesso.'); gerarRec();
    } catch (err) { dizer('Não foi possível importar. Os dados atuais mantêm-se. ' + err.message, false); }
  });
  $('bDel').addEventListener('click', async () => {
    if (!await confirmar('Apagar todos os dados?', 'Vais apagar valores iniciais e todos os registos deste dispositivo.', 'Continuar')) return;
    if (!await confirmar('Tens a certeza?', 'Esta ação não se pode desfazer. Só os backups que exportaste ficam guardados.', 'Apagar tudo')) return;
    try {
      await DB.clearAll(); E.settings = padrao(); E.existe = false; await carregar(); await semear();
      limparErros(); preencherForm(); atualizar(); ir('Inicio'); dizer('Todos os dados foram apagados.');
    } catch (err) { dizer('Não foi possível apagar: ' + err.message, false); }
  });
  document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => ir(b.dataset.v)));
  $('irInicio').addEventListener('click', () => ir('Inicio'));

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
    // Se outra janela com a versão antiga estiver aberta, a base de dados fica bloqueada: avisa e continua sozinha quando essa janela fechar.
    DB.aoBloquear(() => { $('bloqueio').textContent = 'A app está aberta noutra janela ou separador com uma versão antiga (inclui a app instalada). Fecha essas janelas: esta página continua sozinha e os teus dados não se perdem.'; $('bloqueio').hidden = false; });
    DB.aoLibertar(() => { $('bloqueio').hidden = true; });
    DB.aoNovaVersao(() => { $('bloqueio').textContent = 'Há uma versão nova da app aberta noutra janela. Recarrega esta página.'; $('bloqueio').hidden = false; });
    ir('Inicio');   // a app abre sempre no Início
    try {
      const s = await DB.getSettings();
      if (s) { E.settings = { ...padrao(), ...s }; E.existe = true; }
      await carregar();
      if (s && s.configured === undefined) {   // dados criados antes desta versão: já estavam em uso?
        E.settings.configured = E.movs.length > 0 || s.initialSavings !== 0 || s.initialInvested !== 0 || !!s.lastBackup;
        await guardar();
      }
      await semear();
    } catch (err) { dizer('Não foi possível ler os dados guardados: ' + err.message, false); }
    preencherForm(); atualizar(); armazenamento(); gerarRec();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) gerarRec(); });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => { $('off').textContent = 'Modo offline indisponível aqui.'; });
      navigator.serviceWorker.ready.then(() => { $('off').textContent = 'Pronta para usar offline.'; });
    } else $('off').textContent = 'Modo offline indisponível neste navegador.';
  }
  return { E, gerarRec, dizer, confirmar, ir, guardar, carregar, atualizar, aoAtualizar, iniciar };
})();
