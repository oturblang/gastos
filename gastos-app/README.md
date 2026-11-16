# Gastos — Fase 3 (Poupança e investimentos)

## Publicar no GitHub Pages
1. Cria um repositório no GitHub (ex.: `gastos`).
2. Carrega **todos** os ficheiros mantendo as pastas (`js/`, `icons/`): `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`.
3. Em *Settings → Pages*, escolhe *Deploy from a branch*, branch `main`, pasta `/ (root)`.
4. Após 1–2 minutos, abre `https://utilizador.github.io/gastos/`.

## Instalar
- **Telemóvel (Android/Chrome):** menu ⋮ → *Instalar aplicação*. **iPhone/Safari:** Partilhar → *Adicionar ao ecrã principal*.
- **Computador (Chrome/Edge):** ícone de instalar na barra de endereço.

## Como funciona
1. **Início:** preenche os valores iniciais e guarda. A tabela é criada logo a seguir.
2. **Tabela:** escreve ganhos, gastos, investido e ajustes. Podes adicionar dias antes e depois.
3. **Início, Demonstração:** gráficos e números calculados a partir da tabela.

## Atualizações
Quando alterares ficheiros, aumenta `CACHE` em `sw.js` (`gastos-v2`, …) para os dispositivos receberem a versão nova.
A app só funciona por `https` ou `localhost` (não abrindo o ficheiro diretamente).

## Novidades da Fase 3
- **Poupança**: saldo, histórico de todos os movimentos com o saldo depois de cada um, «Adicionar dinheiro», ajuste manual e meta de poupança.
- **Investimentos**: capital investido, histórico, regras semanais (criar, editar, pausar, apagar) e meta de investimento. Ao abrir a app, os investimentos em falta são criados sem duplicar.
- **Apagar**: colunas (primeira ou última), conteúdo de um dia e categorias, sempre com confirmação e «Desfazer».
- **Tabela**: o dia escolhido em «Ir» fica destacado a azul, com a etiqueta «escolhido».
- Backup passa à versão 3 (os backups antigos continuam a ser aceites).
