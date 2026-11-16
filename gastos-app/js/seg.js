'use strict';
/* Segurança: bloqueio da app (PIN ou palavra-passe, impressão digital/rosto opcional) e backup cifrado.
   O bloqueio é um «fecho de ecrã»: esconde a app, mas NÃO cifra os dados guardados. A configuração fica só neste aparelho
   (localStorage), nunca no backup. O backup protegido usa AES-GCM com chave derivada da palavra-passe (PBKDF2-SHA256). */
const Seg = (() => {
  const $ = id => document.getElementById(id);
  const KEY = 'gastos-lock', KEY_F = 'gastos-lock-falhas', FORMATO = 'gastos-app-backup-cifrado';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const temCripto = !!(window.crypto && crypto.subtle);
  const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
  const unb64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const dizer = (t, ok = true) => { if (window.App) App.dizer(t, ok); };

  // ---------- Criptografia ----------
  async function base(texto) { return crypto.subtle.importKey('raw', enc.encode(texto), 'PBKDF2', false, ['deriveBits', 'deriveKey']); }
  async function hash(codigo, salt, iter) {
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, await base(codigo), 256));
  }
  async function chaveAes(senha, salt, iter) {
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, await base(senha), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  /** Cifra o backup (objeto) com uma palavra-passe. Devolve o «envelope» a gravar em JSON. */
  async function cifrar(dados, senha) {
    if (!temCripto) throw new Error('Este navegador não suporta cifragem (precisa de ligação segura, https).');
    const salt = rnd(16), iv = rnd(12), iter = 250000;
    const dadosCif = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chaveAes(senha, salt, iter), enc.encode(JSON.stringify(dados)));
    return { format: FORMATO, version: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), data: b64(dadosCif) };
  }
  /** Abre um envelope. Lança «SENHA» se a palavra-passe estiver errada (ou o ficheiro estiver danificado). */
  async function decifrar(env, senha) {
    if (!temCripto) throw new Error('Este navegador não suporta cifragem (precisa de ligação segura, https).');
    if (!env || env.format !== FORMATO || env.kdf !== 'PBKDF2-SHA256' || !(env.iter >= 1000 && env.iter <= 5e6) || !env.salt || !env.iv || !env.data) throw new Error('O ficheiro protegido não é válido.');
    let claro;
    try { claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, await chaveAes(senha, unb64(env.salt), env.iter), unb64(env.data)); }
    catch { throw new Error('SENHA'); }
    return JSON.parse(dec.decode(claro));
  }

  // ---------- Configuração do bloqueio (só neste aparelho) ----------
  const cfg = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const gravar = c => { try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); return true; } catch { return false; } };
  const falhas = () => { try { return JSON.parse(localStorage.getItem(KEY_F) || '{"n":0,"ate":0}'); } catch { return { n: 0, ate: 0 }; } };
  const gravarFalhas = f => { try { f.n ? localStorage.setItem(KEY_F, JSON.stringify(f)) : localStorage.removeItem(KEY_F); } catch { /* ignora */ } };
  async function verificar(codigo, c = cfg()) { return !!c && await hash(codigo, unb64(c.salt), c.iter) === c.hash; }
  async function novaConfig(tipo, codigo, antiga) {
    const salt = rnd(16), iter = 150000;
    return { v: 1, tipo, salt: b64(salt), iter, hash: await hash(codigo, salt, iter), auto: antiga ? antiga.auto : 1, bio: antiga ? antiga.bio : null };
  }
  const valida = (tipo, c) => tipo === 'pin' ? (/^\d{4,8}$/.test(c) ? '' : 'O PIN tem de ter entre 4 e 8 números.') : (c.length >= 6 ? '' : 'A palavra-passe tem de ter pelo menos 6 caracteres.');

  // ---------- Caixa para pedir um código ----------
  /** Pede um código/palavra-passe. `validar` (opcional, pode ser assíncrona) devolve o texto do erro ou ''. Devolve o texto ou null se cancelar. */
  function pedir({ titulo, texto, rotulo, tipo = 'senha', confirmar = false, validar }) {
    return new Promise(res => {
      const d = $('dSeg');
      $('sgTitulo').textContent = titulo; $('sgTexto').textContent = texto || ''; $('sgOk').textContent = rotulo || 'Guardar';
      $('sgA').value = ''; $('sgB').value = ''; $('sgErro').textContent = '';
      $('sgA').inputMode = $('sgB').inputMode = tipo === 'pin' ? 'numeric' : 'text';
      $('sgLB').hidden = $('sgB').hidden = !confirmar;
      $('sgLA').textContent = tipo === 'pin' ? 'PIN' : 'Palavra-passe';
      let valor = null;
      const ok = async e => {
        e.preventDefault();
        const a = $('sgA').value;
        if (!a) { $('sgErro').textContent = 'Escreve o ' + (tipo === 'pin' ? 'PIN' : 'a palavra-passe') + '.'; return; }
        if (confirmar && a !== $('sgB').value) { $('sgErro').textContent = 'Os dois campos não são iguais.'; return; }
        $('sgOk').disabled = true;
        const erro = validar ? await validar(a) : '';
        $('sgOk').disabled = false;
        if (erro) { $('sgErro').textContent = erro; $('sgA').select(); return; }
        valor = a; d.close('ok');
      };
      const cancelar = () => d.close('cancel');
      $('fSeg').addEventListener('submit', ok); $('sgCancel').addEventListener('click', cancelar);
      d.addEventListener('close', () => { $('fSeg').removeEventListener('submit', ok); $('sgCancel').removeEventListener('click', cancelar); $('sgA').value = $('sgB').value = ''; res(valor); }, { once: true });
      d.showModal(); $('sgA').focus();
    });
  }
  /** Para abrir um backup protegido: pede a palavra-passe até acertar ou cancelar. Devolve os dados ou null. */
  async function abrirCifrado(env) {
    let dados = null;
    await pedir({ titulo: 'Backup protegido', texto: 'Este backup está protegido. Escreve a palavra-passe com que foi exportado.', rotulo: 'Abrir', tipo: 'senha',
      validar: async s => { try { dados = await decifrar(env, s); return ''; } catch (e) { return e.message === 'SENHA' ? 'Palavra-passe errada.' : e.message; } } });
    return dados;
  }

  // ---------- Impressão digital / rosto (WebAuthn, autenticador do próprio aparelho) ----------
  async function bioDisponivel() {
    try { return !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
  }
  async function bioRegistar() {
    const c = await navigator.credentials.create({ publicKey: { challenge: rnd(32), rp: { name: 'Gastos' }, user: { id: rnd(16), name: 'gastos', displayName: 'Gastos' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], attestation: 'none', timeout: 60000,
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' } } });
    return b64(c.rawId);
  }
  async function bioVerificar(id) {
    await navigator.credentials.get({ publicKey: { challenge: rnd(32), timeout: 60000, userVerification: 'required', allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }] } });
    return true;
  }

  // ---------- Ecrã de bloqueio ----------
  const raiz = document.documentElement;
  const bloqueado = () => !$('lock').hidden && !$('lock').classList.contains('capa');
  let saiu = 0, tentouBio = false;
  function mostrarBloqueio(autoBio) {
    const c = cfg(); if (!c) return desbloquear();
    const l = $('lock'); l.hidden = false; l.classList.remove('capa'); raiz.classList.add('bloqueado');
    $('lkCod').value = ''; $('lkCod').inputMode = c.tipo === 'pin' ? 'numeric' : 'text';
    $('lkTxt').textContent = c.tipo === 'pin' ? 'Escreve o PIN para abrir.' : 'Escreve a palavra-passe para abrir.';
    $('lkErro').textContent = ''; $('lkEsqueci').hidden = true; $('lkBio').hidden = !c.bio;
    atualizarEspera(); $('lkCod').focus();
    if (autoBio && c.bio && !tentouBio) { tentouBio = true; tentarBio(); }
  }
  function desbloquear() { $('lock').hidden = true; $('lock').classList.remove('capa'); raiz.classList.remove('bloqueado'); tentouBio = false; }
  function capa() { const l = $('lock'); if (!l.hidden) return; l.classList.add('capa'); l.hidden = false; }
  let temporizador = 0;
  function atualizarEspera() {
    clearInterval(temporizador);
    const f = falhas(), resta = Math.ceil((f.ate - Date.now()) / 1000);
    const bloq = resta > 0;
    $('lkCod').disabled = bloq; $('lkOk').disabled = bloq;
    if (bloq) {
      $('lkErro').textContent = 'Demasiadas tentativas. Tenta de novo em ' + resta + ' s.';
      temporizador = setInterval(() => { const r = Math.ceil((falhas().ate - Date.now()) / 1000); if (r <= 0) { clearInterval(temporizador); $('lkErro').textContent = ''; $('lkCod').disabled = false; $('lkOk').disabled = false; $('lkCod').focus(); } else $('lkErro').textContent = 'Demasiadas tentativas. Tenta de novo em ' + r + ' s.'; }, 500);
    }
  }
  async function tentarBio() {
    const c = cfg(); if (!c || !c.bio) return;
    try { await bioVerificar(c.bio); gravarFalhas({ n: 0, ate: 0 }); desbloquear(); }
    catch { /* cancelado ou indisponível: continua com o código */ }
  }
  $('lkForm').addEventListener('submit', async e => {
    e.preventDefault();
    const c = cfg(); if (!c) return desbloquear();
    const v = $('lkCod').value; if (!v) return;
    $('lkOk').disabled = true;
    const certo = await verificar(v, c);
    $('lkOk').disabled = false;
    if (certo) { gravarFalhas({ n: 0, ate: 0 }); desbloquear(); return; }
    const f = falhas(); f.n++; 
    if (f.n >= 5) f.ate = Date.now() + Math.min(600, 30 * Math.pow(2, f.n - 5)) * 1000;
    gravarFalhas(f); $('lkCod').value = '';
    $('lkErro').textContent = c.tipo === 'pin' ? 'PIN errado.' : 'Palavra-passe errada.';
    atualizarEspera(); $('lkCod').focus();
  });
  $('lkBio').addEventListener('click', tentarBio);
  $('lkEsqueciB').addEventListener('click', () => { $('lkEsqueci').hidden = !$('lkEsqueci').hidden; });
  $('lkApagar').addEventListener('click', async () => {
    if (!await App.confirmar('Apagar tudo e recomeçar?', 'Isto apaga todos os dados deste aparelho e remove o bloqueio. Só os backups que exportaste ficam guardados. Depois podes importar o último backup.', 'Apagar tudo')) return;
    try { await DB.clearAll(); gravar(null); gravarFalhas({ n: 0, ate: 0 }); location.reload(); } catch (err) { dizer('Não foi possível apagar: ' + err.message, false); }
  });
  document.addEventListener('visibilitychange', () => {
    const c = cfg(); if (!c) return;
    if (document.hidden) { if (!bloqueado()) { saiu = Date.now(); capa(); } return; }
    if (!$('lock').classList.contains('capa')) return;
    const limite = c.auto;   // 0: sempre; N: minutos; -1: só ao abrir a app
    if (limite === -1) return desbloquear();
    if (limite === 0 || Date.now() - saiu >= limite * 60000) mostrarBloqueio(true); else desbloquear();
  });

  // ---------- Definições › Segurança ----------
  let tipoEscolhido = 'pin';
  async function desenhar() {
    const c = cfg(), on = !!c;
    $('sgEstado').textContent = on ? 'Bloqueio ligado (' + (c.tipo === 'pin' ? 'PIN' : 'palavra-passe') + ').' : 'Bloqueio desligado.';
    $('sgAtivar').hidden = on; $('sgTipo').hidden = false; $('sgOn').hidden = !on;
    document.querySelectorAll('#sgTipo button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === tipoEscolhido)));
    $('sgTipoTxt').textContent = on ? 'Tipo do novo código (ao mudar):' : 'Escolhe o tipo de código:';
    if (on) {
      $('sgAuto').value = String(c.auto);
      const disp = await bioDisponivel();
      $('sgBio').textContent = c.bio ? 'Desligar impressão digital / rosto' : 'Ligar impressão digital / rosto';
      $('sgBio').disabled = !disp && !c.bio;
      $('sgBioNota').textContent = disp ? 'Usa o desbloqueio do próprio telemóvel. O código continua a funcionar sempre.' : 'Não está disponível neste aparelho ou navegador.';
    }
  }
  $('sgTipo').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) { tipoEscolhido = b.dataset.t; desenhar(); } });
  $('sgAtivar').addEventListener('click', async () => {
    if (!temCripto) return dizer('Este navegador não permite ativar o bloqueio (precisa de ligação segura).', false);
    const cod = await pedir({ titulo: 'Ativar bloqueio', rotulo: 'Ativar', tipo: tipoEscolhido, confirmar: true,
      texto: (tipoEscolhido === 'pin' ? 'Escolhe um PIN de 4 a 8 números.' : 'Escolhe uma palavra-passe com pelo menos 6 caracteres.') + ' Escreve-o duas vezes. Se te esqueceres, só consegues entrar apagando os dados (e importando um backup).',
      validar: s => valida(tipoEscolhido, s) });
    if (!cod) return;
    if (!gravar(await novaConfig(tipoEscolhido, cod))) return dizer('Este navegador não deixa guardar a definição.', false);
    gravarFalhas({ n: 0, ate: 0 }); desenhar(); dizer('Bloqueio ativado.');
  });
  $('sgMudar').addEventListener('click', async () => {
    const c = cfg(); if (!c) return;
    const atual = await pedir({ titulo: 'Mudar o código', texto: 'Primeiro, escreve o código atual.', rotulo: 'Continuar', tipo: c.tipo, validar: async s => await verificar(s, c) ? '' : 'Código errado.' });
    if (!atual) return;
    const novo = await pedir({ titulo: 'Novo código', rotulo: 'Guardar', tipo: tipoEscolhido, confirmar: true, texto: 'Escreve o novo código duas vezes.', validar: s => valida(tipoEscolhido, s) });
    if (!novo) return;
    gravar(await novaConfig(tipoEscolhido, novo, c)); desenhar(); dizer('Código alterado.');
  });
  $('sgDesativar').addEventListener('click', async () => {
    const c = cfg(); if (!c) return;
    const atual = await pedir({ titulo: 'Desativar o bloqueio', texto: 'Escreve o código atual para desligar o bloqueio.', rotulo: 'Desativar', tipo: c.tipo, validar: async s => await verificar(s, c) ? '' : 'Código errado.' });
    if (!atual) return;
    gravar(null); gravarFalhas({ n: 0, ate: 0 }); desenhar(); dizer('Bloqueio desativado.');
  });
  $('sgAgora').addEventListener('click', () => mostrarBloqueio(false));
  $('sgAuto').addEventListener('change', () => { const c = cfg(); if (!c) return; c.auto = Number($('sgAuto').value); gravar(c); dizer('Guardado.'); });
  $('sgBio').addEventListener('click', async () => {
    const c = cfg(); if (!c) return;
    if (c.bio) { c.bio = null; gravar(c); desenhar(); return dizer('Impressão digital / rosto desligados.'); }
    try { c.bio = await bioRegistar(); gravar(c); desenhar(); dizer('Impressão digital / rosto ligados.'); }
    catch (e) { dizer(e && e.name === 'NotAllowedError' ? 'Cancelaste ou o aparelho não deixou ligar.' : 'Não foi possível ligar: ' + (e && e.message), false); }
  });
  document.addEventListener('vista', e => { if (e.detail === 'Definicoes') desenhar(); });
  desenhar();

  // arranque: se há bloqueio, pede o código antes de mostrar a app
  if (cfg()) mostrarBloqueio(true); else desbloquear();
  return { FORMATO, cifrar, decifrar, abrirCifrado, pedir, verificar, temCripto, cfg };
})();
