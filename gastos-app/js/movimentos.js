'use strict';
/* Ecrã Movimentos: pesquisa de texto e filtros (tipo, categoria, período, mês, datas), total do filtrado e lista de 50 em 50. */
const Mov = (() => {
  const $ = id => document.getElementById(id);
  const E = App.E;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TIPOS = { ganho: 'Ganho', gasto: 'Gasto', investimento: 'Investimento', ajuste: 'Ajuste' };
  const PASSO = 50;
  let limite = PASSO, temporizador = null, inicial = false;

  const filtros = () => ({ q: $('mvQ').value, tipo: $('mvTipo').value, cat: $('mvCat').value, per: $('mvPer').value, de: $('mvDe').value, ate: $('mvAte').value });
  const nomeCat = id => { const c = E.cats.find(x => x.id === id); return c ? c.name : 'Sem categoria'; };

  function opcoes(sel, itens, valor) {
    sel.innerHTML = itens.map(([v, t]) => '<option value="' + esc(v) + '">' + esc(t) + '</option>').join('');
    sel.value = itens.some(([v]) => String(v) === String(valor)) ? valor : itens[0][0];
  }
  /** (Re)preenche as listas de escolha a partir dos dados, mantendo o que estava escolhido. */
  function preencherListas() {
    opcoes($('mvCat'), [['', 'Todas'], ['none', 'Sem categoria']].concat(E.cats.map(c => [String(c.id), c.name + (c.archived ? ' (arquivada)' : '')])), $('mvCat').value);
    opcoes($('mvPer'), [['', 'Todos']].concat([...E.pers].sort((a, b) => a.start < b.start ? 1 : -1).map(p => [String(p.id), p.name + ' (' + Util.isoToPt(p.start) + ' a ' + Util.isoToPt(p.end) + ')'])), $('mvPer').value);
    const meses = [...new Set(E.movs.map(m => m.date.slice(0, 7)))].sort().reverse();
    opcoes($('mvMes'), [['', 'Escolher mês…']].concat(meses.map(k => [k, Calc.titulo(k, 'mes')])), '');
  }
  function resumo(lista) {
    const soma = t => lista.filter(m => m.type === t).reduce((a, m) => a + m.cents, 0), n = t => lista.filter(m => m.type === t).length;
    const partes = [];
    if (n('ganho')) partes.push('Ganhos ' + Util.fmtEUR(soma('ganho')));
    if (n('gasto')) partes.push('Gastos ' + Util.fmtEUR(soma('gasto')));
    if (n('investimento')) partes.push('Investido ' + Util.fmtEUR(soma('investimento')));
    if (n('ajuste')) partes.push(n('ajuste') + (n('ajuste') === 1 ? ' ajuste' : ' ajustes'));
    return '<strong>' + lista.length + (lista.length === 1 ? ' movimento' : ' movimentos') + '</strong>' + (partes.length ? ' · ' + partes.join(' · ') : '');
  }
  function linha(m) {
    const sinal = m.type === 'ganho' ? '+' : m.type === 'gasto' ? '−' : '';
    const sub = Util.isoToPt(m.date) + (m.desc ? ' · ' + esc(m.desc) : '');
    const cat = m.type === 'gasto' || m.type === 'ganho' ? nomeCat(m.categoryId) : TIPOS[m.type];
    return '<li><button type="button" class="hrow" data-dia="' + m.date + '" aria-label="' + TIPOS[m.type] + ' de ' + Util.isoToPt(m.date) + ', ' + Util.fmtEUR(m.cents) + '. Abrir o dia">' +
      '<span class="h-esq"><strong>' + esc(cat) + '</strong><small>' + sub + '</small></span>' +
      '<span class="h-dir"><span class="h-val">' + sinal + Util.fmtEUR(m.cents) + '</span></span></button></li>';
  }
  function desenharLista() {
    const f = filtros(), lista = Calc.filtrar(E.movs, E.cats, E.pers, f);
    const ativos = ['tipo', 'cat', 'per', 'de', 'ate'].filter(k => f[k]).length;
    $('mvFiltrosT').textContent = 'Filtros' + (ativos ? ' (' + ativos + ' ativos)' : '');
    $('mvResumo').innerHTML = resumo(lista);
    $('mvLista').innerHTML = lista.length ? lista.slice(0, limite).map(linha).join('') : '<li class="vazio">Nenhum movimento corresponde à pesquisa.</li>';
    $('mvMais').hidden = lista.length <= limite;
    if (lista.length > limite) $('mvMais').textContent = 'Mostrar mais (' + Math.min(PASSO, lista.length - limite) + ' de ' + (lista.length - limite) + ' restantes)';
  }
  function desenhar() {
    const vazio = !E.movs.length;
    $('mvVazio').hidden = !vazio; $('mvCorpo').hidden = vazio;
    if (vazio) return;
    preencherListas(); desenharLista();
  }
  const agendar = () => { limite = PASSO; clearTimeout(temporizador); temporizador = setTimeout(desenharLista, 150); };
  const mudou = () => { limite = PASSO; desenharLista(); };

  function iniciar() {
    if (inicial) return; inicial = true;
    App.aoAtualizar(desenhar);
    document.addEventListener('vista', e => { if (e.detail === 'Movimentos') desenhar(); });
    $('mvQ').addEventListener('input', agendar);
    for (const id of ['mvTipo', 'mvCat', 'mvPer', 'mvDe', 'mvAte']) $(id).addEventListener('change', mudou);
    $('mvMes').addEventListener('change', () => {
      const k = $('mvMes').value; if (!k) return;
      const [a, m] = k.split('-').map(Number), ultimo = new Date(a, m, 0).getDate();
      $('mvDe').value = k + '-01'; $('mvAte').value = k + '-' + String(ultimo).padStart(2, '0');
      mudou();
    });
    $('mvLimpar').addEventListener('click', () => {
      $('mvQ').value = ''; $('mvDe').value = ''; $('mvAte').value = '';
      for (const id of ['mvTipo', 'mvCat', 'mvPer', 'mvMes']) $(id).selectedIndex = 0;
      mudou();
    });
    $('mvMais').addEventListener('click', () => { limite += PASSO; desenharLista(); });
    $('mvLista').addEventListener('click', e => {
      const b = e.target.closest('button[data-dia]'); if (b) Registo.abrirDia(b.dataset.dia, 'Movimentos');
    });
  }
  return { iniciar, desenhar };
})();
