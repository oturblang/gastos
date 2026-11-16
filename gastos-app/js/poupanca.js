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
      return '<tr><td>' + Util.isoToPt(m.date) + '</td><td><strong>' + NOME[m.type] + '</strong>' + (m.recId != null ? ' (recorrente)' : '') + (nota ? '<br>' + esc(nota) : '') + '</td>' +
        '<td class="num">' + (ef < 0 ? '− ' : '+ ') + Util.fmtEUR(Math.abs(ef)) + '</td><td class="num">' + Util.fmtEUR(saldo) + '</td>' +
        '<td><button type="button" class="peq" data-ed="' + m.id + '" aria-label="Editar ' + NOME[m.type] + ' de ' + Util.isoToPt(m.date) + '">Editar</button>' +
        '<button type="button" class="peq perigo" data-ap="' + m.id + '" aria-label="Apagar ' + NOME[m.type] + ' de ' + Util.isoToPt(m.date) + '">Apagar</button></td></tr>';
    }).join('');
    v.innerHTML = '<h2>Poupança</h2>' +
      '<dl class="kpis">' + tile('Saldo da poupança', Util.fmtEUR(tot.poup), tot.poup < 0 ? 'Atenção: o saldo está negativo.' : '') + tile('Saldo inicial', Util.fmtEUR(E.settings.initialSavings)) + '</dl>' +
      '<div class="barra"><button type="button" id="pDin" class="primario">+ Adicionar dinheiro</button><button type="button" id="pAj">Ajuste manual</button></div>' +
      '<p class="mut">Todo o dinheiro que recebes entra aqui e é daqui que saem os gastos e os investimentos. Usa o ajuste manual para acertar com o saldo real da conta.</p>' +
      Metas.bloco('poupanca') + '<h3>Histórico</h3>' +
      (h.length ? '<div class="scroll"><table class="simples hist"><thead><tr><th scope="col">Data</th><th scope="col">Movimento</th><th scope="col" class="num">Valor</th><th scope="col" class="num">Saldo depois</th><th scope="col"><span class="sr">Ações</span></th></tr></thead><tbody>' + linhas +
        '<tr><td>' + Util.isoToPt(E.settings.startDate) + '</td><td><strong>Saldo inicial</strong></td><td class="num"></td><td class="num">' + Util.fmtEUR(E.settings.initialSavings) + '</td><td></td></tr></tbody></table></div>' +
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
      else if (t.dataset.ed) Registo.editarMov(E.movs.find(m => m.id === Number(t.dataset.ed)));
      else if (t.dataset.ap) Registo.apagarMov(E.movs.find(m => m.id === Number(t.dataset.ap)));
    });
  }
  return { iniciar, desenhar };
})();
