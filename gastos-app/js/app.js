'use strict';
/* Interface da Fase 1: Definições e dados. */
(() => {
  const $ = id => document.getElementById(id);
  const padrao = () => ({ initialSavings: 0, initialInvested: 0, startDate: Util.todayISO(), backupReminderDays: 14, lastBackup: null });
  let settings = padrao(), existe = false;

  function dizer(texto, ok = true) { const m = $('msg'); m.textContent = (ok ? '' : 'Erro: ') + texto; m.className = ok ? 'ok' : 'err'; }
  function limparErros() { document.querySelectorAll('.erro').forEach(e => e.textContent = ''); }
  function erroCampo(id, t) { $(id).textContent = 'Erro: ' + t; }

  function confirmar(titulo, texto, rotulo) {
    return new Promise(res => {
      const d = $('dlg');
      $('dlgTitle').textContent = titulo; $('dlgText').textContent = texto; $('dlgOk').textContent = rotulo;
      d.returnValue = '';
      d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true });
      d.showModal();
    });
  }

  function desenhar() {
    $('iSav').value = Util.toInput(settings.initialSavings);
    $('iInv').value = Util.toInput(settings.initialInvested);
    $('iDate').value = settings.startDate;
    $('iDias').value = settings.backupReminderDays;
    $('ultimo').textContent = settings.lastBackup
      ? 'Último backup: ' + Util.isoToPt(settings.lastBackup.slice(0, 10)) + '.'
      : 'Ainda não fizeste nenhum backup.';
    const av = $('aviso');
    let txt = '';
    if (existe) {
      if (!settings.lastBackup) txt = 'Ainda não fizeste nenhum backup. Exporta um em Backup.';
      else {
        const dias = Math.floor((Date.now() - Date.parse(settings.lastBackup)) / 864e5);
        if (dias >= settings.backupReminderDays) txt = 'Passaram ' + dias + ' dias desde o último backup. Exporta um novo.';
      }
    }
    av.textContent = txt; av.hidden = !txt;
  }

  async function guardar() { await DB.setSettings(settings); existe = true; }

  $('fIniciais').addEventListener('submit', async e => {
    e.preventDefault(); limparErros();
    const s = Util.parseMoney($('iSav').value), i = Util.parseMoney($('iInv').value), d = $('iDate').value;
    let ok = true;
    if (s === null) { erroCampo('eSav', 'valor inválido. Exemplo: 1 234,56'); ok = false; }
    if (i === null) { erroCampo('eInv', 'valor inválido. Exemplo: 1 234,56'); ok = false; }
    else if (i < 0) { erroCampo('eInv', 'o valor investido não pode ser negativo.'); ok = false; }
    if (!Util.validISO(d)) { erroCampo('eDate', 'escolhe uma data válida.'); ok = false; }
    if (!ok) return dizer('Corrige os campos indicados.', false);
    try {
      settings = { ...settings, initialSavings: s, initialInvested: i, startDate: d };
      await guardar(); desenhar(); dizer('Valores iniciais guardados.');
    } catch (err) { dizer('Não foi possível guardar: ' + err.message, false); }
  });

  $('fDias').addEventListener('submit', async e => {
    e.preventDefault(); limparErros();
    const t = $('iDias').value.trim(), n = Number(t);
    if (!/^\d+$/.test(t) || n < 1 || n > 365) { erroCampo('eDias', 'escreve um número inteiro entre 1 e 365.'); return dizer('Corrige os campos indicados.', false); }
    try { settings.backupReminderDays = n; await guardar(); desenhar(); dizer('Lembrete guardado.'); }
    catch (err) { dizer('Não foi possível guardar: ' + err.message, false); }
  });

  $('bExp').addEventListener('click', async () => {
    try {
      settings.lastBackup = new Date().toISOString();
      await guardar();
      const dados = await DB.exportAll();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
      a.download = 'backup-gastos-' + Util.todayISO() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      desenhar(); dizer('Backup exportado. Guarda o ficheiro num local seguro.');
    } catch (err) { dizer('Não foi possível exportar: ' + err.message, false); }
  });

  $('bImp').addEventListener('click', () => $('fImp').click());
  $('fImp').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let dados;
    try { dados = JSON.parse(await f.text()); } catch { return dizer('O ficheiro não é um JSON válido.', false); }
    const v = DB.validate(dados);
    if (!v.ok) return dizer(v.erro, false);
    const r = v.resumo;
    const resumo = 'Saldo inicial da poupança: ' + Util.fmtEUR(r.settings.initialSavings) +
      '\nValor já investido: ' + Util.fmtEUR(r.settings.initialInvested) +
      '\nData de início: ' + Util.isoToPt(r.settings.startDate) +
      '\nMovimentos: ' + r.movimentos + ' · Categorias: ' + r.categorias +
      '\nRecorrentes: ' + r.recorrentes + ' · Períodos: ' + r.periodos + ' · Metas: ' + r.metas +
      '\n\nIsto substitui todos os dados atuais.';
    if (!await confirmar('Importar este backup?', resumo, 'Substituir dados')) return dizer('Importação cancelada.');
    try {
      await DB.importAll(dados); settings = { ...padrao(), ...dados.settings }; existe = true;
      desenhar(); dizer('Backup importado com sucesso.');
    } catch (err) { dizer('Não foi possível importar. Os dados atuais mantêm-se. ' + err.message, false); }
  });

  $('bDel').addEventListener('click', async () => {
    if (!await confirmar('Apagar todos os dados?', 'Vais apagar valores iniciais e todos os registos deste dispositivo.', 'Continuar')) return;
    if (!await confirmar('Tens a certeza?', 'Esta ação não se pode desfazer. Só os backups que exportaste ficam guardados.', 'Apagar tudo')) return;
    try { await DB.clearAll(); settings = padrao(); existe = false; limparErros(); desenhar(); dizer('Todos os dados foram apagados.'); }
    catch (err) { dizer('Não foi possível apagar: ' + err.message, false); }
  });

  async function armazenamento() {
    let t = 'Armazenamento persistente indisponível neste navegador. Faz backups com regularidade.';
    try {
      if (navigator.storage && navigator.storage.persist) {
        let p = await navigator.storage.persisted();
        if (!p) p = await navigator.storage.persist();
        t = p ? 'Armazenamento persistente ativo: o navegador não apaga os teus dados sozinho.'
              : 'O navegador não concedeu armazenamento persistente. Faz backups com regularidade.';
      }
    } catch { /* mantém a mensagem por omissão */ }
    $('stor').textContent = t;
  }

  async function iniciar() {
    try { const s = await DB.getSettings(); if (s) { settings = { ...padrao(), ...s }; existe = true; } }
    catch (err) { dizer('Não foi possível ler os dados guardados: ' + err.message, false); }
    desenhar(); armazenamento();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => { $('off').textContent = 'Modo offline indisponível aqui.'; });
      navigator.serviceWorker.ready.then(() => { $('off').textContent = 'Pronta para usar offline.'; });
    } else $('off').textContent = 'Modo offline indisponível neste navegador.';
  }
  iniciar();
})();
