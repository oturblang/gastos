'use strict';
/* Testes automáticos dos cálculos. Usam só funções puras (Util, Calc, Csv, DB.validate): nunca tocam nos dados guardados. */
const Testes = (() => {
  function correr() {
    const res = []; let grupo = '';
    const G = n => { grupo = n; };
    const T = (nome, obtido, esperado) => {
      const a = JSON.stringify(obtido), b = JSON.stringify(esperado), ok = a === b;
      res.push({ grupo, nome, ok, detalhe: ok ? '' : 'obtido ' + a + ', esperado ' + b });
    };
    const mov = (id, date, type, cents, extra) => ({ id, date, type, cents, categoryId: null, desc: '', ...extra });
    const s = { initialSavings: 100000, initialInvested: 50000 };   // 1 000,00 € e 500,00 €
    const base = () => [mov(1, '2026-11-01', 'ganho', 20000), mov(2, '2026-11-01', 'gasto', 5000), mov(3, '2026-11-01', 'investimento', 10000), mov(4, '2026-11-02', 'gasto', 3000), mov(5, '2026-11-02', 'ajuste', -200)];

    G('Dinheiro e datas');
    T('vírgula decimal: 12,5 = 12,50 €', Util.parseMoney('12,5'), 1250);
    T('ponto decimal: 12.50 = 12,50 €', Util.parseMoney('12.50'), 1250);
    T('milhares com espaço: 1 234,56', Util.parseMoney('1 234,56'), 123456);
    T('milhares com ponto: 1.234,56', Util.parseMoney('1.234,56'), 123456);
    T('símbolo € ignorado', Util.parseMoney('€ 5'), 500);
    T('valor negativo (ajustes)', Util.parseMoney('-3,20'), -320);
    T('campo vazio = 0', Util.parseMoney(''), 0);
    T('só espaços = 0', Util.parseMoney('   '), 0);
    T('texto inválido = erro (null)', Util.parseMoney('abc'), null);
    T('3 casas decimais = erro (nunca arredonda em silêncio)', Util.parseMoney('0,005'), null);
    T('separadores misturados = erro', Util.parseMoney('1,2,3'), null);
    T('formato 1 234,56 €', Util.fmtEUR(123456).replace(/ /g, ' '), '1 234,56 €');
    T('formato negativo', Util.fmtEUR(-50).replace(/ /g, ' '), '-0,50 €');
    T('formato para campo de edição', Util.toInput(123456), '1234,56');
    T('data dd/mm/aaaa', Util.isoToPt('2026-11-16'), '16/11/2026');
    T('data inexistente (30 de fevereiro) é inválida', Util.validISO('2026-02-30'), false);
    T('29 de fevereiro só em ano bissexto', [Util.validISO('2028-02-29'), Util.validISO('2027-02-29')], [true, false]);

    G('Sobra do dia, poupança e capital investido');
    let c = Calc.serie(s, base(), '2026-11-01', 4);
    T('dia 1: sobra = 200 − 50 − 100 = 50 €', c[0].sobra, 5000);
    T('dia 1: poupança = 1 000 + 50 = 1 050 €', c[0].poup, 105000);
    T('dia 1: capital = 500 + 100 = 600 €', c[0].capital, 60000);
    T('dia 2: sobra = −30 € (o ajuste não entra na sobra)', c[1].sobra, -3000);
    T('dia 2: poupança = 1 050 − 30 − 2 = 1 018 € (o ajuste entra na poupança)', c[1].poup, 101800);
    T('dia 3 sem movimentos: sobra 0, poupança igual à véspera', [c[2].sobra, c[2].poup, c[2].capital], [0, 101800, 60000]);
    T('célula vazia conta 0 em todas as rubricas', c[2].v, { ganho: 0, gasto: 0, investimento: 0, ajuste: 0 });
    T('sem nenhum movimento: tudo igual aos valores iniciais', Calc.serie(s, [], '2026-11-01', 2).map(x => [x.sobra, x.poup, x.capital]), [[0, 100000, 50000], [0, 100000, 50000]]);
    T('total até um dia = valor da tabela nesse dia', Calc.total(s, base(), '2026-11-02'), { poup: 101800, capital: 60000 });
    T('várias parcelas no mesmo dia somam-se', Calc.serie(s, [mov(1, '2026-11-01', 'gasto', 500), mov(2, '2026-11-01', 'gasto', 700)], '2026-11-01', 1)[0].v.gasto, 1200);
    T('poupança negativa é calculada (a app avisa mas permite)', Calc.total({ initialSavings: 1000, initialInvested: 0 }, [mov(1, '2026-11-01', 'gasto', 5000)], '2026-11-01').poup, -4000);
    T('movimentos antes da 1.ª coluna entram no saldo de partida', Calc.serie(s, [mov(1, '2026-10-31', 'ganho', 1000)], '2026-11-01', 1)[0].poup, 101000);

    G('Edição retroativa (mudar dias passados)');
    let mv = base(); mv[0] = { ...mv[0], cents: 30000 };
    c = Calc.serie(s, mv, '2026-11-01', 4);
    T('ganho do dia 1 sobe 100 €: sobra do dia 1 = 150 €', c[0].sobra, 15000);
    T('…e a poupança de todos os dias seguintes sobe 100 €', [c[0].poup, c[1].poup, c[3].poup], [115000, 111800, 111800]);
    mv = base().filter(m => m.id !== 3); c = Calc.serie(s, mv, '2026-11-01', 4);
    T('apagar o investimento do dia 1: capital volta a 500 €', c.map(x => x.capital), [50000, 50000, 50000, 50000]);
    T('…e a poupança sobe 100 € em todos os dias', c[3].poup, 111800);
    mv = base(); mv.push(mov(9, '2026-11-01', 'gasto', 2500)); c = Calc.serie(s, mv, '2026-11-01', 4);
    T('acrescentar um gasto num dia antigo muda os saldos seguintes', [c[0].poup, c[3].poup], [102500, 99300]);
    T('o total global acompanha a edição', Calc.total(s, mv, '9999-12-31').poup, 99300);

    G('Semanas, meses e anos');
    T('segunda-feira abre a semana', Calc.chave('2026-11-16', 'semana'), '2026-11-16');
    T('domingo pertence à semana que começou na segunda', Calc.chave('2026-11-22', 'semana'), '2026-11-16');
    T('segunda seguinte abre outra semana', Calc.chave('2026-11-23', 'semana'), '2026-11-23');
    T('fim de fevereiro (ano normal e bissexto)', [Calc.fimDe('2026-02', 'mes'), Calc.fimDe('2028-02', 'mes')], ['2026-02-28', '2028-02-29']);
    T('mês anterior atravessa o ano', Calc.anterior('2026-01', 'mes', 1), '2025-12');
    T('janelas: 14 dias, 8 semanas, 12 meses, 5 anos', ['dia', 'semana', 'mes', 'ano'].map(m => Calc.janela(m, '2026-11-18').length), [14, 8, 12, 5]);
    T('totais de 02/11 (segunda): dia 30 €, semana 30 € (o domingo 01/11 é da semana anterior), mês 80 €, ano 80 €', ['dia', 'semana', 'mes', 'ano'].map(m => Calc.agrupar(base(), m, [Calc.chave('2026-11-02', m)])[0].gasto), [3000, 3000, 8000, 8000]);
    T('agrupar por dia separa ganhos, gastos, investimentos e ajustes', Calc.agrupar(base(), 'dia', ['2026-11-01', '2026-11-02']).map(x => [x.ganho, x.gasto, x.investimento, x.ajuste]), [[20000, 5000, 10000, 0], [0, 3000, 0, -200]]);
    T('poupança no fim de cada mês (mês em curso conta até hoje)', Calc.evolucao(s, base(), 'mes', ['2026-10', '2026-11'], '2026-11-02').map(x => x.poup), [100000, 101800]);
    T('gastos do mês até ao dia', Calc.gastosMes(base(), '2026-11-02'), 8000);
    T('gastos do mês não contam outros meses', Calc.gastosMes([...base(), mov(8, '2026-10-30', 'gasto', 999)], '2026-11-02'), 8000);
    T('gastos por categoria (sem categoria = null)', [...Calc.gastosPorCategoria([...base(), mov(6, '2026-11-02', 'gasto', 500, { categoryId: 7 })], '2026-11-01', '2026-11-30').entries()], [[null, 8000], [7, 500]]);

    G('Frequência de investimento');
    const inv = (id, d) => mov(id, d, 'investimento', 100);
    const mi = [inv(1, '2026-11-02'), inv(2, '2026-11-02'), inv(3, '2026-11-04'), inv(4, '2026-11-09'), inv(5, '2026-10-30'), mov(9, '2026-11-03', 'gasto', 5)];
    T('por mês: nº, dias e semanas com investimento', Calc.frequencia(mi, 'mes', ['2026-10', '2026-11']), [{ key: '2026-10', n: 1, dias: 1, semanas: 1 }, { key: '2026-11', n: 4, dias: 3, semanas: 2 }]);
    T('por semana: 3 investimentos em 2 dias', (f => [f.n, f.dias])(Calc.frequencia(mi, 'semana', ['2026-11-02'])[0]), [3, 2]);
    T('gastos não contam como investimento', Calc.frequencia(mi, 'dia', ['2026-11-03'])[0].n, 0);
    T('sem movimentos = 0', Calc.frequencia([], 'ano', ['2026'])[0].n, 0);
    T('dias com investimento no intervalo', Calc.diasComInvestimento(mi, '2026-11-01', '2026-11-30'), 3);

    G('Recorrentes em atraso');
    const R = (extra) => ({ id: 1, startDate: '2026-10-05', weekday: 1, endDate: null, active: true, cents: 2500, note: '', ...extra });   // 05/10/2026 é segunda-feira
    let g = Calc.gerarRecorrentes([R()], [], '2026-11-16');
    T('segundas desde 05/10 até 16/11: 7 investimentos', g.novos.map(m => m.date), ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
    T('são investimentos de 25,00 € ligados à regra', g.novos.every(m => m.type === 'investimento' && m.cents === 2500 && m.recId === 1), true);
    const criados = g.novos.map((m, i) => ({ ...m, id: 100 + i }));
    T('o 1.º investimento recorrente tira 25 € à poupança e soma 25 € ao capital', (t => [t.poup, t.capital])(Calc.total(s, criados.slice(0, 1), '9999-12-31')), [97500, 52500]);
    T('os 7 tiram 175 € à poupança', Calc.total(s, criados, '9999-12-31').poup, 82500);
    const rec2 = g.recs;
    T('gerar outra vez no mesmo dia: 0 novos (sem duplicar)', Calc.gerarRecorrentes(rec2.length ? rec2 : [R()], criados, '2026-11-16').novos.length, 0);
    T('sem lastGen mas com movimentos já existentes: também não duplica', Calc.gerarRecorrentes([R()], criados, '2026-11-16').novos.length, 0);
    T('app fechada 3 semanas: gera as que faltam', Calc.gerarRecorrentes([R({ lastGen: '2026-11-02' })], [], '2026-12-07').novos.map(m => m.date), ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07']);
    const semOutubro12 = criados.filter(m => m.date !== '2026-10-12');
    T('um recorrente apagado pelo utilizador não volta', Calc.gerarRecorrentes(rec2, semOutubro12, '2026-11-23').novos.map(m => m.date), ['2026-11-23']);
    T('regra pausada não gera nada', Calc.gerarRecorrentes([R({ active: false })], [], '2026-11-16').novos.length, 0);
    T('data de fim respeitada', Calc.gerarRecorrentes([R({ endDate: '2026-10-20' })], [], '2026-11-16').novos.map(m => m.date), ['2026-10-05', '2026-10-12', '2026-10-19']);
    T('início no futuro não gera', Calc.gerarRecorrentes([R({ startDate: '2026-12-01' })], [], '2026-11-16').novos.length, 0);
    T('início a meio da semana começa na segunda seguinte', Calc.ocorrencias(R({ startDate: '2026-10-06' }), '2026-10-20'), ['2026-10-12', '2026-10-19']);
    T('duas regras no mesmo dia geram dois investimentos', Calc.gerarRecorrentes([R({ startDate: '2026-11-16' }), R({ id: 2, startDate: '2026-11-16', cents: 1000 })], [], '2026-11-16').novos.length, 2);
    T('próximo investimento de uma regra ativa', Calc.proxima(R(), '2026-11-17'), '2026-11-23');
    T('regra pausada não tem próximo', Calc.proxima(R({ active: false }), '2026-11-17'), null);
    T('26 semanas em atraso geram 26 ou 27 investimentos (sem erros)', Calc.ocorrencias(R(), '2027-04-05').length, 27);

    G('Períodos');
    const A = { id: 1, start: '2026-11-10', end: '2026-11-14' };
    T('períodos iguais sobrepõem-se', Calc.sobrepoe(A, A), true);
    T('tocar num dia conta como sobreposição', Calc.sobrepoe(A, { start: '2026-11-14', end: '2026-11-20' }), true);
    T('dia seguinte ao fim não sobrepõe', Calc.sobrepoe(A, { start: '2026-11-15', end: '2026-11-20' }), false);
    T('período contido noutro sobrepõe', Calc.sobrepoe(A, { start: '2026-11-11', end: '2026-11-12' }), true);
    T('ao editar, o próprio período não conta como conflito', Calc.conflito([A], { start: '2026-11-11', end: '2026-11-13' }, 1), null);
    T('conflito identifica o outro período', Calc.conflito([A], { start: '2026-11-13', end: '2026-11-18' }).id, 1);
    T('período de um dia tem 1 dia', Calc.diasDe({ start: '2026-11-10', end: '2026-11-10' }), 1);
    const mp = [mov(1, '2026-11-09', 'gasto', 9999), mov(2, '2026-11-10', 'ganho', 20000), mov(3, '2026-11-11', 'gasto', 3000), mov(4, '2026-11-14', 'gasto', 2000), mov(5, '2026-11-12', 'investimento', 5000), mov(6, '2026-11-15', 'gasto', 7777)];
    const sp = { initialSavings: 100000, initialInvested: 0 }, r = Calc.resumoPeriodo(sp, mp, A);
    T('o período só conta os seus dias (200 ganhos, 50 gastos, 50 investidos)', [r.dias, r.ganho, r.gasto, r.investimento], [5, 20000, 5000, 5000]);
    T('sobra = 100 € e média de gastos = 10 € por dia', [r.sobra, r.mediaGasto], [10000, 1000]);
    T('poupança no fim do período inclui o que veio antes', r.poupFim, 100000 - 9999 + 10000);
    T('os dias do período contam também nos totais globais', Calc.total(sp, mp, '9999-12-31').poup, 100000 - 9999 + 20000 - 3000 - 2000 - 5000 - 7777);
    T('editar um dia do período muda o período e o global', [Calc.resumoPeriodo(sp, mp.map(m => m.id === 3 ? { ...m, cents: 4000 } : m), A).gasto, Calc.total(sp, mp.map(m => m.id === 3 ? { ...m, cents: 4000 } : m), '9999-12-31').poup], [6000, 100000 - 9999 + 20000 - 4000 - 2000 - 5000 - 7777]);
    T('período sem movimentos: tudo 0, sem erros', (x => [x.ganho, x.gasto, x.mediaGasto, x.sobra])(Calc.resumoPeriodo(sp, [], A)), [0, 0, 0, 0]);
    T('dia pertence ao período (início e fim incluídos)', [!!Calc.periodoDe([A], '2026-11-10'), !!Calc.periodoDe([A], '2026-11-14'), !!Calc.periodoDe([A], '2026-11-15')], [true, true, false]);

    G('Metas e histórico');
    T('progresso 25 %', (p => [p.pct, p.faltam, p.atingida])(Calc.progresso(2500, 10000)), [25, 7500, false]);
    T('acima de 100 %: percentagem real, barra limitada', (p => [p.pct, p.barra, p.faltam, p.atingida])(Calc.progresso(12000, 10000)), [120, 100, 0, true]);
    T('poupança negativa = 0 % (sem barra negativa)', Calc.progresso(-500, 10000).pct, 0);
    T('histórico: saldo depois de cada movimento', Calc.historico({ initialSavings: 1000 }, [mov(2, '2026-11-02', 'gasto', 300), mov(1, '2026-11-01', 'ganho', 500), mov(3, '2026-11-02', 'ajuste', -50)]).map(x => x.saldo), [1500, 1200, 1150]);

    G('Backup (validação)');
    const bk = () => ({ format: 'gastos-app-backup', version: 3, settings: { initialSavings: 0, initialInvested: 0, startDate: '2026-01-01', backupReminderDays: 14, lastBackup: null }, days: [], movements: [], categories: [], recurrences: [], periods: [], goals: [] });
    T('backup válido', DB.validate(bk()).ok, true);
    T('backup antigo (versão 2) aceite', DB.validate({ ...bk(), version: 2 }).ok, true);
    T('backup de versão futura recusado', DB.validate({ ...bk(), version: 99 }).ok, false);
    T('ficheiro que não é backup recusado', DB.validate({ foo: 1 }).ok, false);
    T('movimento com valor decimal recusado', DB.validate({ ...bk(), movements: [{ id: 1, date: '2026-01-01', type: 'gasto', cents: 1.5 }] }).ok, false);
    T('movimento com tipo desconhecido recusado', DB.validate({ ...bk(), movements: [{ id: 1, date: '2026-01-01', type: 'x', cents: 5 }] }).ok, false);
    T('períodos sobrepostos recusados', DB.validate({ ...bk(), periods: [{ id: 1, name: 'A', start: '2026-01-01', end: '2026-01-10' }, { id: 2, name: 'B', start: '2026-01-10', end: '2026-01-12' }] }).ok, false);
    T('meta inválida recusada', DB.validate({ ...bk(), goals: [{ id: 1, kind: 'poupanca', targetCents: 0 }] }).ok, false);
    T('regra recorrente inválida recusada', DB.validate({ ...bk(), recurrences: [{ id: 1, cents: 100, weekday: 9, startDate: '2026-01-01', active: true }] }).ok, false);

    G('Exportação CSV');
    const cats = [{ id: 7, name: 'Comida' }];
    const csv = Csv.movimentos([mov(1, '2026-11-01', 'gasto', 1250, { categoryId: 7, desc: 'pizza; com "extra"' }), mov(2, '2026-11-01', 'ajuste', -320, { desc: '=SOMA(A1)' })], cats, [A]);
    const ls = csv.split('\r\n');
    T('começa com BOM UTF-8 (acentos corretos no Excel)', csv.charCodeAt(0), 0xFEFF);
    T('cabeçalho com separador «;»', ls[0].replace('﻿', ''), 'Data;Tipo;Valor (€);Efeito na poupança (€);Categoria;Descrição;Origem;Período');
    T('valor com vírgula decimal e efeito com sinal', ls[1], '01/11/2026;Gasto;12,50;-12,50;Comida;"pizza; com ""extra""";Manual;');
    T('texto que parece fórmula leva plica (sem injeção)', ls[2], "01/11/2026;Ajuste;-3,20;-3,20;Sem categoria;'=SOMA(A1);Manual;");
    const h = Csv.historico({ initialSavings: 100000, startDate: '2026-11-01' }, [mov(1, '2026-11-01', 'gasto', 1250)], cats).split('\r\n');
    T('histórico: saldo inicial e saldo depois', [h[1], h[2]], ['01/11/2026;Saldo inicial;;1000,00;;', '01/11/2026;Gasto;-12,50;987,50;;']);
    T('cêntimos para euros', [Csv.euros(5), Csv.euros(123456), Csv.euros(-100)], ['0,05', '1234,56', '-1,00']);
    G('Pesquisa e filtros');
    const fm = [mov(1, '2026-11-01', 'gasto', 1250, { categoryId: 7, desc: 'Café com amigos' }), mov(2, '2026-11-02', 'ganho', 98000, { desc: 'Ordenado' }), mov(3, '2026-11-03', 'gasto', 800, { categoryId: 7 }),
      mov(4, '2026-11-03', 'investimento', 5000), mov(5, '2026-10-30', 'gasto', 400, { categoryId: 8, desc: 'cafe' })];
    const fc = [{ id: 7, name: 'Comida' }, { id: 8, name: 'Transportes' }], fp = [{ id: 1, name: 'Viagem', start: '2026-11-01', end: '2026-11-02' }];
    const ids = f => Calc.filtrar(fm, fc, fp, f).map(m => m.id);
    T('sem filtros: todos, mais recentes primeiro (data e depois id)', ids({}), [4, 3, 2, 1, 5]);
    T('texto sem acentos encontra «Café»', ids({ q: 'cafe' }), [1, 5]);
    T('texto com acento encontra «cafe»', ids({ q: 'CAFÉ' }), [1, 5]);
    T('várias palavras: todas têm de aparecer', ids({ q: 'cafe amigos' }), [1]);
    T('texto procura também no nome da categoria', ids({ q: 'transp' }), [5]);
    T('texto sem resultados', ids({ q: 'xyz' }), []);
    T('tipo', ids({ tipo: 'gasto' }), [3, 1, 5]);
    T('categoria', ids({ cat: '7' }), [3, 1]);
    T('sem categoria', ids({ cat: 'none' }), [4, 2]);
    T('período (viagem) limita às datas dele', ids({ per: '1' }), [2, 1]);
    T('intervalo de datas (inclui os dois extremos)', ids({ de: '2026-11-02', ate: '2026-11-03' }), [4, 3, 2]);
    T('filtros combinados', ids({ tipo: 'gasto', cat: '7', de: '2026-11-02' }), [3]);
    G('Escala ajustada');
    T('sem valores muito grandes: não corta', Calc.limiteEscala([1000, 1200, 1500, 2000, 1800]), null);
    T('ordenado muito maior: corta no maior normal + 15 %', Calc.limiteEscala([98000, 1000, 1200, 1500, 2000]), 2300);
    T('zeros não contam', Calc.limiteEscala([0, 0, 98000, 1000, 1200, 1500, 2000, 0]), 2300);
    T('poucos valores: não corta', Calc.limiteEscala([98000, 500]), null);
    T('tudo a zero: não corta', Calc.limiteEscala([0, 0, 0]), null);
    return res;
  }
  return { correr };
})();
if (typeof module !== 'undefined') module.exports = Testes;
