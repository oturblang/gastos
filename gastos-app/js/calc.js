'use strict';
/* Cálculos puros (sem interface). Tudo é recalculado a partir dos movimentos guardados. Valores em cêntimos. */
const Calc = (() => {
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const TIPOS = ['ganho', 'gasto', 'investimento', 'ajuste'];
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diasEntre = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
  const diaSemana = iso => DIAS[new Date(iso + 'T00:00:00Z').getUTCDay()];
  const isoPt = k => k.slice(8, 10) + '/' + k.slice(5, 7) + '/' + k.slice(0, 4);
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

  // ---------- Períodos para os gráficos (dia, semana, mês, ano) ----------
  const CONTAGEM = { dia: 14, semana: 8, mes: 12, ano: 5 };
  const inicioSemana = iso => addDays(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7));   // semanas começam à segunda
  function chave(iso, modo) {
    return modo === 'dia' ? iso : modo === 'semana' ? inicioSemana(iso) : modo === 'mes' ? iso.slice(0, 7) : iso.slice(0, 4);
  }
  const inicioDe = (k, modo) => modo === 'mes' ? k + '-01' : modo === 'ano' ? k + '-01-01' : k;
  function fimDe(k, modo) {
    if (modo === 'dia') return k;
    if (modo === 'semana') return addDays(k, 6);
    if (modo === 'mes') { const [y, m] = k.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
    return k + '-12-31';
  }
  function anterior(k, modo, n) {
    if (modo === 'dia') return addDays(k, -n);
    if (modo === 'semana') return addDays(k, -7 * n);
    if (modo === 'mes') { const [y, m] = k.split('-').map(Number), t = y * 12 + (m - 1) - n; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0'); }
    return String(Number(k) - n);
  }
  /** Chaves dos períodos que terminam no período de `hoje`, do mais antigo para o mais recente. */
  function janela(modo, hoje) {
    const fim = chave(hoje, modo), keys = [];
    for (let i = CONTAGEM[modo] - 1; i >= 0; i--) keys.push(anterior(fim, modo, i));
    return keys;
  }
  function rotulo(k, modo) {
    if (modo === 'dia' || modo === 'semana') return k.slice(8, 10) + '/' + k.slice(5, 7);
    if (modo === 'mes') return MESES[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(2, 4);
    return k;
  }
  function titulo(k, modo) {
    if (modo === 'dia') return diaSemana(k) + ', ' + isoPt(k);
    if (modo === 'semana') return 'Semana de ' + isoPt(k);
    if (modo === 'mes') return MESES_LONGOS[Number(k.slice(5, 7)) - 1] + ' de ' + k.slice(0, 4);
    return k;
  }
  /** Totais de ganhos, gastos e investimentos por período. */
  function agrupar(movs, modo, keys) {
    const idx = {}; keys.forEach((k, i) => { idx[k] = i; });
    const out = keys.map(k => ({ key: k, ganho: 0, gasto: 0, investimento: 0, ajuste: 0 }));
    for (const m of movs) { const i = idx[chave(m.date, modo)]; if (i !== undefined) out[i][m.type] += m.cents; }
    return out;
  }
  /** Poupança e capital investido no fim de cada período (o período em curso conta até hoje). */
  function evolucao(s, movs, modo, keys, hoje) {
    return keys.map(k => { const fim = fimDe(k, modo); return { key: k, ...total(s, movs, fim > hoje ? hoje : fim) }; });
  }
  const somaTipo = (movs, tipo, de, ate) => movs.reduce((t, m) => t + (m.type === tipo && m.date >= de && m.date <= ate ? m.cents : 0), 0);
  function gastosPorCategoria(movs, de, ate) {
    const mapa = new Map();
    for (const m of movs) if (m.type === 'gasto' && m.date >= de && m.date <= ate) mapa.set(m.categoryId == null ? null : m.categoryId, (mapa.get(m.categoryId == null ? null : m.categoryId) || 0) + m.cents);
    return mapa;
  }
  function diasComInvestimento(movs, de, ate) {
    const s = new Set();
    for (const m of movs) if (m.type === 'investimento' && m.date >= de && m.date <= ate) s.add(m.date);
    return s.size;
  }
  // ---------- Recorrentes semanais, histórico e metas ----------
  const SEMANA_PL = ['domingos', 'segundas-feiras', 'terças-feiras', 'quartas-feiras', 'quintas-feiras', 'sextas-feiras', 'sábados'];
  const textoSemana = w => (w === 0 || w === 6 ? 'Todos os ' : 'Todas as ') + SEMANA_PL[w];
  const maxIso = (a, b) => a > b ? a : b;
  /** Datas por gerar de uma regra semanal: depois de `lastGen` (ou desde o início), até `ate` e até à data de fim. */
  function ocorrencias(r, ate) {
    const de = r.lastGen ? maxIso(r.startDate, addDays(r.lastGen, 1)) : r.startDate;
    const fim = r.endDate && r.endDate < ate ? r.endDate : ate, out = [];
    if (de > fim) return out;
    const w = new Date(de + 'T00:00:00Z').getUTCDay();
    for (let d = addDays(de, (r.weekday - w + 7) % 7); d <= fim; d = addDays(d, 7)) out.push(d);
    return out;
  }
  /** Próxima data (a partir de hoje) em que a regra investe, ou null se estiver pausada ou terminada. */
  function proxima(r, hoje) {
    if (!r.active) return null;
    const de = maxIso(r.startDate, hoje), w = new Date(de + 'T00:00:00Z').getUTCDay(), d = addDays(de, (r.weekday - w + 7) % 7);
    return r.endDate && d > r.endDate ? null : d;
  }
  /** Investimentos que faltam criar (sem duplicar) e regras com `lastGen` atualizado. Pura: quem chama é que grava. */
  function gerarRecorrentes(recs, movs, hoje) {
    const tem = new Set(movs.filter(m => m.recId != null).map(m => m.recId + '|' + m.date)), novos = [], atualizadas = [];
    for (const r of recs) {
      if (!r.active) continue;   // pausada: não avança
      for (const dt of ocorrencias(r, hoje)) {
        const k = r.id + '|' + dt; if (tem.has(k)) continue;
        tem.add(k); novos.push({ date: dt, type: 'investimento', cents: r.cents, categoryId: null, desc: r.note || 'Investimento recorrente', recId: r.id });
      }
      const ate = r.endDate && r.endDate < hoje ? r.endDate : hoje;
      if (r.lastGen !== ate) atualizadas.push({ ...r, lastGen: ate });
    }
    return { novos, recs: atualizadas };
  }
  /** Movimentos por ordem cronológica, cada um com o saldo da poupança logo depois dele. */
  function historico(s, movs) {
    const ord = [...movs].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);
    let p = s.initialSavings || 0;
    return ord.map(m => { p += efeito(m); return { m, saldo: p }; });
  }
  /** Progresso de uma meta: percentagem real, barra limitada a 100 % e quanto falta. */
  function progresso(atual, alvo) {
    const pct = alvo > 0 ? Math.max(0, atual) / alvo * 100 : 0;
    return { pct, barra: Math.min(100, pct), faltam: Math.max(0, alvo - atual), atingida: atual >= alvo };
  }
  /** Frequência de investimento por intervalo: nº de investimentos, dias e semanas com investimento. */
  function frequencia(movs, modo, keys) {
    const idx = {}; keys.forEach((k, i) => { idx[k] = i; });
    const out = keys.map(k => ({ key: k, n: 0, dias: new Set(), semanas: new Set() }));
    for (const m of movs) {
      if (m.type !== 'investimento') continue;
      const i = idx[chave(m.date, modo)]; if (i === undefined) continue;
      out[i].n++; out[i].dias.add(m.date); out[i].semanas.add(inicioSemana(m.date));
    }
    return out.map(o => ({ key: o.key, n: o.n, dias: o.dias.size, semanas: o.semanas.size }));
  }
  // ---------- Escala ajustada dos gráficos ----------
  /** Regra da escala «Ajustada»: um valor é «muito grande» se for mais de 3 vezes a mediana (a mais baixa das duas do meio) dos valores não nulos.
      Devolve o limite em que o eixo é cortado (o maior valor normal + 15 %), ou null se não há nada a cortar. */
  function limiteEscala(valores) {
    const nz = valores.filter(v => v > 0).sort((a, b) => a - b);
    if (nz.length < 3) return null;
    const med = nz[Math.floor((nz.length - 1) / 2)], normais = nz.filter(v => v <= 3 * med);
    if (normais.length === nz.length) return null;
    return Math.ceil(normais[normais.length - 1] * 1.15);
  }
  // ---------- Pesquisa e filtros ----------
  const norm = t => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  /** Filtra movimentos (mais recentes primeiro). f = { q, tipo, cat ('none' = sem categoria), per (id), de, ate }.
      O texto procura na descrição e no nome da categoria, sem distinguir maiúsculas nem acentos; todas as palavras têm de aparecer. */
  function filtrar(movs, cats, pers, f) {
    const palavras = norm(f.q).split(/\s+/).filter(Boolean), p = f.per ? pers.find(x => x.id === Number(f.per)) : null;
    const nomeCat = id => { const c = cats.find(x => x.id === id); return c ? c.name : ''; };
    return movs.filter(m => {
      if (f.tipo && m.type !== f.tipo) return false;
      if (f.cat === 'none') { if (m.categoryId != null) return false; } else if (f.cat && m.categoryId !== Number(f.cat)) return false;
      if (p && (m.date < p.start || m.date > p.end)) return false;
      if (f.de && m.date < f.de) return false;
      if (f.ate && m.date > f.ate) return false;
      if (palavras.length) { const t = norm(m.desc) + ' ' + norm(nomeCat(m.categoryId)); if (!palavras.every(w => t.includes(w))) return false; }
      return true;
    }).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);
  }
  // ---------- Períodos (uma vista filtrada dos dias normais, nunca uma cópia) ----------
  const diasDe = p => diasEntre(p.start, p.end) + 1;
  const sobrepoe = (a, b) => a.start <= b.end && b.start <= a.end;
  /** Primeiro período da lista que se sobrepõe a p (ignorando o próprio, ao editar), ou null. */
  const conflito = (lista, p, ignorar) => lista.find(x => x.id !== ignorar && sobrepoe(x, p)) || null;
  const periodoDe = (lista, iso) => lista.find(p => iso >= p.start && iso <= p.end) || null;
  function resumoPeriodo(s, movs, p) {
    const dias = diasDe(p), ganho = somaTipo(movs, 'ganho', p.start, p.end), gasto = somaTipo(movs, 'gasto', p.start, p.end),
      investimento = somaTipo(movs, 'investimento', p.start, p.end);
    return { dias, ganho, gasto, investimento, ajuste: somaTipo(movs, 'ajuste', p.start, p.end), sobra: ganho - gasto - investimento,
      mediaGasto: Math.round(gasto / dias), poupFim: total(s, movs, p.end).poup };
  }
  return { limiteEscala, filtrar, gerarRecorrentes, frequencia, diasDe, sobrepoe, conflito, periodoDe, resumoPeriodo, textoSemana, ocorrencias, proxima, historico, progresso, TIPOS, addDays, diasEntre, diaSemana, efeito, serie, total, gastosMes, CONTAGEM, chave, inicioDe, fimDe, anterior, janela,
    rotulo, titulo, agrupar, evolucao, somaTipo, gastosPorCategoria, diasComInvestimento };
})();
if (typeof module !== 'undefined') module.exports = Calc;
