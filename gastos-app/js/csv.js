'use strict';
/* Exportação CSV (abre no Excel e no Google Sheets): separador «;», vírgula decimal, UTF-8 com BOM. Lógica pura, sem interface. */
const Csv = (() => {
  const NOME = { ganho: 'Ganho', gasto: 'Gasto', investimento: 'Investimento', ajuste: 'Ajuste' };
  /** Texto seguro: aspas quando preciso e sem fórmulas (= + - @ no início ganham uma plica). */
  function texto(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  /** Cêntimos -> «1234,56» (sem separador de milhares, para o Excel reconhecer como número). */
  function euros(c) { const a = Math.abs(c), s = Math.floor(a / 100) + ',' + String(a % 100).padStart(2, '0'); return (c < 0 ? '-' : '') + s; }
  const linha = cels => cels.join(';');
  const doc = linhas => '﻿' + linhas.join('\r\n') + '\r\n';
  const cat = (cats, id) => { const c = cats.find(x => x.id === id); return c ? c.name : ''; };
  const ordenar = movs => [...movs].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);
  const dataPt = Util.isoToPt;

  /** Todos os movimentos, por ordem cronológica. */
  function movimentos(movs, cats, pers) {
    const l = [linha(['Data', 'Tipo', 'Valor (€)', 'Efeito na poupança (€)', 'Categoria', 'Descrição', 'Origem', 'Período'])];
    for (const m of ordenar(movs)) {
      const p = Calc.periodoDe(pers || [], m.date);
      l.push(linha([dataPt(m.date), NOME[m.type], euros(m.cents), euros(Calc.efeito(m)), texto(m.categoryId != null ? cat(cats, m.categoryId) || 'Categoria apagada' : 'Sem categoria'),
        texto(m.desc), m.recId != null ? 'Recorrente' : 'Manual', texto(p ? p.name : '')]));
    }
    return doc(l);
  }
  /** Histórico da poupança: saldo inicial e, a seguir, cada movimento com o saldo depois dele. */
  function historico(s, movs, cats) {
    const l = [linha(['Data', 'Movimento', 'Valor com sinal (€)', 'Saldo depois (€)', 'Categoria', 'Nota'])];
    l.push(linha([dataPt(s.startDate), 'Saldo inicial', '', euros(s.initialSavings || 0), '', '']));
    for (const { m, saldo } of Calc.historico(s, movs))
      l.push(linha([dataPt(m.date), NOME[m.type] + (m.recId != null ? ' (recorrente)' : ''), euros(Calc.efeito(m)), euros(saldo), texto(m.categoryId != null ? cat(cats, m.categoryId) : ''), texto(m.desc)]));
    return doc(l);
  }
  return { texto, euros, movimentos, historico };
})();
if (typeof module !== 'undefined') module.exports = Csv;
