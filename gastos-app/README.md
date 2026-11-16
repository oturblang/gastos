# Gastos — Fase 1 (Fundação)

## Publicar no GitHub Pages
1. Cria um repositório no GitHub (ex.: `gastos`).
2. Carrega **todos** os ficheiros mantendo as pastas (`js/`, `icons/`): `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`.
3. Em *Settings → Pages*, escolhe *Deploy from a branch*, branch `main`, pasta `/ (root)`.
4. Após 1–2 minutos, abre `https://utilizador.github.io/gastos/`.

## Instalar
- **Telemóvel (Android/Chrome):** menu ⋮ → *Instalar aplicação*. **iPhone/Safari:** Partilhar → *Adicionar ao ecrã principal*.
- **Computador (Chrome/Edge):** ícone de instalar na barra de endereço.

## Testar a Fase 1
1. Abre a app: deve aparecer «Pronta para usar offline.» (pode demorar uma abertura).
2. Preenche os valores iniciais (testa `1 234,56`, `1234.56`, `abc`, vazio) e guarda; recarrega e confirma que ficam.
3. Exporta o backup; altera os valores; importa o ficheiro: deve mostrar o resumo e repor os valores.
4. Importa um ficheiro que não seja backup: deve dar erro claro.
5. Ativa o modo avião e reabre a app: tem de funcionar.
6. «Apagar todos os dados» pede duas confirmações.

## Atualizações
Quando alterares ficheiros, aumenta `CACHE` em `sw.js` (`gastos-v2`, …) para os dispositivos receberem a versão nova.
A app só funciona por `https` ou `localhost` (não abrindo o ficheiro diretamente).
