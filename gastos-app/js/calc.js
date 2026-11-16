'use strict';
/* Cálculos puros (sem interface). Tudo é recalculado a partir dos movimentos guardados. Valores em cêntimos. */
const Calc = (() => {
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const TIPOS = ['ganho', 'gasto', 'investimento', 'ajuste'];
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diasEntre = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
  const diaSemana = iso => DIAS[new Date(iso + 'T00:00:00Z').getUTCDay()];
  /** Variação da poupança causada por um movimento (ganhos e ajustes somam; gastos e investimentos subtraem). */
  const efeito = m => (m.type === 'ganho' || m.type === 'ajuste') ? m.cents : -m.cents;

  /** Colunas de n dias a partir de `de`. Os movimentos anteriores a `de` entram no saldo de partida. */
  function serie(s, movs, de, n) {
    let poup = s.initialSavings || 0, cap = s.initialInvested || 0;
    const porDia = {};
    for (const m of movs) {
      if (m.date < de) { poup += efeito(m); if (m.type === 'investimento') cap += m.cents; }
      else (porDia[m.date] = porDia[m.date] || []).push(m);
    }
    const cols = [];
    for (let i = 0; i < n; i++) {
      const date = addDays(de, i);
      const c = { date, v: { ganho: 0, gasto: 0, investimento: 0, ajuste: 0 }, n: { ganho: 0, gasto: 0, investimento: 0, ajuste: 0 } };
      for (const m of porDia[date] || []) { c.v[m.type] += m.cents; c.n[m.type]++; }
      c.sobra = c.v.ganho - c.v.gasto - c.v.investimento;   // os ajustes não entram na sobra do dia
      poup += c.sobra + c.v.ajuste; cap += c.v.investimento;
      c.poup = poup; c.capital = cap;
      cols.push(c);
    }
    return cols;
  }
  /** Poupança e capital investido no fim do dia `ate`. */
  function total(s, movs, ate) {
    let poup = s.initialSavings || 0, cap = s.initialInvested || 0;
    for (const m of movs) if (m.date <= ate) { poup += efeito(m); if (m.type === 'investimento') cap += m.cents; }
    return { poup, capital: cap };
  }
  /** Gastos do mês de `iso`, até esse dia. */
  function gastosMes(movs, iso) {
    let t = 0;
    for (const m of movs) if (m.type === 'gasto' && m.date <= iso && m.date.slice(0, 7) === iso.slice(0, 7)) t += m.cents;
    return t;
  }
  return { TIPOS, addDays, diasEntre, diaSemana, efeito, serie, total, gastosMes };
})();
if (typeof module !== 'undefined') module.exports = Calc;
