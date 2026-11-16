'use strict';
/* Funções utilitárias (sem interface): dinheiro em cêntimos e datas. */
const Util = (() => {
  /** Texto -> cêntimos (inteiro). Aceita vírgula ou ponto. Vazio = 0. Inválido = null. */
  function parseMoney(txt) {
    let s = String(txt == null ? '' : txt).replace(/[\s\u00a0€]/g, '');
    if (s === '') return 0;
    if (!/^[+-]?[\d.,]+$/.test(s)) return null;
    let sinal = 1;
    if (s[0] === '-') { sinal = -1; s = s.slice(1); } else if (s[0] === '+') s = s.slice(1);
    const idx = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    let inteiro = s, dec = '';
    if (idx >= 0) { inteiro = s.slice(0, idx); dec = s.slice(idx + 1); }
    inteiro = inteiro.replace(/[.,]/g, '');
    if (!/^\d*$/.test(inteiro) || !/^\d{0,2}$/.test(dec) || inteiro.length > 12) return null;
    if (inteiro === '' && dec === '') return null;
    return sinal * (parseInt(inteiro || '0', 10) * 100 + parseInt((dec + '00').slice(0, 2), 10));
  }
  /** Cêntimos -> "1 234,56 €" */
  function fmtEUR(c) {
    const neg = c < 0, a = Math.abs(c);
    const i = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return (neg ? '-' : '') + i + ',' + String(a % 100).padStart(2, '0') + '\u00a0€';
  }
  /** Cêntimos -> texto para campos de edição, ex.: "1234,56" */
  function toInput(c) {
    const neg = c < 0, a = Math.abs(c);
    return (neg ? '-' : '') + Math.floor(a / 100) + ',' + String(a % 100).padStart(2, '0');
  }
  function validISO(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /** aaaa-mm-dd -> dd/mm/aaaa */
  function isoToPt(s) { return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4); }
  return { parseMoney, fmtEUR, toInput, validISO, todayISO, isoToPt };
})();
if (typeof module !== 'undefined') module.exports = Util;
