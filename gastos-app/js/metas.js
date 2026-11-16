'use strict';
/* Metas: uma de poupança e uma de investimento (valor alvo e data opcional), com barra de progresso em percentagem. */
const Metas = (() => {
  const E = App.E;
  const NOME = { poupanca: 'Meta de poupança', investimento: 'Meta de investimento' };
  const meta = k => E.goals.find(g => g.kind === k);
  const atual = k => { const t = Calc.total(E.settings, E.movs, '9999-12-31'); return k === 'poupanca' ? t.poup : t.capital; };
  const fmtPct = p => (p < 10 ? Math.round(p * 10) / 10 : Math.round(p)).toLocaleString('pt-PT') + ' %';

  /** Barra de progresso com a percentagem escrita (nunca só cor). compacto = versão do Início. */
  function html(k, compacto) {
    const g = meta(k);
    if (!g) return compacto ? '' : '<p class="mut">Ainda não definiste esta meta.</p>';
    const a = atual(k), p = Calc.progresso(a, g.targetCents), pct = fmtPct(p.pct);
    const sub = (p.atingida ? 'Meta atingida ✓' : 'Faltam ' + Util.fmtEUR(p.faltam)) + (g.date ? ' · até ' + Util.isoToPt(g.date) : '');
    return '<div class="meta"><div class="tit">' + NOME[k] + ': ' + Util.fmtEUR(a) + ' de ' + Util.fmtEUR(g.targetCents) + ' (' + pct + ')</div>' +
      '<div class="prog p-' + k + '" role="progressbar" aria-label="' + NOME[k] + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(p.barra) + '" aria-valuetext="' + pct + '"><span style="width:' + p.barra + '%"></span></div>' +
      '<div class="sub">' + sub + '</div></div>';
  }
  /** Bloco completo (barra + formulário para definir ou alterar). */
  function bloco(k) {
    const g = meta(k);
    return '<h3>' + NOME[k] + '</h3>' + html(k, false) +
      '<details class="caixa"><summary>' + (g ? 'Alterar meta' : 'Definir meta') + '</summary>' +
      '<form class="fMeta" data-k="' + k + '" novalidate><label>Valor alvo (€)<input name="v" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + (g ? Util.toInput(g.targetCents) : '') + '"></label>' +
      '<label>Data (opcional)<input name="d" type="date" value="' + (g && g.date ? g.date : '') + '"></label><p class="erro" role="alert"></p>' +
      '<button type="submit" class="primario">Guardar meta</button>' + (g ? '<button type="button" class="perigo" data-rm-meta="' + k + '">Apagar meta</button>' : '') + '</form></details>';
  }
  function iniciar() {
    document.addEventListener('submit', async e => {
      const f = e.target.closest && e.target.closest('.fMeta'); if (!f) return;
      e.preventDefault();
      const k = f.dataset.k, erro = f.querySelector('.erro'), v = Util.parseMoney(f.elements.v.value), d = f.elements.d.value;
      erro.textContent = '';
      if (v === null || v <= 0) { erro.textContent = 'Erro: escreve um valor alvo maior que zero. Exemplo: 5 000,00'; return; }
      if (d && !Util.validISO(d)) { erro.textContent = 'Erro: escolhe uma data válida ou deixa em branco.'; return; }
      try {
        await DB.put('goals', { ...(meta(k) || {}), kind: k, targetCents: v, date: d || null });
        await App.carregar(); App.atualizar(); App.dizer(NOME[k] + ' guardada.');
      } catch (err) { App.dizer('Não foi possível guardar: ' + err.message, false); }
    });
    document.addEventListener('click', async e => {
      const b = e.target.closest && e.target.closest('[data-rm-meta]'); if (!b) return;
      const g = meta(b.dataset.rmMeta); if (!g) return;
      if (!await App.confirmar('Apagar a meta?', NOME[g.kind] + ' de ' + Util.fmtEUR(g.targetCents) + '. Os teus movimentos não mudam.', 'Apagar')) return;
      try {
        await DB.del('goals', g.id); await App.carregar(); App.atualizar();
        App.dizer('Meta apagada.', true, { rotulo: 'Desfazer', fn: async () => { await DB.put('goals', g); await App.carregar(); App.atualizar(); App.dizer('Meta reposta.'); } });
      } catch (err) { App.dizer('Não foi possível apagar: ' + err.message, false); }
    });
  }
  return { html, bloco, iniciar };
})();
