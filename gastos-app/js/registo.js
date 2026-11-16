'use strict';
/* Tabela estilo Excel, página do dia e registo de movimentos. A lógica de cálculo está em calc.js. */
const Registo = (() => {
  const $ = id => document.getElementById(id);
  const E = App.E;
  const NOME = { ganho: 'Ganho', gasto: 'Gasto', investimento: 'Investimento', ajuste: 'Ajuste' };
  const EDIT = ['ganho', 'gasto', 'investimento', 'ajuste'];
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const catNome = id => { const c = E.cats.find(x => x.id === id); return c ? c.name + (c.archived ? ' (arquivada)' : '') : 'Sem categoria'; };
  const dataCurta = iso => Calc.diaSemana(iso) + ' ' + iso.slice(8) + '/' + iso.slice(5, 7);
  const guardado = () => { try { return localStorage.getItem('gastos-tabela-modo') === 'lista' ? 'lista' : 'tabela'; } catch (e) { return 'tabela'; } };
  let modoTab = guardado();
  let diaAtual = null, editId = null, assinatura = '', destaque = null, quickTipo = null;

  async function recarregar() { await App.carregar(); App.atualizar(); }
  /** Depois de guardar: recalcula tudo e avisa (sem bloquear) se a poupança ficou negativa. */
  async function depoisDeGuardar(txt) {
    await recarregar();
    const p = Calc.total(E.settings, E.movs, '9999-12-31').poup;
    App.dizer(p < 0 ? txt + ' Atenção: a poupança ficou negativa (' + Util.fmtEUR(p) + ').' : txt);
  }

  // ---------- Tabela ----------
  function intervalo(s = E.settings, movs = E.movs) {
    const hoje = Util.todayISO();
    let de = s.tableFrom || s.startDate, ate = s.tableTo || hoje;
    for (const m of movs) { if (m.date < de) de = m.date; if (m.date > ate) ate = m.date; }
    if (hoje > ate) ate = hoje;
    if (Calc.addDays(de, 13) > ate) ate = Calc.addDays(de, 13);   // a tabela nasce com pelo menos 14 dias
    return { de, ate, n: Calc.diasEntre(de, ate) + 1 };
  }
  const RUB = [['ganho', 'Ganhos', true], ['gasto', 'Gastos', true], ['investimento', 'Investido', true], ['ajuste', 'Ajustes', true],
    ['sobra', 'Sobra', false], ['poup', 'Poupança', false], ['capital', 'Capital', false]];
  function desenharTabela() {
    const cfg = E.settings.configured;
    $('tabVazia').hidden = cfg; $('tabConteudo').hidden = !cfg;
    if (!cfg) { assinatura = ''; $('tab').textContent = ''; return; }
    const { de, n } = intervalo(), cols = Calc.serie(E.settings, E.movs, de, n), hoje = Util.todayISO();
    aplicarModo();
    if (modoTab === 'lista') return desenharCartoes(cols, hoje);
    const sig = [de, n, hoje, destaque, cols.map(c => EDIT.map(k => c.n[k] > 1 ? 1 : 0).join('')).join('.')].join('|');
    if (sig === assinatura && $('tab').firstChild) return atualizarCelulas(cols);   // só muda os números: não perde o cursor
    reconstruir(cols, hoje); assinatura = sig;
  }
  /** Classes da coluna: «hoje» (amarelo) e «escolhido» (azul, escolhido em «Ir»). */
  const cls = (d, hoje) => { const c = (d === hoje ? 'hoje ' : '') + (d === destaque ? 'escolhido' : ''); return c.trim() ? ' class="' + c.trim() + '"' : ''; };
  function reconstruir(cols, hoje) {
    const a = document.activeElement, foco = a && a.matches && a.matches('#tab input[data-tipo]') ? { d: a.dataset.date, t: a.dataset.tipo, v: a.value } : null;
    const wrap = $('tabWrap'), sl = wrap.scrollLeft, st = wrap.scrollTop;
    let h = '<thead><tr><th scope="col">Rubrica</th>' + cols.map(c => '<th scope="col"' + cls(c.date, hoje) + ' data-date="' + c.date + '">' +
      '<button type="button" class="dia" data-dia="' + c.date + '">' + dataCurta(c.date) + (c.date === hoje ? '<small>hoje</small>' : '') + (c.date === destaque ? '<small class="esc">◆ escolhido</small>' : '') + '</button></th>').join('') + '</tr></thead><tbody>';
    for (const [k, nome, editavel] of RUB) {
      h += '<tr><th scope="row">' + nome + '</th>';
      for (const c of cols) {
        const cl = cls(c.date, hoje);
        if (!editavel) h += '<td' + cl + ' data-date="' + c.date + '" data-calc="' + (k === 'sobra' ? 'sobra' : k === 'poup' ? 'poup' : 'capital') + '">' + Util.fmtEUR(c[k]) + '</td>';
        else if (c.n[k] > 1) h += '<td' + cl + '><input class="multi" data-date="' + c.date + '" data-tipo="' + k + '" inputmode="decimal" autocomplete="off" title="Soma de ' + c.n[k] + ' movimentos. Se alterares o valor, a diferença é aplicada ao último movimento. Toca no dia para ver todos." aria-label="' + nome + ' ' + Util.isoToPt(c.date) + ': soma de ' + c.n[k] + ' movimentos" value="' + Util.toInput(c.v[k]) + '"></td>';
        else h += '<td' + cl + '><input data-date="' + c.date + '" data-tipo="' + k + '" inputmode="decimal" autocomplete="off" placeholder="0,00" aria-label="' + nome + ' ' + Util.isoToPt(c.date) + '" value="' + (c.n[k] ? Util.toInput(c.v[k]) : '') + '"></td>';
      }
      h += '</tr>';
    }
    $('tab').innerHTML = h + '</tbody>';
    wrap.scrollLeft = sl; wrap.scrollTop = st;
    if (foco) { const i = $('tab').querySelector('input[data-date="' + foco.d + '"][data-tipo="' + foco.t + '"]'); if (i) { i.focus(); i.value = foco.v; } }
  }
  function atualizarCelulas(cols) {
    const por = {}; cols.forEach(c => { por[c.date] = c; });
    $('tab').querySelectorAll('td[data-calc]').forEach(td => { const t = Util.fmtEUR(por[td.dataset.date][td.dataset.calc]); if (td.textContent !== t) td.textContent = t; });
    $('tab').querySelectorAll('input[data-tipo]').forEach(i => {
      if (i === document.activeElement) return;
      const c = por[i.dataset.date], v = c.n[i.dataset.tipo] ? Util.toInput(c.v[i.dataset.tipo]) : '';
      if (i.value !== v) i.value = v;
    });
  }
  const forcar = () => { assinatura = ''; desenharTabela(); };
  /** «Tabela | Lista»: a lista mostra um cartão por dia (mais recente primeiro); tocar abre o dia para editar. */
  function aplicarModo() {
    const lista = modoTab === 'lista';
    $('tabWrap').hidden = lista; $('tabLista').hidden = !lista;
    document.querySelectorAll('[data-tmodo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tmodo === modoTab)));
    $('tabAjuda').textContent = lista ? 'Toca num dia para ver e editar os movimentos.' : 'Escreve nos campos. O resto calcula-se. Enter passa para baixo.';
  }
  function desenharCartoes(cols, hoje) {
    const sl = window.scrollY, L = [['ganho', 'Ganhos'], ['gasto', 'Gastos'], ['investimento', 'Investido'], ['ajuste', 'Ajustes']];
    $('tabLista').innerHTML = [...cols].reverse().map(c => {
      const linhas = L.filter(([k]) => c.n[k] > 0).map(([k, nome]) => '<dt>' + nome + '</dt><dd>' + Util.fmtEUR(c.v[k]) + '</dd>').join('');
      const cl = ['dcard', c.date === hoje ? 'hoje' : '', c.date === destaque ? 'escolhido' : ''].filter(Boolean).join(' ');
      return '<button type="button" class="' + cl + '" data-date="' + c.date + '" data-dia="' + c.date + '" aria-label="Dia ' + Util.isoToPt(c.date) + '. Abrir">' +
        '<div class="dc-t"><span>' + dataCurta(c.date) + '</span><small>' + (c.date === hoje ? 'hoje' : c.date === destaque ? '◆ escolhido' : '') + '</small></div>' +
        (linhas ? '<dl>' + linhas + '</dl>' : '<div class="dc-vazio">Sem movimentos</div>') +
        '<div class="dc-p"><span>Poupança</span><span>' + Util.fmtEUR(c.poup) + '</span></div></button>';
    }).join('');
    window.scrollTo(0, sl);
  }
  function trocarModo(m) {
    modoTab = m; try { localStorage.setItem('gastos-tabela-modo', m); } catch (e) { /* ignora */ }
    assinatura = ''; desenharTabela(); setTimeout(focarHoje, 0);
  }
  /** Editar uma célula: sem movimento cria um; com um movimento altera-o; vazio ou 0 apaga (com confirmação). */
  async function celula(inp) {
    const { date, tipo } = inp.dataset, c = Util.parseMoney(inp.value);
    const existentes = E.movs.filter(m => m.date === date && m.type === tipo);
    try {
      if (c === null || (tipo !== 'ajuste' && c < 0)) { App.dizer('Valor inválido. Exemplo: 1 234,56', false); return forcar(); }
      if (existentes.length > 1) {   // várias parcelas no mesmo dia (ex.: recorrente + manual): o valor escrito é o novo total
        const soma = existentes.reduce((s, m) => s + m.cents, 0), ord = [...existentes].sort((x, y) => x.id - y.id);
        const alvo = [...ord].reverse().find(m => m.recId == null) || ord[ord.length - 1], novo = alvo.cents + (c - soma);
        if (c === soma) return forcar();
        if (novo === 0 || (tipo !== 'ajuste' && novo < 0)) { App.dizer('Para chegar a esse valor, abre o dia (toca na data) e edita os movimentos um a um.', false); return forcar(); }
        await DB.put('movements', { ...alvo, cents: novo });
        return depoisDeGuardar('Guardado: total de ' + NOME[tipo] + ' ' + Util.fmtEUR(c) + ' em ' + Util.isoToPt(date) + '.');
      }
      if (c === 0) { if (existentes.length === 1) return apagarMov(existentes[0]); return forcar(); }
      if (existentes.length === 1) await DB.put('movements', { ...existentes[0], cents: c });
      else await DB.put('movements', { date, type: tipo, cents: c, categoryId: null, desc: '' });
      await depoisDeGuardar('Guardado: ' + NOME[tipo] + ' ' + Util.fmtEUR(c) + ' em ' + Util.isoToPt(date) + '.');
    } catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
  }
  function focarHoje() { const th = modoTab === 'lista' ? $('tabLista').querySelector('.hoje') : $('tab').querySelector('th.hoje'); if (th) th.scrollIntoView({ inline: 'center', block: 'center' }); }
  async function mudarIntervalo(lado) {
    const t = $('addN').value.trim(), n = Number(t);
    $('eAdd').textContent = '';
    if (!/^\d+$/.test(t) || n < 1 || n > 366) { $('eAdd').textContent = 'Erro: escreve um número inteiro entre 1 e 366.'; return; }
    const { de, ate } = intervalo();
    try {
      if (lado === 'fim') E.settings.tableTo = Calc.addDays(ate, n); else E.settings.tableFrom = Calc.addDays(de, -n);
      await App.guardar(); App.atualizar();
      App.dizer(n + (n === 1 ? ' dia adicionado ' : ' dias adicionados ') + (lado === 'fim' ? 'no fim da tabela.' : 'no início da tabela.'));
    } catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
  }

  // ---------- Página do dia ----------
  function desenharDia() {
    if (!diaAtual) return;
    const d = diaAtual, movs = E.movs.filter(m => m.date === d).sort((a, b) => a.id - b.id);
    const desc = (E.days.find(x => x.date === d) || {}).text || '';
    const lista = movs.length ? '<ul class="movs">' + movs.map(m => '<li><span><strong>' + NOME[m.type] + '</strong> ' + Util.fmtEUR(m.cents) + '<br>' + esc(catNome(m.categoryId)) +
        (m.desc ? ' - ' + esc(m.desc) : '') + '</span><span><button type="button" data-ed="' + m.id + '">Editar</button><button type="button" class="perigo" data-ap="' + m.id + '">Apagar</button></span></li>').join('') + '</ul>'
        : '<p>Sem movimentos neste dia.</p>';
    $('vDia').innerHTML = '<button type="button" id="dVoltar">' + (origemDia === 'Movimentos' ? 'Voltar aos movimentos' : 'Voltar à tabela') + '</button><h2>' + Calc.diaSemana(d) + ', ' + Util.isoToPt(d) + '</h2>' +
      ((per => per ? '<p>Período: <button type="button" class="dia" data-per="' + per.id + '">' + esc(per.name) + '</button></p>' : '')(Calc.periodoDe(E.pers, d))) +
      '<h3>Movimentos</h3>' + lista + '<button type="button" id="dAdd" class="primario">+ Adicionar movimento</button>' +
      '<label for="dDesc">Descrição do dia</label><textarea id="dDesc" rows="2">' + esc(desc) + '</textarea>' +
      '<button type="button" id="dGuardar">Guardar descrição</button>' +
      '<div class="perigo-zona"><button type="button" id="dApagarDia" class="perigo">Apagar este dia</button></div>';
    cresce($('dDesc'));
  }
  /** A caixa da descrição começa pequena (2 linhas) e cresce ao escrever. */
  function cresce(t) { if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 320) + 'px'; }
  // ---------- Opções de um movimento (toque numa linha do histórico) ----------
  let movAcoes = null;
  function acoes(m) {
    if (!m) return;
    movAcoes = m;
    $('amTit').textContent = NOME[m.type] + ' de ' + Util.fmtEUR(m.cents);
    $('amTxt').textContent = Util.isoToPt(m.date) + [catNome(m.categoryId), m.desc].filter(Boolean).map(x => ' · ' + x).join('') + (m.recId != null ? ' · recorrente' : '');
    $('dMov').showModal();
  }
  let origemDia = 'Tabela';
  function abrirDia(d, origem) { diaAtual = d; origemDia = origem || 'Tabela'; desenharDia(); App.ir('Dia', origemDia === 'Movimentos' ? 'Mais' : undefined); }
  async function guardarDesc() {
    try {
      const t = $('dDesc').value.trim();
      if (t) await DB.put('days', { date: diaAtual, text: t }); else await DB.del('days', diaAtual);
      E.days = await DB.all('days'); App.dizer('Descrição do dia guardada.');
    } catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
  }
  async function apagarMov(m) {
    const ok = await App.confirmar('Apagar este movimento?', NOME[m.type] + ' de ' + Util.fmtEUR(m.cents) + ' em ' + Util.isoToPt(m.date) + '.', 'Apagar');
    if (!ok) return forcar();
    try {
      await DB.del('movements', m.id); await recarregar();
      App.dizer('Movimento apagado.', true, { rotulo: 'Desfazer', fn: async () => { await DB.put('movements', m); await depoisDeGuardar('Movimento reposto.'); } });
    } catch (err) { App.dizer('Não foi possível apagar: ' + err.message, false); }
  }

  /** Apaga os movimentos e a descrição de um dia. Se for a primeira ou a última coluna (e a tabela puder encolher), remove também a coluna. */
  async function apagarDia(d) {
    const antes = intervalo(), movs = E.movs.filter(m => m.date === d), desc = E.days.find(x => x.date === d);
    const s2 = { ...E.settings };
    if (d === antes.ate) s2.tableTo = Calc.addDays(d, -1); else if (d === antes.de) s2.tableFrom = Calc.addDays(d, 1);
    const depois = intervalo(s2, E.movs.filter(m => m.date !== d)), sai = d < depois.de || d > depois.ate;
    const nada = !movs.length && !desc;
    if (!sai && nada) return App.dizer('Esta coluna não se pode remover: só a primeira ou a última, a tabela tem sempre pelo menos 14 dias e vai até hoje.', false);
    const q = movs.length ? movs.length + (movs.length === 1 ? ' movimento' : ' movimentos') + (desc ? ' e a descrição' : '') : 'a descrição';
    const txt = (sai ? 'A coluna de ' : 'O dia ') + Util.isoToPt(d) + (sai ? ' deixa de existir na tabela' : ' fica na tabela (só a primeira ou a última coluna podem sair, e a tabela tem sempre pelo menos 14 dias até hoje)') +
      (nada ? '.' : ', e apagas ' + q + ' desse dia.');
    if (!await App.confirmar(sai ? 'Remover esta coluna?' : 'Apagar o conteúdo deste dia?', txt, sai ? 'Remover' : 'Apagar')) return;
    const velhas = { ...E.settings };
    try {
      for (const m of movs) await DB.del('movements', m.id);
      if (desc) await DB.del('days', d);
      if (sai) { E.settings = s2; await App.guardar(); }
      if (destaque === d) destaque = null;
      await recarregar(); if (!$('vDia').hidden) App.ir(origemDia);
      App.dizer(sai ? 'Coluna removida: ' + Util.isoToPt(d) + '.' : 'Dia apagado: ' + Util.isoToPt(d) + '.', true, { rotulo: 'Desfazer', fn: async () => {
        try {
          for (const m of movs) await DB.put('movements', m);
          if (desc) await DB.put('days', desc);
          E.settings = velhas; await App.guardar(); await recarregar(); App.dizer('Reposto: ' + Util.isoToPt(d) + '.');
        } catch (err) { App.dizer('Não foi possível repor: ' + err.message, false); }
      } });
    } catch (err) { App.dizer('Não foi possível apagar: ' + err.message, false); }
  }

  // ---------- Registo rápido (Poupança e Investimentos) ----------
  const QT = { ganho: ['Adicionar dinheiro', 'Qualquer dinheiro que recebes (por exemplo uma prenda) entra na poupança.', 'Dinheiro adicionado'],
    ajuste: ['Ajuste manual', 'Para acertar com o saldo real: valor positivo aumenta a poupança, negativo (ex.: -3,20) diminui.', 'Ajuste guardado'],
    investimento: ['Registar investimento', 'O valor sai da poupança e conta para o capital investido.', 'Investimento guardado'] };
  function rapido(tipo) {
    quickTipo = tipo;
    $('qTitulo').textContent = QT[tipo][0]; $('qDica').textContent = QT[tipo][1];
    $('qValor').value = ''; $('qData').value = Util.todayISO(); $('qDesc').value = '';
    $('qeValor').textContent = ''; $('qeData').textContent = '';
    $('dQuick').showModal(); $('qValor').focus();
  }
  async function submeterQuick(e) {
    e.preventDefault();
    $('qeValor').textContent = ''; $('qeData').textContent = '';
    const c = Util.parseMoney($('qValor').value), data = $('qData').value; let ok = true;
    if (c === null || c === 0 || (quickTipo !== 'ajuste' && c < 0)) { $('qeValor').textContent = 'Erro: escreve um valor válido' + (quickTipo === 'ajuste' ? ', diferente de zero.' : ', maior que zero.') + ' Exemplo: 12,50'; ok = false; }
    if (!Util.validISO(data)) { $('qeData').textContent = 'Erro: escolhe uma data válida.'; ok = false; }
    if (!ok) return;
    try {
      await DB.put('movements', { date: data, type: quickTipo, cents: c, categoryId: null, desc: $('qDesc').value.trim() });
      $('dQuick').close(); await depoisDeGuardar(QT[quickTipo][2] + ': ' + Util.fmtEUR(c) + ' em ' + Util.isoToPt(data) + '.');
    } catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
  }

  // ---------- Registo de movimentos ----------
  function dica() { $('rDica').hidden = $('rTipo').value !== 'ajuste'; $('rDividir').hidden = !podeDividir(); atualizarRap(); }
  let divisao = false;
  const opcoesCat = sel => {
    const lista = E.cats.filter(c => !c.archived || String(c.id) === String(sel)).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    return '<option value="">Sem categoria</option>' + lista.map(c => '<option value="' + c.id + '">' + esc(c.name) + (c.archived ? ' (arquivada)' : '') + '</option>').join('');
  };
  /** Categorias mais usadas (últimos 90 dias) e a do movimento mais recente do mesmo tipo; nada fica guardado, tudo vem dos movimentos. */
  function sugestoes(tipo) {
    const desde = Calc.addDays(Util.todayISO(), -90), mesmos = E.movs.filter(m => m.type === tipo && m.categoryId != null && E.cats.some(c => c.id === m.categoryId && !c.archived));
    const cont = new Map(); mesmos.filter(m => m.date >= desde).forEach(m => cont.set(m.categoryId, (cont.get(m.categoryId) || 0) + 1));
    const top = [...cont.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5).map(x => x[0]);
    const rec = [...E.movs].filter(m => m.type === tipo).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)[0];
    return { top, recente: rec && rec.categoryId != null && E.cats.some(c => c.id === rec.categoryId && !c.archived) ? rec.categoryId : null };
  }
  function atualizarRap() {
    const t = $('rTipo').value, box = $('rRap');
    const s = (t === 'gasto' || t === 'ganho') && !divisao && editId == null ? sugestoes(t) : { top: [] };
    box.hidden = !s.top.length;
    box.innerHTML = s.top.map(id => '<button type="button" data-cat="' + id + '" aria-pressed="false">' + esc(E.cats.find(c => c.id === id).name) + '</button>').join('');
    marcarRap();
  }
  function marcarRap() { $('rRap').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === $('rCat').value))); }
  function podeDividir() { const t = $('rTipo').value; return t === 'gasto' || t === 'ganho'; }
  function linhaParte(cat, valor) {
    const d = document.createElement('div'); d.className = 'parte';
    d.innerHTML = '<select aria-label="Categoria">' + opcoesCat(cat) + '</select><input inputmode="decimal" autocomplete="off" placeholder="0,00" aria-label="Valor (€)">';
    d.querySelector('select').value = cat == null ? '' : String(cat); d.querySelector('input').value = valor ? Util.toInput(valor) : '';
    $('rPartes').append(d);
  }
  function lerPartes() {
    return [...$('rPartes').children].map(d => ({ categoryId: d.querySelector('select').value ? Number(d.querySelector('select').value) : null, cents: Util.parseMoney(d.querySelector('input').value) }));
  }
  function falta() {
    const total = Util.parseMoney($('rValor').value), soma = lerPartes().reduce((a, p) => a + (p.cents > 0 ? p.cents : 0), 0);
    if (total === null || total <= 0) { $('rFalta').textContent = 'Escreve primeiro o valor total acima.'; return; }
    const f = total - soma;
    $('rFalta').textContent = f === 0 ? 'Tudo distribuído: ' + Util.fmtEUR(total) + '.' : f > 0 ? 'Falta distribuir: ' + Util.fmtEUR(f) : 'Passaste o total em ' + Util.fmtEUR(-f);
  }
  function modoDivisao(on, partes) {
    divisao = on && podeDividir();
    $('rUma').hidden = divisao; $('rDiv').hidden = !divisao; $('eDiv').textContent = '';
    if (divisao) {
      $('rPartes').innerHTML = '';
      const total = Util.parseMoney($('rValor').value), cat = $('rCat').value ? Number($('rCat').value) : null;
      (partes || [{ categoryId: cat, cents: total > 0 ? total : 0 }, { categoryId: null, cents: 0 }]).forEach(p => linhaParte(p.categoryId, p.cents));
      falta();
    }
    atualizarRap();
  }
  function abrirReg({ date, mov }) {
    editId = mov ? mov.id : null; divisao = false;
    $('rTitulo').textContent = mov ? 'Editar movimento' : 'Registar movimento';
    $('rTipo').value = mov ? mov.type : 'gasto';
    $('rValor').value = mov ? Util.toInput(mov.cents) : '';
    $('rData').value = mov ? mov.date : date;
    $('rDesc').value = mov ? (mov.desc || '') : '';
    $('rCat').innerHTML = opcoesCat(mov && mov.categoryId != null ? mov.categoryId : null);
    const sug = mov ? null : sugestoes('gasto');
    $('rCat').value = mov ? (mov.categoryId != null ? String(mov.categoryId) : '') : (sug.recente != null ? String(sug.recente) : '');
    $('eValor').textContent = ''; $('eData').textContent = '';
    $('rUma').hidden = false; $('rDiv').hidden = true;
    dica(); $('dReg').showModal(); $('rValor').focus(); $('rValor').select();
  }
  async function submeterReg(e) {
    e.preventDefault();
    $('eValor').textContent = ''; $('eData').textContent = ''; $('eDiv').textContent = '';
    const tipo = $('rTipo').value, c = Util.parseMoney($('rValor').value), data = $('rData').value;
    let ok = true;
    if (c === null || c === 0 || (tipo !== 'ajuste' && c < 0)) { $('eValor').textContent = 'Erro: escreve um valor válido, maior que zero. Exemplo: 12,50'; ok = false; }
    if (!Util.validISO(data)) { $('eData').textContent = 'Erro: escolhe uma data válida.'; ok = false; }
    const desc = $('rDesc').value.trim();
    let partes = null;
    if (divisao && ok) {
      partes = lerPartes();
      if (partes.some(p => p.cents === null || p.cents <= 0)) { $('eDiv').textContent = 'Erro: cada categoria precisa de um valor maior que zero.'; ok = false; }
      else if (partes.reduce((a, p) => a + p.cents, 0) !== c) { $('eDiv').textContent = 'Erro: a soma das categorias tem de dar exatamente ' + Util.fmtEUR(c) + '.'; ok = false; }
    }
    if (!ok) return;
    try {
      if (partes) {
        // Cada parte é um movimento normal (por isso totais, gráficos e filtros funcionam); `grp` liga as partes do mesmo gasto.
        const grp = Date.now(), antigo = editId != null ? E.movs.find(m => m.id === editId) : null;
        for (let k = 0; k < partes.length; k++) {
          const o = { date: data, type: tipo, cents: partes[k].cents, categoryId: partes[k].categoryId, desc, grp };
          if (k === 0 && antigo) Object.assign(o, { ...antigo, ...o, id: editId });
          await DB.put('movements', o);
        }
        $('dReg').close();
        return await depoisDeGuardar(NOME[tipo] + ' dividido em ' + partes.length + ' categorias: ' + Util.fmtEUR(c) + ' em ' + Util.isoToPt(data) + '.');
      }
      const obj = { date: data, type: tipo, cents: c, categoryId: $('rCat').value ? Number($('rCat').value) : null, desc };
      if (editId != null) Object.assign(obj, { ...(E.movs.find(m => m.id === editId) || {}), ...obj, id: editId });
      await DB.put('movements', obj); $('dReg').close(); await depoisDeGuardar('Movimento guardado: ' + NOME[tipo] + ' ' + Util.fmtEUR(c) + ' em ' + Util.isoToPt(data) + '.');
    } catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
  }

  function iniciar() {
    App.aoAtualizar(() => { desenharTabela(); desenharDia(); });
    document.addEventListener('vista', e => { if (e.detail === 'Tabela') setTimeout(focarHoje, 0); });
    $('tab').addEventListener('change', e => { if (e.target.matches('input[data-tipo]')) celula(e.target); });
    $('tab').addEventListener('click', e => { const b = e.target.closest('[data-dia]'); if (b) abrirDia(b.dataset.dia); });
    $('tabLista').addEventListener('click', e => { const b = e.target.closest('[data-dia]'); if (b) abrirDia(b.dataset.dia); });
    document.querySelectorAll('[data-tmodo]').forEach(b => b.addEventListener('click', () => trocarModo(b.dataset.tmodo)));
    $('tab').addEventListener('keydown', e => {   // Enter desce para a linha de baixo, como no Excel
      if (e.key !== 'Enter' || !e.target.matches('input[data-tipo]')) return;
      e.preventDefault();
      const prox = $('tab').querySelector('input[data-date="' + e.target.dataset.date + '"][data-tipo="' + EDIT[EDIT.indexOf(e.target.dataset.tipo) + 1] + '"]');
      if (prox) { prox.focus(); prox.select(); } else e.target.blur();
    });
    $('vDia').addEventListener('click', e => {
      const t = e.target;
      if (t.id === 'dVoltar') App.ir(origemDia, origemDia === 'Movimentos' ? undefined : undefined);
      else if (t.dataset.per) Per.abrir(Number(t.dataset.per));
      else if (t.id === 'dGuardar') guardarDesc();
      else if (t.id === 'dAdd') abrirReg({ date: diaAtual });
      else if (t.id === 'dApagarDia') apagarDia(diaAtual);
      else if (t.dataset.ed) abrirReg({ mov: E.movs.find(m => m.id === Number(t.dataset.ed)) });
      else if (t.dataset.ap) apagarMov(E.movs.find(m => m.id === Number(t.dataset.ap)));
    });
    $('vDia').addEventListener('change', e => { if (e.target.id === 'dDesc') guardarDesc(); });
    $('vDia').addEventListener('input', e => { if (e.target.id === 'dDesc') cresce(e.target); });
    $('amEd').addEventListener('click', () => { const m = movAcoes; $('dMov').close(); if (m) abrirReg({ mov: m }); });
    $('amAp').addEventListener('click', () => { const m = movAcoes; $('dMov').close(); if (m) apagarMov(m); });
    $('fab').addEventListener('click', () => abrirReg({ date: !$('vDia').hidden && diaAtual ? diaAtual : Util.todayISO() }));
    $('fReg').addEventListener('submit', submeterReg);
    $('fQuick').addEventListener('submit', submeterQuick);
    $('qCancel').addEventListener('click', () => $('dQuick').close());
    $('rCancel').addEventListener('click', () => $('dReg').close());
    $('rTipo').addEventListener('change', () => { if (divisao && !podeDividir()) modoDivisao(false); if (editId == null && podeDividir()) { const s = sugestoes($('rTipo').value); $('rCat').value = s.recente != null ? String(s.recente) : ''; } dica(); });
    $('rDividir').addEventListener('click', () => modoDivisao(true));
    $('rUnica').addEventListener('click', () => modoDivisao(false));
    $('rMaisParte').addEventListener('click', () => { linhaParte(null, 0); falta(); });
    $('rPartes').addEventListener('input', () => { $('eDiv').textContent = ''; falta(); }); $('rValor').addEventListener('input', () => { if (divisao) falta(); });
    $('rCat').addEventListener('change', marcarRap);
    $('rRap').addEventListener('click', e => { const b = e.target.closest('button[data-cat]'); if (b) { $('rCat').value = b.dataset.cat; marcarRap(); } });
    $('bHoje').addEventListener('click', () => { destaque = null; forcar(); focarHoje(); });
    $('remIni').addEventListener('click', () => apagarDia(intervalo().de));
    $('remFim').addEventListener('click', () => apagarDia(intervalo().ate));
    $('fIr').addEventListener('submit', e => {
      e.preventDefault();
      const d = $('irData').value, alvo = () => (modoTab === 'lista' ? $('tabLista') : $('tab')).querySelector((modoTab === 'lista' ? '.dcard' : 'th') + '[data-date="' + d + '"]'), th = Util.validISO(d) && alvo();
      if (!th) return App.dizer('Escolhe uma data que esteja na tabela. Usa «Adicionar dias» para criar mais colunas.', false);
      destaque = d; forcar();
      const novo = alvo(); if (novo) novo.scrollIntoView({ inline: 'center', block: 'center' });
      App.dizer('Dia ' + Util.isoToPt(d) + ' destacado a azul' + (modoTab === 'lista' ? '.' : ' na tabela.'));
    });
    $('addFim').addEventListener('click', () => mudarIntervalo('fim'));
    $('addIni').addEventListener('click', () => mudarIntervalo('inicio'));
  }
  return { abrirDia, iniciar, focarHoje, rapido, acoes, editarMov: m => abrirReg({ mov: m }), apagarMov };
})();
Metas.iniciar(); Mov.iniciar(); Poup.iniciar(); Invest.iniciar(); Per.iniciar(); Analise.iniciar(); Calculos.iniciar(); Registo.iniciar();
App.iniciar();
