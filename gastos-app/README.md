# Gastos — Fase 2 (Registo diário)

## Publicar no GitHub Pages
1. Cria um repositório no GitHub (ex.: `gastos`).
2. Carrega **todos** os ficheiros mantendo as pastas (`js/`, `icons/`): `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`.
3. Em *Settings → Pages*, escolhe *Deploy from a branch*, branch `main`, pasta `/ (root)`.
4. Após 1–2 minutos, abre `https://utilizador.github.io/gastos/`.

## Instalar
- **Telemóvel (Android/Chrome):** menu ⋮ → *Instalar aplicação*. **iPhone/Safari:** Partilhar → *Adicionar ao ecrã principal*.
- **Computador (Chrome/Edge):** ícone de instalar na barra de endereço.

## Testar a Fase 2
1. Definições: guarda os valores iniciais. Em Categorias deves ver as 6 sugestões.
2. «+ Registar»: cria um gasto de `12,50` e vê o Resumo mudar.
3. Tabela: escreve um valor na célula Ganhos de hoje; as linhas Sobra, Poupança e Capital recalculam.
4. Toca num dia (cabeçalho): escreve a descrição do dia e adiciona, edita e apaga movimentos.
5. Edita um dia antigo: a poupança de todos os dias seguintes muda.
6. «Adicionar dias» no fim e no início, e «Ir para a data».
7. Exporta e importa um backup: tudo volta igual.

## Atualizações
Quando alterares ficheiros, aumenta `CACHE` em `sw.js` (`gastos-v2`, …) para os dispositivos receberem a versão nova.
A app só funciona por `https` ou `localhost` (não abrindo o ficheiro diretamente).
