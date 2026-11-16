'use strict';
/* Resumo do Início: números calculados a partir dos movimentos (nada é guardado aqui). */
const Demo = (() => {
  const $ = id => document.getElementById(id);
  const E = App.E;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TEXTO = { dia: 'Últimos 14 dias', semana: 'Últimas 8 semanas (cada semana começa à segunda)', mes: 'Últimos 12 meses', ano: 'Últimos 5 anos' };
  let modo = 'dia';

  function delta(atual, antes, boaSubida) {
    if (antes === 0) return atual === 0 ? '' : '<span class="neutro">sem período anterior para comparar</span>';
    const p = Math.round((atual - antes) / antes * 100);
    if (p === 0) return '<span class="neutro">= igual ao período anterior</span>';
    const sobe = p > 0, bom = sobe === boaSubida;
    return '<span class="' + (bom ? 'bom' : 'mau') + '">' + (sobe ? '▲ +' : '▼ ') + p + ' %</span> <span class="neutro">vs período anterior</span>';
  }
  const tile = (rot, val, extra, cl) => '<div class="tile' + (cl ? ' ' + cl : '') + '"><dt>' + rot + '</dt><dd class="v">' + val + '</dd>' + (extra ? '<dd class="sub">' + extra + '</dd>' : '') + '</div>';

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
      tile('Poupança atual', Util.fmtEUR(tot.poup), '', 'hero') + tile('Capital investido', Util.fmtEUR(tot.capital)) + tile('Gastos deste mês', Util.fmtEUR(Calc.gastosMes(movs, hoje))) +
      tile('Ganhos', Util.fmtEUR(soma('ganho')), delta(soma('ganho'), antes('ganho'), true)) +
      tile('Gastos', Util.fmtEUR(soma('gasto')), delta(soma('gasto'), antes('gasto'), false)) +
      tile('Investido no período', Util.fmtEUR(soma('investimento')), delta(soma('investimento'), antes('investimento'), true)) +
      tile('Dias com investimento', inv + ' de ' + dias, 'No período escolhido');
    $('metasDemo').innerHTML = Metas.html('poupanca', true) + Metas.html('investimento', true);
    $('demoVazio').hidden = movs.length !== 0;
  }

  $('periodos').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (b) { modo = b.dataset.m; desenhar(); } });
  App.aoAtualizar(desenhar);
  document.addEventListener('vista', e => { if (e.detail === 'Inicio') desenhar(); });
  Graficos.iniciarTip();
  return { desenhar };
})();
