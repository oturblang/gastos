'use strict';
/* Gráficos em SVG puro (sem bibliotecas, funcionam offline). Valores em cêntimos.
   Cores: azul/laranja/verde-água validadas como conjunto (ganhos, gastos, investido); laranja em degraus para as categorias de gastos. */
const Graficos = (() => {
  const COR = { ganho: '#2a78d6', gasto: '#eb6834', investimento: '#1baf7a', poupanca: '#6250d6', capital: '#1baf7a' };
  const FATIAS = ['#8a2f0e', '#b8431a', '#eb6834', '#f08f66', '#f5b49a', '#fad6c6'];
  const OUTRAS = '#898781';
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const attr = t => esc(t).replace(/\n/g, '&#10;');

  /** Escala com valores "redondos" (múltiplos de 1, 2, 2,5, 5 × 10^n), no mínimo de 1 € por degrau. */
  function escala(min, max) {
    if (max <= min) max = min + 10000;
    const raw = (max - min) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    let passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
    passo = Math.max(passo, 100);
    const lo = Math.floor(min / passo + 1e-9) * passo, hi = Math.ceil(max / passo - 1e-9) * passo, ticks = [];
    for (let v = lo; v <= hi + passo / 2; v += passo) ticks.push(Math.round(v));
    return { min: lo, max: hi, ticks };
  }
  const pt = n => Math.round(n * 10) / 10;

  function barraPath(x, yTopo, w, h) {
    const r = Math.min(4, h, w / 2), yb = yTopo + h;   // 4px arredondado no topo, reto na base
    return 'M' + pt(x) + ',' + pt(yb) + 'V' + pt(yTopo + r) + 'Q' + pt(x) + ',' + pt(yTopo) + ' ' + pt(x + r) + ',' + pt(yTopo) +
      'H' + pt(x + w - r) + 'Q' + pt(x + w) + ',' + pt(yTopo) + ' ' + pt(x + w) + ',' + pt(yTopo + r) + 'V' + pt(yb) + 'Z';
  }

  /** Barras agrupadas: ganhos, gastos e investimentos por período. O eixo vertical fica fixo; só as barras deslizam. */
  function barras(el, itens, rotulos, titulos, resumo) {
    const EIXO = 58, ML = 8, MR = 8, MT = 10, MB = 28, H = 230;
    const larg = Math.max(el.clientWidth || 320, 300) - EIXO;
    const n = itens.length, gw = Math.max(50, (larg - ML - MR) / n), W = Math.ceil(ML + MR + gw * n);
    const max = Math.max(0, ...itens.map(i => Math.max(i.ganho, i.gasto, i.investimento)));
    const sc = escala(0, max), y = v => MT + (H - MT - MB) * (1 - (v - sc.min) / (sc.max - sc.min));
    const bw = Math.max(6, Math.min(20, Math.floor((gw - 14) / 3) - 2)), tipos = ['ganho', 'gasto', 'investimento'];
    let eixo = '<svg class="eixo" width="' + EIXO + '" height="' + H + '" viewBox="0 0 ' + EIXO + ' ' + H + '" aria-hidden="true">';
    let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + attr(resumo) + '">';
    sc.ticks.forEach(t => {
      s += '<line class="gl" x1="0" x2="' + (W - MR) + '" y1="' + pt(y(t)) + '" y2="' + pt(y(t)) + '"/>';
      eixo += '<text class="tx" x="' + (EIXO - 8) + '" y="' + pt(y(t) + 4) + '" text-anchor="end">' + esc(Util.fmtEixo(t)) + '</text>';
    });
    s += '<line class="bl" x1="0" x2="' + (W - MR) + '" y1="' + pt(y(0)) + '" y2="' + pt(y(0)) + '"/>';
    itens.forEach((it, i) => {
      const cx = ML + gw * (i + 0.5), x0 = cx - (3 * bw + 4) / 2;
      tipos.forEach((tp, k) => {
        if (it[tp] > 0) s += '<path d="' + barraPath(x0 + k * (bw + 2), y(it[tp]), bw, y(0) - y(it[tp])) + '" fill="' + COR[tp] + '"/>';
      });
      s += '<text class="tx" x="' + pt(cx) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(rotulos[i]) + '</text>';
      const tip = titulos[i] + '\nGanhos: ' + Util.fmtEUR(it.ganho) + '\nGastos: ' + Util.fmtEUR(it.gasto) + '\nInvestido: ' + Util.fmtEUR(it.investimento);
      s += '<rect class="hit" x="' + pt(ML + gw * i) + '" y="' + MT + '" width="' + pt(gw) + '" height="' + (H - MT - MB) + '" fill="transparent" pointer-events="all" data-tip="' + attr(tip) + '"/>';
    });
    el.innerHTML = '<div class="barras-wrap">' + eixo + '</svg><div class="barras-scroll">' + s + '</svg></div></div>';
    const rolar = el.querySelector('.barras-scroll'); rolar.scrollLeft = rolar.scrollWidth;   // mostra os períodos mais recentes
  }

  /** Duas linhas: poupança e capital investido ao longo do tempo. */
  function linha(el, pts, rotulos, titulos, resumo) {
    const larg = Math.max(el.clientWidth || 320, 300), ML = 56, MR = 92, MT = 14, MB = 28, H = 220, n = pts.length;
    const vals = pts.flatMap(p => [p.poup, p.capital]), sc = escala(Math.min(0, ...vals), Math.max(0, ...vals));
    const util = larg - ML - MR, X = i => n === 1 ? ML + util / 2 : ML + util * i / (n - 1);
    const y = v => MT + (H - MT - MB) * (1 - (v - sc.min) / (sc.max - sc.min));
    let s = '<svg width="' + larg + '" height="' + H + '" viewBox="0 0 ' + larg + ' ' + H + '" role="img" aria-label="' + attr(resumo) + '">';
    sc.ticks.forEach(t => {
      s += '<line class="gl" x1="' + ML + '" x2="' + (larg - MR + 6) + '" y1="' + pt(y(t)) + '" y2="' + pt(y(t)) + '"/>' +
        '<text class="tx" x="' + (ML - 8) + '" y="' + pt(y(t) + 4) + '" text-anchor="end">' + esc(Util.fmtEixo(t)) + '</text>';
    });
    s += '<line class="bl" x1="' + ML + '" x2="' + (larg - MR + 6) + '" y1="' + pt(y(0)) + '" y2="' + pt(y(0)) + '"/>';
    const passoX = n > 1 ? util / (n - 1) : util, cada = Math.max(1, Math.ceil(46 / passoX));
    rotulos.forEach((r, i) => { if ((n - 1 - i) % cada === 0) s += '<text class="tx" x="' + pt(X(i)) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(r) + '</text>'; });
    const series = [['poup', COR.poupanca], ['capital', COR.capital]];
    series.forEach(([k, cor]) => {
      s += '<path d="' + pts.map((p, i) => (i ? 'L' : 'M') + pt(X(i)) + ',' + pt(y(p[k]))).join('') + '" fill="none" stroke="' + cor + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    });
    pts.forEach((p, i) => {   // zonas de passagem do rato/dedo, com linha vertical de referência
      const tip = titulos[i] + '\nPoupança: ' + Util.fmtEUR(p.poup) + '\nCapital investido: ' + Util.fmtEUR(p.capital);
      s += '<g class="pt" data-tip="' + attr(tip) + '"><line class="cruz" x1="' + pt(X(i)) + '" x2="' + pt(X(i)) + '" y1="' + MT + '" y2="' + (H - MB) + '"/>' +
        '<rect x="' + pt(X(i) - passoX / 2) + '" y="' + MT + '" width="' + pt(passoX) + '" height="' + (H - MT - MB) + '" fill="transparent" pointer-events="all"/></g>';
    });
    series.forEach(([k, cor]) => pts.forEach((p, i) => {
      s += '<circle cx="' + pt(X(i)) + '" cy="' + pt(y(p[k])) + '" r="4" fill="' + cor + '" stroke="#fcfcfb" stroke-width="2" pointer-events="none"/>';
    }));
    // valor final de cada linha (afastados se ficarem muito juntos)
    const ult = pts[n - 1], ya = y(ult.poup), yb = y(ult.capital);
    let ta = ya + 4, tb = yb + 4;
    if (Math.abs(ya - yb) < 15) { if (ya <= yb) { ta -= 8; tb += 8; } else { ta += 8; tb -= 8; } }
    s += '<text class="tx forte" x="' + pt(X(n - 1) + 10) + '" y="' + pt(ta) + '">' + esc(Util.fmtEUR(ult.poup)) + '</text>' +
      '<text class="tx forte" x="' + pt(X(n - 1) + 10) + '" y="' + pt(tb) + '">' + esc(Util.fmtEUR(ult.capital)) + '</text>';
    el.innerHTML = s + '</svg>';
  }

  function setor(cx, cy, r0, r1, a0, a1) {
    const grande = (a1 - a0) > Math.PI ? 1 : 0, p = (r, a) => [pt(cx + r * Math.sin(a)), pt(cy - r * Math.cos(a))];
    const A = p(r1, a0), B = p(r1, a1), C = p(r0, a1), D = p(r0, a0);
    return 'M' + A + 'A' + r1 + ',' + r1 + ' 0 ' + grande + ' 1 ' + B + 'L' + C + 'A' + r0 + ',' + r0 + ' 0 ' + grande + ' 0 ' + D + 'Z';
  }
  /** Círculo (anel) com a legenda ao lado: fatias = [{nome, cents}] já ordenadas do maior para o menor. */
  function circulo(el, fatias, total, resumo) {
    const S = 190, cx = S / 2, cy = S / 2, r1 = 88, r0 = 56, folga = 2 / 72;
    const cores = fatias.map((f, i) => f.outras ? OUTRAS : FATIAS[Math.min(i, FATIAS.length - 1)]);
    let s = '<svg width="' + S + '" height="' + S + '" viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="' + attr(resumo) + '">', a = 0;
    fatias.forEach((f, i) => {
      const ang = f.cents / total * Math.PI * 2, tip = f.nome + '\n' + Util.fmtEUR(f.cents) + ' (' + pct(f.cents, total) + ')';
      if (fatias.length === 1) {
        s += '<path fill-rule="evenodd" fill="' + cores[i] + '" data-tip="' + attr(tip) + '" d="M' + cx + ',' + (cy - r1) + 'A' + r1 + ',' + r1 + ' 0 1 1 ' + cx + ',' + (cy + r1) + 'A' + r1 + ',' + r1 + ' 0 1 1 ' + cx + ',' + (cy - r1) +
          'ZM' + cx + ',' + (cy - r0) + 'A' + r0 + ',' + r0 + ' 0 1 0 ' + cx + ',' + (cy + r0) + 'A' + r0 + ',' + r0 + ' 0 1 0 ' + cx + ',' + (cy - r0) + 'Z"/>';
      } else {
        const g = Math.min(folga, ang / 3);
        s += '<path fill="' + cores[i] + '" data-tip="' + attr(tip) + '" d="' + setor(cx, cy, r0, r1, a + g / 2, a + ang - g / 2) + '"/>';
      }
      a += ang;
    });
    s += '<text class="centro" x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle">' + esc(Util.fmtEixo(total)) + '</text>' +
      '<text class="tx" x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle">gastos</text></svg>';
    const lg = fatias.map((f, i) => '<li><span class="sw" style="background:' + cores[i] + '"></span><span class="nome">' + esc(f.nome) + '</span><span class="val">' +
      esc(Util.fmtEUR(f.cents)) + ' · ' + pct(f.cents, total) + '</span></li>').join('');
    el.innerHTML = '<div class="donut">' + s + '<ul class="legenda-v">' + lg + '</ul></div>';
  }
  function pct(c, total) { const p = c / total * 100; return (p > 0 && p < 1 ? '<1' : String(Math.round(p))) + ' %'; }

  /** Caixa de informação ao passar o rato / tocar numa barra, ponto ou fatia (texto em data-tip). */
  function iniciarTip() {
    const tip = document.getElementById('tip');
    const pos = (x, y) => {
      const r = tip.getBoundingClientRect();
      let l = x + 14, t = y - r.height - 10;
      if (l + r.width > innerWidth - 8) l = x - r.width - 14;
      if (l < 8) l = 8;
      if (t < 8) t = y + 18;
      tip.style.left = l + 'px'; tip.style.top = t + 'px';
    };
    const alvo = e => e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    const mostrar = (a, e) => { tip.textContent = a.dataset.tip; tip.hidden = false; pos(e.clientX, e.clientY); };
    document.addEventListener('pointerover', e => { const a = alvo(e); if (a) mostrar(a, e); });
    document.addEventListener('pointermove', e => { if (!tip.hidden) pos(e.clientX, e.clientY); });
    document.addEventListener('pointerout', e => { const a = alvo(e); if (a && !(e.relatedTarget && a.contains(e.relatedTarget))) tip.hidden = true; });
    document.addEventListener('pointerdown', e => { const a = alvo(e); if (a) mostrar(a, e); else tip.hidden = true; });
    document.addEventListener('scroll', () => { tip.hidden = true; }, true);
  }
  return { COR, FATIAS, OUTRAS, barras, linha, circulo, iniciarTip };
})();
