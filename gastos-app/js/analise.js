'use strict';
/* Ecrã Gráficos: vistas por dia, semana, mês e ano; comparação com o intervalo anterior; frequência de investimento; gastos por categoria.
   Tudo calculado a partir dos movimentos (calc.js); nada é guardado aqui. */
const Analise = (() => {
  const $ = id => document.getElementById(id);
  const E = App.E;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MODOS = [['dia', 'Dias'], ['semana', 'Semanas'], ['mes', 'Meses'], ['ano', 'Anos']];
  const TEXTO = { dia: 'Últimos 14 dias', semana: 'Últimas 8 semanas (cada semana começa à segunda)', mes: 'Últimos 12 meses', ano: 'Últimos 5 anos' };
  const ATUAL = { dia: ['Hoje', 'ontem'], semana: ['Esta semana', 'a semana anterior'], mes: ['Este mês', 'o mês anterior'], ano: ['Este ano', 'o ano anterior'] };
  const UNI = { dia: 'dia', semana: 'semana', mes: 'mês', ano: 'ano' };
  const C = Graficos.COR, COR_DIAS = 'var(--c-poup)', COR_SEM = 'var(--c-sem)';
  let modo = 'dia';
  const lerEsc = () => { try { return localStorage.getItem('gastos-escala') === 'ajustada'; } catch (e) { return false; } };
  let ajustada = lerEsc();

  const legenda = itens => '<ul class="legenda">' + itens.map(([n, c]) => '<li><span class="sw" style="background:' + c + '"></span>' + n + '</li>').join('') + '</ul>';
  const tile = (r, v, x) => '<div class="tile"><dt>' + r + '</dt><dd class="v">' + v + '</dd>' + (x ? '<dd class="sub">' + x + '</dd>' : '') + '</div>';
  /** ▲/▼ com percentagem, em texto. boaSubida: subir é bom (ganhos, poupança) ou mau (gastos). */
  function delta(atual, antes, boaSubida, nome) {
    if (antes === 0) return atual === 0 ? '<span class="neutro">sem valores para comparar</span>' : '<span class="neutro">sem valor anterior para comparar</span>';
    const p = Math.round((atual - antes) / Math.abs(antes) * 100);
    if (p === 0) return '<span class="neutro">= igual a ' + nome + '</span>';
    const sobe = p > 0, bom = sobe === boaSubida;
    return '<span class="' + (bom ? 'bom' : 'mau') + '">' + (sobe ? '▲ +' : '▼ ') + p + ' %</span> <span class="neutro">vs ' + nome + '</span>';
  }
  const tabela = (cab, linhas) => '<details class="tabela-det"><summary>Ver valores em tabela</summary><div class="scroll"><table class="simples"><thead><tr>' +
    cab.map(c => '<th scope="col">' + c + '</th>').join('') + '</tr></thead><tbody>' + linhas.map(l => '<tr><th scope="row">' + esc(l[0]) + '</th>' + l.slice(1).map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></details>';

  function desenhar() {
    const v = $('vGraficos');
    if (!E.settings.configured) { v.innerHTML = '<h2>Gráficos</h2><p class="vazio">Define primeiro os valores iniciais no Início.</p>'; return; }
    if (v.hidden) return;   // os gráficos precisam de largura: desenham-se quando o ecrã aparece
    const hoje = Util.todayISO(), movs = E.movs, keys = Calc.janela(modo, hoje), de = Calc.inicioDe(keys[0], modo);
    const rot = keys.map(k => Calc.rotulo(k, modo)), tit = keys.map(k => Calc.titulo(k, modo));
    const g = Calc.agrupar(movs, modo, keys), ev = Calc.evolucao(E.settings, movs, modo, keys, hoje), fr = Calc.frequencia(movs, modo, keys);
    const cur = keys.length - 1, [rotAtual, nomeAnt] = ATUAL[modo];
    const poupAnt = ev[cur - 1].poup, poupAtual = ev[cur].poup;
    const comp = '<h3>Comparação com ' + nomeAnt + '</h3><p class="mut">' + rotAtual + ' (' + Calc.titulo(keys[cur], modo) + ') contra ' + nomeAnt + '. O intervalo em curso ainda não terminou.</p><dl class="kpis">' +
      tile('Ganhos', Util.fmtEUR(g[cur].ganho), delta(g[cur].ganho, g[cur - 1].ganho, true, nomeAnt)) +
      tile('Gastos', Util.fmtEUR(g[cur].gasto), delta(g[cur].gasto, g[cur - 1].gasto, false, nomeAnt)) +
      tile('Investido', Util.fmtEUR(g[cur].investimento), delta(g[cur].investimento, g[cur - 1].investimento, true, nomeAnt)) +
      tile('Poupança (saldo)', Util.fmtEUR(poupAtual), delta(poupAtual, poupAnt, true, nomeAnt)) +
      tile('Nº de investimentos', String(fr[cur].n), delta(fr[cur].n, fr[cur - 1].n, true, nomeAnt)) + '</dl>';

    const vazio = movs.length === 0;
    let h = '<h2>Gráficos</h2><div class="seg" role="group" aria-label="Intervalo dos gráficos">' +
      MODOS.map(([m, n]) => '<button type="button" data-m="' + m + '" aria-pressed="' + (m === modo) + '">' + n + '</button>').join('') + '</div><p class="mut">' + TEXTO[modo] + '</p>' + comp;
    if (vazio) { v.innerHTML = h + '<p class="vazio">Ainda não há movimentos. Preenche a Tabela e os gráficos aparecem aqui.</p>'; return; }
    // frequência: dia só tem nº de investimentos (um dia tem 0 ou 1 «dias com investimento»); semana junta dias; mês e ano juntam semanas
    const sFreq = [{ k: 'n', cor: C.investimento, nome: 'Nº de investimentos' }];
    if (modo !== 'dia') sFreq.push({ k: 'dias', cor: COR_DIAS, nome: 'Dias com investimento' });
    if (modo === 'mes' || modo === 'ano') sFreq.push({ k: 'semanas', cor: COR_SEM, nome: 'Semanas com investimento' });
    h += '<figure class="graf"><figcaption>Ganhos, gastos e investido</figcaption><div class="seg" role="group" aria-label="Escala das barras"><span class="seg-t">Escala:</span>' +
      '<button type="button" data-esc="normal" aria-pressed="' + !ajustada + '">Normal</button><button type="button" data-esc="ajustada" aria-pressed="' + ajustada + '">Ajustada</button></div>' +
      '<p class="mut peq-txt" id="aEscNota"></p><div id="aBarras"></div>' + legenda([['Ganhos', C.ganho], ['Gastos', C.gasto], ['Investido', C.investimento]]) +
      tabela(['Intervalo', 'Ganhos', 'Gastos', 'Investido'], g.map((x, i) => [tit[i], Util.fmtEUR(x.ganho), Util.fmtEUR(x.gasto), Util.fmtEUR(x.investimento)])) + '</figure>' +
      '<figure class="graf"><figcaption>Poupança no fim de cada ' + UNI[modo] + '</figcaption><div id="aPoup"></div>' +
      tabela(['Intervalo', 'Poupança', 'Capital investido'], ev.map((x, i) => [tit[i], Util.fmtEUR(x.poup), Util.fmtEUR(x.capital)])) + '</figure>' +
      '<figure class="graf"><figcaption>Poupança e capital investido</figcaption><div id="aLinha"></div>' + legenda([['Poupança', C.poupanca], ['Capital investido', C.capital]]) + '</figure>' +
      '<figure class="graf"><figcaption>Frequência de investimento</figcaption><div id="aFreq"></div>' + legenda(sFreq.map(s => [s.nome, s.cor])) +
      tabela(['Intervalo'].concat(sFreq.map(s => s.nome)), fr.map((x, i) => [tit[i]].concat(sFreq.map(s => String(x[s.k]))))) + '</figure>' +
      '<figure class="graf"><figcaption>Gastos por categoria (' + TEXTO[modo].toLowerCase() + ')</figcaption><div id="aDonut"></div></figure>';
    v.innerHTML = h;

    const soma = t => Calc.somaTipo(movs, t, de, hoje);
    const rb = Graficos.barras($('aBarras'), g, rot, tit, 'Barras por ' + UNI[modo] + ': ganhos ' + Util.fmtEUR(soma('ganho')) + ', gastos ' + Util.fmtEUR(soma('gasto')) + ' e investido ' + Util.fmtEUR(soma('investimento')) + ' no total.', ajustada);
    $('aEscNota').textContent = !ajustada ? 'Normal: o eixo vai até ao valor mais alto.' : rb.cortou ? 'Ajustada: barras com mais de 3 vezes o valor típico (a mediana) são cortadas, assinaladas com dois traços, para os valores pequenos se verem. Toca numa barra para ver o valor real.' : 'Ajustada: neste intervalo não há valores muito maiores que os outros, por isso a escala é igual à Normal.';
    Graficos.barrasGen($('aPoup'), ev, rot, tit, 'Poupança no fim de cada ' + UNI[modo] + ': de ' + Util.fmtEUR(ev[0].poup) + ' para ' + Util.fmtEUR(poupAtual) + '.', [{ k: 'poup', cor: C.poupanca, nome: 'Poupança' }], 'eur');
    { const u = ev[ev.length - 1]; Graficos.linha($('aLinha'), ev, rot, tit, 'Evolução: poupança de ' + Util.fmtEUR(u.poup) + ' e capital investido de ' + Util.fmtEUR(u.capital) + ' no fim do período.'); }
    Graficos.barrasGen($('aFreq'), fr, rot, tit, 'Frequência de investimento por ' + UNI[modo] + ': ' + fr.reduce((a, x) => a + x.n, 0) + ' investimentos no total.', sFreq, 'n');
    const mapa = Calc.gastosPorCategoria(movs, de, hoje), totalG = [...mapa.values()].reduce((a, b) => a + b, 0);
    const lista = [...mapa.entries()].map(([id, c]) => ({ nome: id == null ? 'Sem categoria' : ((E.cats.find(x => x.id === id) || {}).name || 'Categoria apagada'), cents: c })).sort((a, b) => b.cents - a.cents);
    let fatias = lista;
    if (lista.length > 6) fatias = lista.slice(0, 5).concat([{ nome: 'Outras', cents: lista.slice(5).reduce((a, b) => a + b.cents, 0), outras: true }]);
    if (!totalG) $('aDonut').innerHTML = '<p class="mut">Sem gastos neste período.</p>';
    else Graficos.circulo($('aDonut'), fatias, totalG, 'Gastos por categoria: ' + fatias.map(f => f.nome + ' ' + Util.fmtEUR(f.cents)).join(', ') + '.');
  }
  function iniciar() {
    App.aoAtualizar(desenhar);
    document.addEventListener('vista', e => { if (e.detail === 'Graficos') desenhar(); });
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(desenhar, 150); });
    $('vGraficos').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (b) { modo = b.dataset.m; desenhar(); return; }
      const s = e.target.closest('button[data-esc]'); if (s) { ajustada = s.dataset.esc === 'ajustada'; try { localStorage.setItem('gastos-escala', ajustada ? 'ajustada' : 'normal'); } catch (x) { /* ignora */ } desenhar(); } });
  }
  return { iniciar, desenhar };
})();
