'use strict';
/* Ecrã Poupança: saldo, histórico de todos os movimentos, adicionar dinheiro e ajuste manual. */
const Poup = (() => {
  const $ = id => document.getElementById(id);
  const E = App.E;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NOME = { ganho: 'Ganho', gasto: 'Gasto', investimento: 'Investimento', ajuste: 'Ajuste' };
  const tile = (r, v, x) => '<div class="tile"><dt>' + r + '</dt><dd class="v">' + v + '</dd>' + (x ? '<dd class="sub">' + x + '</dd>' : '') + '</div>';
  let limite = 100;

  function desenhar() {
    const v = $('vPoupanca');
    if (!E.settings.configured) { v.innerHTML = '<h2>Poupança</h2><p class="vazio">Define primeiro os valores iniciais no Início.</p>'; return; }
    const tot = Calc.total(E.settings, E.movs, '9999-12-31'), h = Calc.historico(E.settings, E.movs).reverse();
    const catNome = id => { const c = E.cats.find(x => x.id === id); return c ? c.name : ''; };
    const linhas = h.slice(0, limite).map(({ m, saldo }) => {
      const ef = Calc.efeito(m), nota = [catNome(m.categoryId), m.desc].filter(Boolean).join(' · ');
      return '<li><button type="button" class="hrow" data-mov="' + m.id + '" aria-label="' + NOME[m.type] + ' de ' + Util.isoToPt(m.date) + ', ' + (ef < 0 ? 'menos ' : 'mais ') + Util.fmtEUR(Math.abs(ef)) + '. Abrir opções">' +
        '<span class="h-esq"><strong>' + NOME[m.type] + '</strong>' + (m.recId != null ? ' (recorrente)' : '') + '<small>' + Util.isoToPt(m.date) + (nota ? ' · ' + esc(nota) : '') + '</small></span>' +
        '<span class="h-dir"><span class="h-val">' + (ef < 0 ? '− ' : '+ ') + Util.fmtEUR(Math.abs(ef)) + '</span><small>Saldo ' + Util.fmtEUR(saldo) + '</small></span></button></li>';
    }).join('');
    v.innerHTML = '<h2>Poupança</h2>' +
      '<dl class="kpis">' + tile('Saldo da poupança', Util.fmtEUR(tot.poup), tot.poup < 0 ? 'Atenção: o saldo está negativo.' : '') + tile('Saldo inicial', Util.fmtEUR(E.settings.initialSavings)) + '</dl>' +
      '<div class="barra"><button type="button" id="pDin" class="primario">+ Adicionar dinheiro</button><button type="button" id="pAj">Ajuste manual</button></div>' +
      '<p class="mut">Todo o dinheiro que recebes entra aqui e é daqui que saem os gastos e os investimentos. Usa o ajuste manual para acertar com o saldo real da conta.</p>' +
      Metas.bloco('poupanca') + '<h3>Histórico</h3>' +
      (h.length ? '<p class="mut peq-txt">Toca num movimento para o editar ou apagar.</p><ul class="hlist">' + linhas +
        '<li class="hrow ini"><span class="h-esq"><strong>Saldo inicial</strong><small>' + Util.isoToPt(E.settings.startDate) + '</small></span><span class="h-dir"><span class="h-val">' + Util.fmtEUR(E.settings.initialSavings) + '</span></span></li></ul>' +
        (h.length > limite ? '<button type="button" id="pMais">Mostrar mais</button>' : '')
        : '<p class="vazio">Ainda não há movimentos. Usa «+ Adicionar dinheiro» ou preenche a Tabela.</p>');
  }
  function iniciar() {
    App.aoAtualizar(desenhar);
    $('vPoupanca').addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.id === 'pDin') Registo.rapido('ganho');
      else if (t.id === 'pAj') Registo.rapido('ajuste');
      else if (t.id === 'pMais') { limite += 100; desenhar(); }
      else if (t.dataset.mov) Registo.acoes(E.movs.find(m => m.id === Number(t.dataset.mov)));
    });
  }
  return { iniciar, desenhar };
})();
