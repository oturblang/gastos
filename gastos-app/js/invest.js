'use strict';
/* Ecrã Investimentos: capital investido, histórico, recorrentes semanais (criar, editar, pausar, apagar) e meta. */
const Invest = (() => {
  const $ = id => document.getElementById(id);
  const E = App.E;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tile = (r, v, x) => '<div class="tile"><dt>' + r + '</dt><dd class="v">' + v + '</dd>' + (x ? '<dd class="sub">' + x + '</dd>' : '') + '</div>';
  let recId = null, limite = 100;
  const dataLonga = iso => Calc.diaSemana(iso) + ' ' + Util.isoToPt(iso);

  function estado(r, hoje) {
    if (r.endDate && r.endDate < hoje) return 'Terminada';
    return r.active ? 'Ativa' : 'Pausada';
  }
  function desenhar() {
    const v = $('vInvest');
    if (!E.settings.configured) { v.innerHTML = '<h2>Investimentos</h2><p class="vazio">Define primeiro os valores iniciais no Início.</p>'; return; }
    const hoje = Util.todayISO(), tot = Calc.total(E.settings, E.movs, '9999-12-31');
    const invs = E.movs.filter(m => m.type === 'investimento').sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);
    const soma = invs.reduce((a, m) => a + m.cents, 0);
    const recs = [...E.recs].sort((a, b) => a.startDate < b.startDate ? -1 : 1);
    const lr = recs.map(r => {
      const st = estado(r, hoje), px = Calc.proxima(r, hoje);
      return '<li><span><strong>' + Util.fmtEUR(r.cents) + '</strong> · ' + Calc.textoSemana(r.weekday) + (r.note ? ' · ' + esc(r.note) : '') + '<br>' +
        'Desde ' + Util.isoToPt(r.startDate) + ' · ' + (r.endDate ? 'até ' + Util.isoToPt(r.endDate) : 'sem data de fim') + '<br>' +
        '<span class="estado">' + st + '</span>' + (px ? ' · Próximo: ' + dataLonga(px) : '') + '</span>' +
        '<span><button type="button" class="peq" data-rec-ed="' + r.id + '">Editar</button>' +
        '<button type="button" class="peq" data-rec-pa="' + r.id + '">' + (r.active ? 'Pausar' : 'Retomar') + '</button>' +
        '<button type="button" class="peq perigo" data-rec-ap="' + r.id + '">Apagar</button></span></li>';
    }).join('');
    const lh = invs.slice(0, limite).map(m => '<li><button type="button" class="hrow" data-mov="' + m.id + '" aria-label="Investimento de ' + Util.isoToPt(m.date) + ', ' + Util.fmtEUR(m.cents) + '. Abrir opções">' +
      '<span class="h-esq"><strong>' + (m.recId != null ? 'Recorrente' : 'Manual') + '</strong><small>' + Util.isoToPt(m.date) + (m.desc ? ' · ' + esc(m.desc) : '') + '</small></span>' +
      '<span class="h-dir"><span class="h-val">' + Util.fmtEUR(m.cents) + '</span></span></button></li>').join('');
    v.innerHTML = '<h2>Investimentos</h2>' +
      '<dl class="kpis">' + tile('Capital investido', Util.fmtEUR(tot.capital), 'O dinheiro que colocaste, não o valor de mercado') + tile('Valor inicial investido', Util.fmtEUR(E.settings.initialInvested)) +
      tile('Investido desde o início', Util.fmtEUR(soma)) + tile('Nº de investimentos', String(invs.length)) + '</dl>' +
      '<div class="barra"><button type="button" id="iRap" class="primario">+ Registar investimento</button></div>' +
      Metas.bloco('investimento') +
      '<h3>Investimentos recorrentes</h3><p class="mut">Regras semanais: o valor sai da poupança e o investimento é criado no dia certo. Se ficares dias sem abrir a app, os que faltam são criados ao abrir.</p>' +
      (recs.length ? '<ul class="recs">' + lr + '</ul>' : '<p class="vazio">Ainda não há regras semanais.</p>') +
      '<button type="button" id="iNova">+ Nova regra semanal</button>' +
      '<h3>Histórico de investimentos</h3>' +
      (invs.length ? '<p class="mut peq-txt">Toca num investimento para o editar ou apagar.</p><ul class="hlist">' + lh + '</ul>' +
        (invs.length > limite ? '<button type="button" id="iMais">Mostrar mais</button>' : '') : '<p class="vazio">Ainda não há investimentos.</p>');
  }

  function abrirRec(r) {
    recId = r ? r.id : null;
    $('cTitulo').textContent = r ? 'Editar regra semanal' : 'Nova regra semanal';
    $('cDica').textContent = r ? 'As alterações valem daqui para a frente. Os investimentos já criados não mudam.' : 'Se a data de início já passou, os investimentos desde essa data são criados agora.';
    $('cValor').value = r ? Util.toInput(r.cents) : '';
    $('cDia').value = String(r ? r.weekday : 1);
    $('cIni').value = r ? r.startDate : Util.todayISO(); $('cIni').disabled = !!r;
    $('cFim').value = r && r.endDate ? r.endDate : '';
    $('cNota').value = r ? (r.note || '') : '';
    ['ecValor', 'ecIni', 'ecFim'].forEach(i => { $(i).textContent = ''; });
    $('dRec').showModal(); $('cValor').focus();
  }
  async function submeter(e) {
    e.preventDefault();
    ['ecValor', 'ecIni', 'ecFim'].forEach(i => { $(i).textContent = ''; });
    const c = Util.parseMoney($('cValor').value), ini = $('cIni').value, fim = $('cFim').value; let ok = true;
    if (c === null || c <= 0) { $('ecValor').textContent = 'Erro: escreve um valor maior que zero. Exemplo: 25,00'; ok = false; }
    if (!Util.validISO(ini)) { $('ecIni').textContent = 'Erro: escolhe uma data de início válida.'; ok = false; }
    if (fim && !Util.validISO(fim)) { $('ecFim').textContent = 'Erro: data de fim inválida (ou deixa em branco).'; ok = false; }
    else if (fim && Util.validISO(ini) && fim < ini) { $('ecFim').textContent = 'Erro: a data de fim não pode ser anterior à de início.'; ok = false; }
    if (!ok) return;
    const velha = recId != null ? E.recs.find(r => r.id === recId) : null;
    const o = velha ? { ...velha, cents: c, weekday: Number($('cDia').value), endDate: fim || null, note: $('cNota').value.trim() }
      : { cents: c, weekday: Number($('cDia').value), startDate: ini, endDate: fim || null, active: true, note: $('cNota').value.trim() };
    try {
      await DB.put('recurrences', o); $('dRec').close();
      const n = await DB.gerarRecorrentes(Util.todayISO()); await App.carregar(); App.atualizar();
      App.dizer('Regra guardada.' + (n ? ' ' + n + (n === 1 ? ' investimento criado' : ' investimentos criados') + ' até hoje.' : ''));
    } catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
  }
  async function pausar(r) {
    const novo = r.active ? { ...r, active: false } : { ...r, active: true, lastGen: Calc.addDays(Util.todayISO(), -1) };   // ao retomar não preenche o tempo em pausa
    try {
      await DB.put('recurrences', novo); await App.carregar(); App.atualizar();
      if (novo.active) { await App.gerarRec(); App.dizer('Regra retomada. Volta a investir a partir de hoje; o tempo em pausa não é preenchido.'); }
      else App.dizer('Regra pausada. Os investimentos já criados mantêm-se.');
    } catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
  }
  async function apagar(r) {
    if (!await App.confirmar('Apagar esta regra?', Util.fmtEUR(r.cents) + ' · ' + Calc.textoSemana(r.weekday) + '.\nOs investimentos já criados ficam no histórico. Para parar sem apagar, usa «Pausar».', 'Apagar regra')) return;
    try {
      await DB.del('recurrences', r.id); await App.carregar(); App.atualizar();
      App.dizer('Regra apagada.', true, { rotulo: 'Desfazer', fn: async () => { await DB.put('recurrences', r); await App.carregar(); App.atualizar(); App.dizer('Regra reposta.'); } });
    } catch (err) { App.dizer('Não foi possível apagar: ' + err.message, false); }
  }
  function iniciar() {
    App.aoAtualizar(desenhar);
    $('fRec').addEventListener('submit', submeter);
    $('cCancel').addEventListener('click', () => $('dRec').close());
    $('vInvest').addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      const rec = id => E.recs.find(r => r.id === Number(id));
      if (t.id === 'iRap') Registo.rapido('investimento');
      else if (t.id === 'iNova') abrirRec();
      else if (t.id === 'iMais') { limite += 100; desenhar(); }
      else if (t.dataset.recEd) abrirRec(rec(t.dataset.recEd));
      else if (t.dataset.recPa) pausar(rec(t.dataset.recPa));
      else if (t.dataset.recAp) apagar(rec(t.dataset.recAp));
      else if (t.dataset.mov) Registo.acoes(E.movs.find(m => m.id === Number(t.dataset.mov)));
    });
  }
  return { iniciar, desenhar };
})();
