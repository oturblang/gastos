'use strict';
/* Demonstração: números e gráficos calculados a partir dos movimentos (nada é guardado aqui). */
const Demo = (() => {
  const $ = id => document.getElementById(id);
  const E = App.E;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TEXTO = { dia: 'Últimos 14 dias', semana: 'Últimas 8 semanas (cada semana começa à segunda)', mes: 'Últimos 12 meses', ano: 'Últimos 5 anos' };
  const UNIDADE = { dia: 'dia', semana: 'semana', mes: 'mês', ano: 'ano' };
  let modo = 'dia';

  function delta(atual, antes, boaSubida) {
    if (antes === 0) return atual === 0 ? '' : '<span class="neutro">sem período anterior para comparar</span>';
    const p = Math.round((atual - antes) / antes * 100);
    if (p === 0) return '<span class="neutro">= igual ao período anterior</span>';
    const sobe = p > 0, bom = sobe === boaSubida;
    return '<span class="' + (bom ? 'bom' : 'mau') + '">' + (sobe ? '▲ +' : '▼ ') + p + ' %</span> <span class="neutro">vs período anterior</span>';
  }
  const tile = (rot, val, extra) => '<div class="tile"><dt>' + rot + '</dt><dd class="v">' + val + '</dd>' + (extra ? '<dd class="sub">' + extra + '</dd>' : '') + '</div>';
  const legenda = itens => '<ul class="legenda">' + itens.map(([n, c]) => '<li><span class="sw" style="background:' + c + '"></span>' + n + '</li>').join('') + '</ul>';

  function desenhar() {
    const sec = $('secDemo');
    if (!E.settings.configured) { sec.hidden = true; return; }
    sec.hidden = false;
    const hoje = Util.todayISO(), keys = Calc.janela(modo, hoje), de = Calc.inicioDe(keys[0], modo), movs = E.movs;
    const dias = Calc.diasEntre(de, hoje) + 1, pDe = Calc.addDays(de, -dias), pAte = Calc.addDays(de, -1);
    const soma = t => Calc.somaTipo(movs, t, de, hoje), antes = t => Calc.somaTipo(movs, t, pDe, pAte);
    const tot = Calc.total(E.settings, movs, hoje), inv = Calc.diasComInvestimento(movs, de, hoje);
    $('periodoTxt').textContent = TEXTO[modo];
    document.querySelectorAll('#periodos button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === modo)));
    $('kpis').innerHTML =
      tile('Poupança atual', Util.fmtEUR(tot.poup)) + tile('Capital investido', Util.fmtEUR(tot.capital)) + tile('Gastos deste mês', Util.fmtEUR(Calc.gastosMes(movs, hoje))) +
      tile('Ganhos', Util.fmtEUR(soma('ganho')), delta(soma('ganho'), antes('ganho'), true)) +
      tile('Gastos', Util.fmtEUR(soma('gasto')), delta(soma('gasto'), antes('gasto'), false)) +
      tile('Investido no período', Util.fmtEUR(soma('investimento')), delta(soma('investimento'), antes('investimento'), true)) +
      tile('Dias com investimento', inv + ' de ' + dias, 'No período escolhido');
    $('metasDemo').innerHTML = Metas.html('poupanca', true) + Metas.html('investimento', true);
    const vazio = movs.length === 0;
    $('demoVazio').hidden = !vazio; $('demoGraficos').hidden = vazio;
    if (vazio) return;

    const rot = keys.map(k => Calc.rotulo(k, modo)), tit = keys.map(k => Calc.titulo(k, modo));
    const g = Calc.agrupar(movs, modo, keys), ev = Calc.evolucao(E.settings, movs, modo, keys, hoje);
    Graficos.barras($('gBarras'), g, rot, tit, 'Barras por ' + UNIDADE[modo] + ': ganhos ' + Util.fmtEUR(soma('ganho')) + ', gastos ' + Util.fmtEUR(soma('gasto')) + ' e investido ' + Util.fmtEUR(soma('investimento')) + ' no total do período.');
    $('lgBarras').innerHTML = legenda([['Ganhos', Graficos.COR.ganho], ['Gastos', Graficos.COR.gasto], ['Investido', Graficos.COR.investimento]]);
    $('tbBarras').innerHTML = '<thead><tr><th scope="col">Período</th><th scope="col">Ganhos</th><th scope="col">Gastos</th><th scope="col">Investido</th></tr></thead><tbody>' +
      g.map((x, i) => '<tr><th scope="row">' + esc(tit[i]) + '</th><td>' + Util.fmtEUR(x.ganho) + '</td><td>' + Util.fmtEUR(x.gasto) + '</td><td>' + Util.fmtEUR(x.investimento) + '</td></tr>').join('') + '</tbody>';
    const u = ev[ev.length - 1];
    Graficos.linha($('gLinha'), ev, rot, tit, 'Evolução: poupança de ' + Util.fmtEUR(u.poup) + ' e capital investido de ' + Util.fmtEUR(u.capital) + ' no fim do período.');
    $('lgLinha').innerHTML = legenda([['Poupança', Graficos.COR.poupanca], ['Capital investido', Graficos.COR.capital]]);

    // gastos por categoria (as 6 maiores; o resto junta-se em "Outras")
    const mapa = Calc.gastosPorCategoria(movs, de, hoje), totalG = [...mapa.values()].reduce((a, b) => a + b, 0);
    const lista = [...mapa.entries()].map(([id, c]) => ({ nome: id == null ? 'Sem categoria' : ((E.cats.find(x => x.id === id) || {}).name || 'Categoria apagada'), cents: c })).sort((a, b) => b.cents - a.cents);
    let fatias = lista;
    if (lista.length > 6) { const resto = lista.slice(5).reduce((a, b) => a + b.cents, 0); fatias = lista.slice(0, 5).concat([{ nome: 'Outras', cents: resto, outras: true }]); }
    if (!totalG) $('gDonut').innerHTML = '<p class="mut">Sem gastos neste período.</p>';
    else Graficos.circulo($('gDonut'), fatias, totalG, 'Gastos por categoria no período: ' + fatias.map(f => f.nome + ' ' + Util.fmtEUR(f.cents)).join(', ') + '.');
  }

  $('periodos').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (b) { modo = b.dataset.m; desenhar(); } });
  App.aoAtualizar(desenhar);
  document.addEventListener('vista', e => { if (e.detail === 'Inicio') desenhar(); });
  let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (!$('vInicio').hidden) desenhar(); }, 150); });
  Graficos.iniciarTip();
  return { desenhar };
})();
