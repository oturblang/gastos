'use strict';
/* Períodos (por exemplo uma viagem): lista e página de cada um. Um período é só uma vista filtrada dos dias normais:
   os movimentos continuam a viver nos dias e contam também nos totais globais. */
const Per = (() => {
  const $ = id => document.getElementById(id);
  const E = App.E;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tile = (r, v, x) => '<div class="tile"><dt>' + r + '</dt><dd class="v">' + v + '</dd>' + (x ? '<dd class="sub">' + x + '</dd>' : '') + '</div>';
  const legenda = itens => '<ul class="legenda">' + itens.map(([n, c]) => '<li><span class="sw" style="background:' + c + '"></span>' + n + '</li>').join('') + '</ul>';
  const intervalo = p => Util.isoToPt(p.start) + ' a ' + Util.isoToPt(p.end);
  const dias = p => { const n = Calc.diasDe(p); return n + (n === 1 ? ' dia' : ' dias'); };
  let abertoId = null, editId = null;

  // ---------- Lista ----------
  function desenharLista() {
    const v = $('vPeriodos');
    if (!E.settings.configured) { v.innerHTML = '<h2>Períodos</h2><p class="vazio">Define primeiro os valores iniciais no Início.</p>'; return; }
    const lista = [...E.pers].sort((a, b) => a.start < b.start ? 1 : -1);
    v.innerHTML = '<h2>Períodos</h2><p class="mut">Um período (por exemplo uma viagem) agrupa dias seguidos para veres os totais, os gráficos e as categorias só desse intervalo. Os movimentos continuam nos dias normais.</p>' +
      '<button type="button" id="perNovo" class="primario">+ Novo período</button>' +
      (lista.length ? '<ul class="pers">' + lista.map(p => { const r = Calc.resumoPeriodo(E.settings, E.movs, p);
        return '<li><button type="button" class="item" data-abrir="' + p.id + '"><span class="nm">' + esc(p.name) + '</span><br><span class="sub">' + intervalo(p) + ' · ' + dias(p) + '</span><br>Gastos: <strong>' + Util.fmtEUR(r.gasto) + '</strong></button></li>'; }).join('') + '</ul>'
        : '<p class="vazio">Ainda não há períodos. Carrega em «+ Novo período» para criar o primeiro.</p>');
  }

  // ---------- Página do período ----------
  const RUB = [['ganho', 'Ganhos'], ['gasto', 'Gastos'], ['investimento', 'Investido'], ['ajuste', 'Ajustes'], ['sobra', 'Sobra do dia'], ['poup', 'Poupança'], ['capital', 'Capital investido']];
  function desenharDetalhe() {
    const v = $('vPeriodo'), p = E.pers.find(x => x.id === abertoId);
    if (!p) { v.textContent = ''; if (!v.hidden) App.ir('Periodos'); return; }
    const r = Calc.resumoPeriodo(E.settings, E.movs, p), cols = Calc.serie(E.settings, E.movs, p.start, r.dias), tem = E.movs.some(m => m.date >= p.start && m.date <= p.end);
    let tab = '<thead><tr><th scope="col">Rubrica</th>' + cols.map(c => '<th scope="col"><button type="button" class="dia" data-dia="' + c.date + '">' + Calc.diaSemana(c.date) + ' ' + c.date.slice(8) + '/' + c.date.slice(5, 7) + '</button></th>').join('') + '<th scope="col">Total</th></tr></thead><tbody>';
    for (const [k, nome] of RUB) {
      const soma = k === 'ganho' || k === 'gasto' || k === 'investimento' || k === 'ajuste' ? Util.fmtEUR(r[k]) : k === 'sobra' ? Util.fmtEUR(r.sobra) : '';
      tab += '<tr><th scope="row">' + nome + '</th>' + cols.map(c => '<td>' + Util.fmtEUR(k === 'ganho' || k === 'gasto' || k === 'investimento' || k === 'ajuste' ? c.v[k] : c[k]) + '</td>').join('') + '<td><strong>' + soma + '</strong></td></tr>';
    }
    v.innerHTML = '<button type="button" id="perVoltar">Voltar aos períodos</button><h2>' + esc(p.name) + '</h2>' +
      '<p class="mut">' + intervalo(p) + ' · ' + dias(p) + '</p>' + (p.note ? '<p class="nota-per">' + esc(p.note) + '</p>' : '') +
      '<div class="barra"><button type="button" id="perEd">Editar</button><button type="button" id="perAp" class="perigo">Apagar período</button></div>' +
      '<dl class="kpis">' + tile('Ganhos', Util.fmtEUR(r.ganho)) + tile('Gastos', Util.fmtEUR(r.gasto), 'Média: ' + Util.fmtEUR(r.mediaGasto) + ' por dia') + tile('Investido', Util.fmtEUR(r.investimento)) +
      tile('Sobra do período', Util.fmtEUR(r.sobra), 'Ganhos − gastos − investimentos') + tile('Poupança no fim do período', Util.fmtEUR(r.poupFim)) + '</dl>' +
      '<h3>Tabela do período</h3><p class="mut">Mostra os mesmos dias da tabela principal. Toca num dia para o abrir e editar.</p>' +
      '<div class="scroll tabwrap"><table>' + tab + '</tbody></table></div>' +
      (tem ? '<figure class="graf"><figcaption>Ganhos, gastos e investido por dia</figcaption><div id="pgBarras"></div>' + legenda([['Ganhos', Graficos.COR.ganho], ['Gastos', Graficos.COR.gasto], ['Investido', Graficos.COR.investimento]]) + '</figure>' +
        '<figure class="graf"><figcaption>Gastos por categoria neste período</figcaption><div id="pgDonut"></div></figure>'
        : '<p class="vazio">Ainda não há movimentos neste período. Regista valores na Tabela e os gráficos aparecem aqui.</p>');
    if (!tem || v.hidden) return;
    const keys = cols.map(c => c.date), g = Calc.agrupar(E.movs, 'dia', keys);
    Graficos.barras($('pgBarras'), g, keys.map(k => Calc.rotulo(k, 'dia')), keys.map(k => Calc.titulo(k, 'dia')),
      'Barras por dia no período ' + p.name + ': ganhos ' + Util.fmtEUR(r.ganho) + ', gastos ' + Util.fmtEUR(r.gasto) + ' e investido ' + Util.fmtEUR(r.investimento) + '.');
    const mapa = Calc.gastosPorCategoria(E.movs, p.start, p.end), tot = [...mapa.values()].reduce((a, b) => a + b, 0);
    const lista = [...mapa.entries()].map(([id, c]) => ({ nome: id == null ? 'Sem categoria' : ((E.cats.find(x => x.id === id) || {}).name || 'Categoria apagada'), cents: c })).sort((a, b) => b.cents - a.cents);
    let fatias = lista;
    if (lista.length > 6) fatias = lista.slice(0, 5).concat([{ nome: 'Outras', cents: lista.slice(5).reduce((a, b) => a + b.cents, 0), outras: true }]);
    if (!tot) $('pgDonut').innerHTML = '<p class="mut">Sem gastos neste período.</p>';
    else Graficos.circulo($('pgDonut'), fatias, tot, 'Gastos por categoria no período: ' + fatias.map(f => f.nome + ' ' + Util.fmtEUR(f.cents)).join(', ') + '.');
  }
  function abrir(id) { abertoId = id; desenharDetalhe(); App.ir('Periodo'); }

  // ---------- Criar / editar / apagar ----------
  function abrirForm(p) {
    editId = p ? p.id : null;
    $('pTitulo').textContent = p ? 'Editar período' : 'Novo período';
    $('pNome').value = p ? p.name : ''; $('pIni').value = p ? p.start : Util.todayISO(); $('pFim').value = p ? p.end : ''; $('pNota').value = p ? (p.note || '') : '';
    ['epNome', 'epIni', 'epFim'].forEach(i => { $(i).textContent = ''; });
    $('dPer').showModal(); $('pNome').focus();
  }
  async function submeter(e) {
    e.preventDefault();
    ['epNome', 'epIni', 'epFim'].forEach(i => { $(i).textContent = ''; });
    const nome = $('pNome').value.trim(), ini = $('pIni').value, fim = $('pFim').value; let ok = true;
    if (!nome) { $('epNome').textContent = 'Erro: escreve um nome para o período.'; ok = false; }
    if (!Util.validISO(ini)) { $('epIni').textContent = 'Erro: escolhe uma data de início válida.'; ok = false; }
    if (!Util.validISO(fim)) { $('epFim').textContent = 'Erro: escolhe uma data de fim válida.'; ok = false; }
    else if (Util.validISO(ini) && fim < ini) { $('epFim').textContent = 'Erro: o fim não pode ser anterior ao início.'; ok = false; }
    if (!ok) return;
    const novo = { name: nome, start: ini, end: fim, note: $('pNota').value.trim() };
    const c = Calc.conflito(E.pers, novo, editId);
    if (c) { $('epIni').textContent = 'Erro: estas datas sobrepõem-se ao período «' + c.name + '» (' + intervalo(c) + '). Os períodos não podem sobrepor-se.'; return; }
    try {
      await DB.put('periods', editId != null ? { ...E.pers.find(x => x.id === editId), ...novo } : novo);
      $('dPer').close(); await App.carregar(); App.atualizar(); App.dizer('Período guardado: ' + nome + '.');
    } catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
  }
  async function apagar(p) {
    if (!await App.confirmar('Apagar este período?', '«' + p.name + '» (' + intervalo(p) + ').\nOs dias e os movimentos não são apagados: continuam na tabela e nos totais.', 'Apagar período')) return;
    try {
      await DB.del('periods', p.id); await App.carregar(); abertoId = null; App.atualizar(); App.ir('Periodos');
      App.dizer('Período apagado.', true, { rotulo: 'Desfazer', fn: async () => { await DB.put('periods', p); await App.carregar(); App.atualizar(); App.dizer('Período reposto.'); } });
    } catch (err) { App.dizer('Não foi possível apagar: ' + err.message, false); }
  }

  function iniciar() {
    App.aoAtualizar(() => { desenharLista(); desenharDetalhe(); });
    document.addEventListener('vista', e => { if (e.detail === 'Periodo') desenharDetalhe(); });
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (!$('vPeriodo').hidden) desenharDetalhe(); }, 150); });
    $('fPer').addEventListener('submit', submeter);
    $('pCancel').addEventListener('click', () => $('dPer').close());
    $('vPeriodos').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'perNovo') abrirForm(); else if (b.dataset.abrir) abrir(Number(b.dataset.abrir));
    });
    $('vPeriodo').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const p = E.pers.find(x => x.id === abertoId);
      if (b.id === 'perVoltar') App.ir('Periodos');
      else if (b.id === 'perEd' && p) abrirForm(p);
      else if (b.id === 'perAp' && p) apagar(p);
      else if (b.dataset.dia) Registo.abrirDia(b.dataset.dia);
    });
  }
  return { iniciar, abrir };
})();
