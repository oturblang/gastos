'use strict';
/* Página «Como são feitos os cálculos»: fórmulas em linguagem simples, cada uma com um exemplo feito com os dados do próprio utilizador.
   Os números do exemplo são somados à mão aqui e comparados com os da app. */
const Calculos = (() => {
  const $ = id => document.getElementById(id);
  const E = App.E, F = Util.fmtEUR;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NOME = { ganho: 'ganhos', gasto: 'gastos', investimento: 'investimentos', ajuste: 'ajustes' };
  const soma = (movs, tipo, de, ate) => movs.reduce((t, m) => t + (m.type === tipo && m.date >= de && m.date <= ate ? m.cents : 0), 0);
  const verif = (ok, certo, errado) => '<p class="verif ' + (ok ? 'certo' : 'errado') + '">' + (ok ? '✓ ' + certo : '✗ ' + errado) + '</p>';
  const sec = (titulo, regra, formula, exemplo) => '<h3>' + titulo + '</h3><p>' + regra + '</p>' + (formula ? '<p class="formula">' + formula + '</p>' : '') + (exemplo ? '<div class="exemplo">' + exemplo + '</div>' : '');

  function desenhar() {
    const v = $('vCalculos'), s = E.settings, movs = E.movs;
    if (!s.configured) { v.innerHTML = '<h2>Como são feitos os cálculos</h2><p class="vazio">Define primeiro os valores iniciais no Início. Depois, esta página mostra as contas com os teus números.</p>'; return; }
    const hoje = Util.todayISO(), dias = movs.filter(m => m.date <= hoje).map(m => m.date).sort(), d = dias.length ? dias[dias.length - 1] : null;
    let h = '<h2>Como são feitos os cálculos</h2><p class="mut">Todas as contas são refeitas a partir dos movimentos que registaste e dos valores iniciais. A app não guarda saldos: por isso, ao editar ou apagar um dia (mesmo antigo), tudo se atualiza. Os valores são guardados em cêntimos, para não haver erros de arredondamento.</p>';

    h += sec('1. Células vazias', 'Uma célula vazia ou sem valor conta como 0,00 €, em todas as contas. Nunca dá erro.', '', '');

    // Sobra do dia
    let ex = '';
    if (d) {
      const g = soma(movs, 'ganho', d, d), ga = soma(movs, 'gasto', d, d), iv = soma(movs, 'investimento', d, d), aj = soma(movs, 'ajuste', d, d), sobra = g - ga - iv;
      const col = Calc.serie(s, movs, d, 1)[0];
      ex = '<p>O teu último dia com movimentos é <strong>' + Util.isoToPt(d) + '</strong>:<br>ganhos ' + F(g) + ' − gastos ' + F(ga) + ' − investimentos ' + F(iv) + ' = <strong>' + F(sobra) + '</strong>' +
        (aj ? '<br>(Neste dia há também ajustes de ' + F(aj) + ', que não entram na sobra.)' : '') + '</p>' + verif(col.sobra === sobra, 'A Tabela mostra o mesmo valor.', 'A Tabela mostra ' + F(col.sobra) + ': há um erro, avisa-me.');
    } else ex = '<p>Ainda não tens movimentos. Quando registares o primeiro, o exemplo aparece aqui com os teus números.</p>';
    h += sec('2. Sobra do dia', 'É o que sobrou (ou faltou) nesse dia. É a variação da poupança nesse dia, sem contar com os ajustes manuais.', 'Sobra do dia = ganhos − gastos − investimentos desse dia', ex);

    // Poupança
    const ate = d || hoje, T = ['ganho', 'gasto', 'investimento', 'ajuste'].map(t => soma(movs, t, '0000-01-01', ate)), tot = Calc.total(s, movs, ate);
    const poupMao = (s.initialSavings || 0) + T[0] - T[1] - T[2] + T[3];
    h += sec('3. Poupança', 'É a conta central: todo o dinheiro que recebes entra nela e é dela que saem os gastos e os investimentos (incluindo os recorrentes). Os ajustes servem para acertar com o saldo real da tua conta.',
      'Poupança = saldo inicial + ganhos − gastos − investimentos ± ajustes',
      '<p>Até ' + Util.isoToPt(ate) + ':<br>' + F(s.initialSavings || 0) + ' (saldo inicial) + ' + F(T[0]) + ' (ganhos) − ' + F(T[1]) + ' (gastos) − ' + F(T[2]) + ' (investimentos) ' + (T[3] < 0 ? '− ' + F(-T[3]) : '+ ' + F(T[3])) + ' (ajustes) = <strong>' + F(poupMao) + '</strong></p>' +
      verif(tot.poup === poupMao, 'A app calcula o mesmo valor.', 'A app calcula ' + F(tot.poup) + ': há um erro, avisa-me.'));

    // Capital
    const capMao = (s.initialInvested || 0) + T[2];
    h += sec('4. Capital investido', 'É o dinheiro que colocaste em investimentos, não o valor de mercado. Não sobe nem desce com a bolsa.', 'Capital investido = valor inicial investido + todos os investimentos',
      '<p>' + F(s.initialInvested || 0) + ' (valor inicial) + ' + F(T[2]) + ' (investimentos) = <strong>' + F(capMao) + '</strong></p>' + verif(tot.capital === capMao, 'A app calcula o mesmo valor.', 'A app calcula ' + F(tot.capital) + ': há um erro, avisa-me.'));

    // Semana, mês, ano
    let exT = '<p>Ainda não há movimentos.</p>';
    if (d) {
      const sem = Calc.chave(d, 'semana'), mes = d.slice(0, 7), ano = d.slice(0, 4);
      const lin = (nome, de, fim) => '<br>' + nome + ' (' + Util.isoToPt(de) + ' a ' + Util.isoToPt(fim) + '): gastos <strong>' + F(soma(movs, 'gasto', de, fim)) + '</strong>, ganhos <strong>' + F(soma(movs, 'ganho', de, fim)) + '</strong>, investimentos <strong>' + F(soma(movs, 'investimento', de, fim)) + '</strong>';
      const g = Calc.agrupar(movs, 'semana', [sem])[0];
      exT = '<p>Com o dia ' + Util.isoToPt(d) + ':' + lin('Semana (segunda a domingo)', sem, Calc.addDays(sem, 6)) + lin('Mês', mes + '-01', Calc.fimDe(mes, 'mes')) + lin('Ano', ano + '-01-01', ano + '-12-31') + '</p>' +
        verif(g.gasto === soma(movs, 'gasto', sem, Calc.addDays(sem, 6)), 'Os Gráficos usam as mesmas somas.', 'Os Gráficos diferem: há um erro, avisa-me.');
    }
    h += sec('5. Totais por semana, mês e ano', 'Somam-se os mesmos movimentos. A semana vai de segunda a domingo. O intervalo em curso conta só até hoje.', 'Total do intervalo = soma dos movimentos com data dentro do intervalo', exT);

    h += sec('6. Poupança negativa', 'Se um gasto ou investimento deixar a poupança abaixo de zero, a app avisa mas deixa guardar.', '', Calc.total(s, movs, '9999-12-31').poup < 0 ? '<p>Neste momento a tua poupança está negativa: ' + F(Calc.total(s, movs, '9999-12-31').poup) + '.</p>' : '');

    // Períodos
    const p = [...E.pers].sort((a, b) => a.start < b.start ? 1 : -1)[0];
    let exP = '<p>Ainda não criaste períodos. Quando criares, o exemplo aparece aqui.</p>';
    if (p) {
      const r = Calc.resumoPeriodo(s, movs, p), gMao = soma(movs, 'gasto', p.start, p.end), gTodos = soma(movs, 'gasto', '0000-01-01', '9999-12-31');
      exP = '<p>«' + esc(p.name) + '» (' + Util.isoToPt(p.start) + ' a ' + Util.isoToPt(p.end) + '): gastos do período <strong>' + F(r.gasto) + '</strong>. Todos os gastos da app: <strong>' + F(gTodos) + '</strong> (os do período estão incluídos).</p>' +
        verif(r.gasto === gMao && gTodos >= gMao, 'O período mostra só os seus dias e esses dias contam também nos totais.', 'Há um erro, avisa-me.');
    }
    h += sec('7. Períodos', 'Um período (por exemplo uma viagem) é uma vista filtrada: mostra só os dias dentro do intervalo. Esses dias contam também nos totais globais. Nada é copiado.', 'Total do período = soma dos movimentos dos dias do período', exP);

    // Recorrentes
    const rec = E.recs[0];
    h += sec('8. Investimentos recorrentes', 'Cada regra semanal cria um investimento no dia da semana escolhido, a partir da data de início e até à data de fim (se existir). Saem da poupança como qualquer investimento. Se não abrires a app durante dias ou semanas, ao abrir criam-se os que faltam, sem duplicar. Uma regra pausada não cria nada.', '',
      rec ? '<p>Regra: ' + F(rec.cents) + ' · ' + Calc.textoSemana(rec.weekday) + ' (' + (rec.active ? 'ativa' : 'pausada') + '). Já criou ' + movs.filter(m => m.recId === rec.id).length + ' investimentos.</p>' : '');

    h += sec('9. Valores e datas', 'Aceita vírgula ou ponto como separador decimal (12,50 ou 12.50). Mostra os valores como 1 234,56 € e as datas como dd/mm/aaaa.', '', '');
    h += '<p class="mut"><a href="testes.html">Executar os testes automáticos</a> com vários casos, incluindo edição de dias antigos, recorrentes em atraso, períodos e células vazias.</p>';
    v.innerHTML = h;
  }
  function iniciar() { App.aoAtualizar(desenhar); document.addEventListener('vista', e => { if (e.detail === 'Calculos') desenhar(); }); }
  return { iniciar, desenhar };
})();
