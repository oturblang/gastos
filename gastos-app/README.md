# Gastos — poupança e investimentos (estilo Excel)

App pessoal para registar gastos, ganhos e investimentos dia a dia, ver a poupança e o capital investido, e perceber se estás a gastar ou a poupar mais.
Funciona **offline**, é **gratuita**, sem contas, sem servidor e sem internet depois da primeira abertura. Os dados ficam só no teu dispositivo.

## O que tem
- **Início**: valores iniciais, categorias, backup (JSON), exportar CSV, apagar tudo e uma demonstração com gráficos e metas.
- **Tabela**: dias em colunas, como no Excel. Escreves nas células e tudo recalcula. Adiciona ou remove dias, vai a uma data (fica destacada), abre a página de cada dia.
- **Gráficos**: dias, semanas, meses e anos, comparação com o intervalo anterior, frequência de investimento e gastos por categoria.
- **Poupança**: saldo, histórico, adicionar dinheiro, ajuste manual e meta.
- **Investimentos**: capital investido, histórico, regras semanais (criar, editar, pausar, apagar) e meta.
- **Períodos**: viagens ou outros intervalos, cada um com a sua página (totais, tabela, gráficos e categorias).
- **Cálculos**: todas as fórmulas em linguagem simples, com exemplos feitos com os teus números.
- **Testes** (`testes.html`): 100 verificações automáticas dos cálculos, com dados inventados. Não mexem nos teus dados.

## Como publicar no GitHub Pages (uma vez)
1. Entra em github.com e abre o teu repositório (ou cria um novo, público).
2. Carrega em **Add file → Upload files**.
3. Arrasta para lá **a pasta `gastos-app`** (a pasta inteira, não os ficheiros soltos). Os caminhos têm de começar por `gastos-app/...`.
4. Desce a página e carrega em **Commit changes**.
5. Vai a **Settings → Pages**. Em *Source* escolhe **Deploy from a branch**, a branch **main** e a pasta **/ (root)**. Grava.
6. Espera 1 a 2 minutos (no separador **Actions** vês um visto verde quando termina).
7. O endereço fica `https://O-TEU-UTILIZADOR.github.io/NOME-DO-REPOSITORIO/gastos-app/`.

> Para **atualizar** mais tarde: repete os passos 2 a 4 com a pasta nova (os ficheiros com o mesmo nome são substituídos). Depois fecha **todas** as janelas da app (incluindo a instalada) e abre de novo.

## Como instalar
- **Telemóvel Android (Chrome)**: abre o endereço, menu ⋮ → **Instalar app** (ou «Adicionar ao ecrã principal»).
- **iPhone (Safari)**: abre o endereço, botão Partilhar → **Adicionar ao ecrã principal**.
- **Computador (Chrome ou Edge)**: abre o endereço e carrega no ícone de instalar na barra de endereço.

Depois da primeira abertura, a app funciona sem internet.

## Backup (importante)
Os dados vivem no navegador do dispositivo. Se limpares os dados do navegador, desinstalares ou perderes o telemóvel, perdem-se.
- **Início → Backup → Exportar backup (JSON)** guarda tudo num ficheiro. A app lembra-te ao fim de X dias (configurável).
- **Importar backup** repõe tudo (também serve para levar os dados do telemóvel para o computador). Antes de substituir, mostra um resumo e pede confirmação.
- **Exportar para Excel (CSV)** gera os movimentos e o histórico da poupança, para abrir no Excel ou Google Sheets. Não serve para repor dados: usa o JSON.

## Para quem for mexer no código
- HTML, CSS e JavaScript simples, sem build. Caminhos relativos (funciona numa subpasta).
- `js/util.js` (dinheiro e datas), `js/calc.js` (todas as contas, sem interface), `js/csv.js`, `js/db.js` (IndexedDB e backup), restantes ficheiros = interface.
- Só se guardam movimentos e valores iniciais; saldos e totais calculam-se sempre.
- Ao mudar ficheiros, aumenta o número de `CACHE` em `sw.js` (e acrescenta ficheiros novos à lista) para os dispositivos atualizarem.
- Os testes estão em `js/testes.js` e abrem-se em `testes.html`.

## Navegação (versão 7)
Barra no fundo com 5 itens: Início, Tabela, Gráficos, Carteira (Poupança e Investimentos) e Mais (Períodos, Cálculos e Definições). Valores iniciais, categorias, backup, exportações, armazenamento e «apagar tudo» estão em Mais → Definições.

## Tema (versão 8)
Mais → Definições → Aspeto: Claro, Escuro ou Automático (segue o telemóvel). A escolha fica só neste aparelho e não entra no backup.

## Segurança (versão 9)
Mais → Definições → Segurança: bloqueio com PIN (4–8 números) ou palavra-passe, desbloqueio opcional com impressão digital/rosto (do próprio telemóvel) e bloqueio automático. É um fecho de ecrã: não cifra os dados guardados. A configuração fica só neste aparelho e não entra no backup. Em Backup há «Exportar backup protegido» (AES-GCM, palavra-passe com PBKDF2); a importação reconhece-o e pede a palavra-passe.
Gráficos: em ecrãs de toque, tocar num dia fixa a informação até tocares noutro sítio.

## Versão 10 (fases 1 e 2)
Início só com o resumo (sem gráficos); o gráfico «Poupança e capital investido» está agora em Gráficos. O botão «+» é pequeno e só aparece em Início, Tabela, Poupança e Investimentos. Página do dia: movimentos primeiro e descrição pequena. Histórico da Poupança e dos Investimentos em lista, sem scroll lateral: tocar num movimento abre Editar e Apagar.
