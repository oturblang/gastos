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
    ['sobra', 'Sobra do dia', false], ['poup', 'Poupança', false], ['capital', 'Capital investido', false]];
  function desenharTabela() {
    const cfg = E.settings.configured;
    $('tabVazia').hidden = cfg; $('tabConteudo').hidden = !cfg;
    if (!cfg) { assinatura = ''; $('tab').textContent = ''; return; }
    const { de, n } = intervalo(), cols = Calc.serie(E.settings, E.movs, de, n), hoje = Util.todayISO();
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
        else if (c.n[k] > 1) h += '<td' + cl + '><button type="button" class="dia" data-dia="' + c.date + '" aria-label="' + nome + ' ' + Util.isoToPt(c.date) + ': ' + c.n[k] + ' movimentos, abrir o dia">' + Util.fmtEUR(c.v[k]) + '</button></td>';
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
  /** Editar uma célula: sem movimento cria um; com um movimento altera-o; vazio ou 0 apaga (com confirmação). */
  async function celula(inp) {
    const { date, tipo } = inp.dataset, c = Util.parseMoney(inp.value);
    const existentes = E.movs.filter(m => m.date === date && m.type === tipo);
    try {
      if (c === null || (tipo !== 'ajuste' && c < 0)) { App.dizer('Valor inválido. Exemplo: 1 234,56', false); return forcar(); }
      if (existentes.length > 1) return forcar();
      if (c === 0) { if (existentes.length === 1) return apagarMov(existentes[0]); return forcar(); }
      if (existentes.length === 1) await DB.put('movements', { ...existentes[0], cents: c });
      else await DB.put('movements', { date, type: tipo, cents: c, categoryId: null, desc: '' });
      await depoisDeGuardar('Guardado: ' + NOME[tipo] + ' ' + Util.fmtEUR(c) + ' em ' + Util.isoToPt(date) + '.');
    } catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
  }
  function focarHoje() { const th = $('tab').querySelector('th.hoje'); if (th) th.scrollIntoView({ inline: 'center', block: 'nearest' }); }
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
    $('vDia').innerHTML = '<button type="button" id="dVoltar">Voltar à tabela</button><h2>' + Calc.diaSemana(d) + ', ' + Util.isoToPt(d) + '</h2>' +
      '<label for="dDesc">Descrição do dia</label><textarea id="dDesc">' + esc(desc) + '</textarea>' +
      '<button type="button" id="dGuardar" class="primario">Guardar descrição</button><h3>Movimentos</h3>' +
      (movs.length ? '<ul class="movs">' + movs.map(m => '<li><span><strong>' + NOME[m.type] + '</strong> ' + Util.fmtEUR(m.cents) + '<br>' + esc(catNome(m.categoryId)) +
        (m.desc ? ' - ' + esc(m.desc) : '') + '</span><span><button type="button" data-ed="' + m.id + '">Editar</button><button type="button" class="perigo" data-ap="' + m.id + '">Apagar</button></span></li>').join('') + '</ul>'
        : '<p>Sem movimentos neste dia.</p>') + '<button type="button" id="dAdd" class="primario">+ Adicionar movimento</button><button type="button" id="dApagarDia" class="perigo">Apagar este dia</button>';
  }
  function abrirDia(d) { diaAtual = d; desenharDia(); App.ir('Dia'); }
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
      await recarregar(); if (!$('vDia').hidden) App.ir('Tabela');
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
  function dica() { $('rDica').hidden = $('rTipo').value !== 'ajuste'; }
  function abrirReg({ date, mov }) {
    editId = mov ? mov.id : null;
    $('rTitulo').textContent = mov ? 'Editar movimento' : 'Registar movimento';
    $('rTipo').value = mov ? mov.type : 'gasto';
    $('rValor').value = mov ? Util.toInput(mov.cents) : '';
    $('rData').value = mov ? mov.date : date;
    $('rDesc').value = mov ? (mov.desc || '') : '';
    const lista = E.cats.filter(c => !c.archived || (mov && mov.categoryId === c.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    $('rCat').innerHTML = '<option value="">Sem categoria</option>' + lista.map(c => '<option value="' + c.id + '">' + esc(c.name) + (c.archived ? ' (arquivada)' : '') + '</option>').join('');
    $('rCat').value = mov && mov.categoryId != null ? String(mov.categoryId) : '';
    $('eValor').textContent = ''; $('eData').textContent = '';
    dica(); $('dReg').showModal(); $('rValor').focus();
  }
  async function submeterReg(e) {
    e.preventDefault();
    $('eValor').textContent = ''; $('eData').textContent = '';
    const tipo = $('rTipo').value, c = Util.parseMoney($('rValor').value), data = $('rData').value;
    let ok = true;
    if (c === null || c === 0 || (tipo !== 'ajuste' && c < 0)) { $('eValor').textContent = 'Erro: escreve um valor válido, maior que zero. Exemplo: 12,50'; ok = false; }
    if (!Util.validISO(data)) { $('eData').textContent = 'Erro: escolhe uma data válida.'; ok = false; }
    if (!ok) return;
    const obj = { date: data, type: tipo, cents: c, categoryId: $('rCat').value ? Number($('rCat').value) : null, desc: $('rDesc').value.trim() };
    if (editId != null) Object.assign(obj, { ...(E.movs.find(m => m.id === editId) || {}), ...obj, id: editId });
    try { await DB.put('movements', obj); $('dReg').close(); await depoisDeGuardar('Movimento guardado: ' + NOME[tipo] + ' ' + Util.fmtEUR(c) + ' em ' + Util.isoToPt(data) + '.'); }
    catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
  }

  function iniciar() {
    App.aoAtualizar(() => { desenharTabela(); desenharDia(); });
    document.addEventListener('vista', e => { if (e.detail === 'Tabela') setTimeout(focarHoje, 0); });
    $('tab').addEventListener('change', e => { if (e.target.matches('input[data-tipo]')) celula(e.target); });
    $('tab').addEventListener('click', e => { const b = e.target.closest('[data-dia]'); if (b) abrirDia(b.dataset.dia); });
    $('tab').addEventListener('keydown', e => {   // Enter desce para a linha de baixo, como no Excel
      if (e.key !== 'Enter' || !e.target.matches('input[data-tipo]')) return;
      e.preventDefault();
      const prox = $('tab').querySelector('input[data-date="' + e.target.dataset.date + '"][data-tipo="' + EDIT[EDIT.indexOf(e.target.dataset.tipo) + 1] + '"]');
      if (prox) { prox.focus(); prox.select(); } else e.target.blur();
    });
    $('vDia').addEventListener('click', e => {
      const t = e.target;
      if (t.id === 'dVoltar') App.ir('Tabela');
      else if (t.id === 'dGuardar') guardarDesc();
      else if (t.id === 'dAdd') abrirReg({ date: diaAtual });
      else if (t.id === 'dApagarDia') apagarDia(diaAtual);
      else if (t.dataset.ed) abrirReg({ mov: E.movs.find(m => m.id === Number(t.dataset.ed)) });
      else if (t.dataset.ap) apagarMov(E.movs.find(m => m.id === Number(t.dataset.ap)));
    });
    $('vDia').addEventListener('change', e => { if (e.target.id === 'dDesc') guardarDesc(); });
    $('fab').addEventListener('click', () => abrirReg({ date: !$('vDia').hidden && diaAtual ? diaAtual : Util.todayISO() }));
    $('fReg').addEventListener('submit', submeterReg);
    $('fQuick').addEventListener('submit', submeterQuick);
    $('qCancel').addEventListener('click', () => $('dQuick').close());
    $('rCancel').addEventListener('click', () => $('dReg').close());
    $('rTipo').addEventListener('change', dica);
    $('bHoje').addEventListener('click', () => { destaque = null; forcar(); focarHoje(); });
    $('remIni').addEventListener('click', () => apagarDia(intervalo().de));
    $('remFim').addEventListener('click', () => apagarDia(intervalo().ate));
    $('fIr').addEventListener('submit', e => {
      e.preventDefault();
      const d = $('irData').value, th = Util.validISO(d) && $('tab').querySelector('th[data-date="' + d + '"]');
      if (!th) return App.dizer('Escolhe uma data que esteja na tabela. Usa «Adicionar dias» para criar mais colunas.', false);
      destaque = d; forcar();
      const novo = $('tab').querySelector('th[data-date="' + d + '"]'); if (novo) novo.scrollIntoView({ inline: 'center', block: 'nearest' });
      App.dizer('Dia ' + Util.isoToPt(d) + ' destacado a azul na tabela.');
    });
    $('addFim').addEventListener('click', () => mudarIntervalo('fim'));
    $('addIni').addEventListener('click', () => mudarIntervalo('inicio'));
  }
  return { iniciar, focarHoje, rapido, editarMov: m => abrirReg({ mov: m }), apagarMov };
})();
Metas.iniciar(); Poup.iniciar(); Invest.iniciar(); Registo.iniciar();
App.iniciar();
