# KeikowVTT

Virtual Tabletop pessoal para jogar RPG de mesa (estilo D&D) com amigos pela internet.
A meta de longo prazo é que, para o jogador, a mesa **pareça um CRPG** (referência: Baldur's Gate):
movimento com medidor, ações com custos, feedback visual de habilidades e magias, mecânicas "gamificadas".
Não é um videogame completo, mas deve parecer um aos olhos do jogador.

## Sobre o usuário (importante)
- Iniciante em programação. **Não quer programar**: todo o código fica a cargo do Claude.
- Explique decisões em português, de forma simples, sem jargão desnecessário.
- Sempre apresente um plano antes de implementar algo grande, e trabalhe em passos pequenos e testáveis.
- Ao terminar algo que funciona, diga como testar no navegador e sugira um commit no Git.
- Depois de cada commit, recomende na resposta, em uma linha, o nível de effort para o próximo passo e o motivo. Não grave a recomendação em arquivos.

## Visão do produto
- **Hexcrawl** como mapa-mundi: grid hexagonal, revelado aos poucos (fog of war).
- Cada hex **guarda informações**: públicas, secretas do mestre, adicionadas antes ou durante o jogo.
- Cada hex pode ter uma **instância** (mapa tático separado) onde acontecem combates/exploração, não necessariamente em hex.
- **Online**, login via **Discord**. Papéis: mestre e jogadores, com permissões diferentes.
- **Banco de dados** de personagens, inventários, itens, NPCs, compêndios, habilidades; fácil de entregar/associar a jogadores.
- Futuro: camada de jogo estilo CRPG (movimento medido, economia de ações, animações e efeitos de magia, sons).

## Stack
- **Frontend:** React + Vite + TypeScript (interface: fichas, inventário, painéis, banco de dados).
- **Cena/mapa:** PixiJS v8 (renderização 2D acelerada por GPU: tiles, tokens, partículas, shaders/filtros).
  - Bibliotecas de apoio quando necessário: pixi-viewport (câmera/zoom), GSAP (animações), @pixi/sound, emissor de partículas.
- **Backend (a partir da fase 4):** Supabase (Postgres, Auth com Discord, Realtime, Storage).
  - Se o combate exigir validação autoritativa no servidor, adicionar um servidor de jogo em Node/TypeScript
    (ex.: Colyseus) reaproveitando o mesmo motor de regras.
- **Hospedagem:** Vercel ou Netlify (frontend) + Supabase.
- Tudo web: mantém aberta a opção de rodar dentro do Discord como **Discord Activity**.

## Princípios de arquitetura (não violar)
1. **Quatro camadas separadas:**
   - `core/` — **estado e regras do jogo**, TypeScript puro, sem React e sem PixiJS. Testável sozinho.
     Deve poder rodar tanto no navegador quanto num servidor.
   - `render/` — PixiJS: só desenha o estado e anima. Nunca decide regras.
   - `ui/` — React: painéis, fichas, menus.
   - `net/` — sincronização/persistência (Supabase, depois).
2. **Dados separados da imagem.** Um hex guarda `terreno`, `notas`, `revelado` etc.; a imagem é só a representação visual.
3. **Coordenadas axiais (q, r)** para hexes. Nunca usar pixels como identidade.
4. **Tudo que acontece é um evento/ação** (ex.: `MoverToken`, `RevelarHex`, `UsarHabilidade`).
   O estado muda aplicando ações. Isso permite sincronizar online, registrar log, desfazer e reproduzir.
5. **Regras e conteúdo orientados a dados.** Habilidades, magias e itens são definidos como dados
   (custo, alcance, área, dano, efeito visual), não como código especial para cada um.
6. **Visibilidade explícita.** Toda informação tem quem pode ver (mestre, todos, jogador específico).
7. Assets nunca embutidos no código: carregados de uma pasta/manifesto (depois, do Storage).

## Especificação dos tiles (pasta `Hex Samples/`)
- Hexes com **ponta para cima**, levemente achatados (largura 256, altura do "chão" 256).
- Imagens de **256×384 px**; o "chão" ocupa os 256×256 inferiores; o resto é espaço para arte alta (montanhas, castelos).
- **Ponto de snap/âncora:** ponta inferior do hexágono = pixel **(128, 384)**.
- Espaçamento: colunas a **256 px**, linhas a **192 px**, linhas alternadas deslocadas **128 px**.
- **Ordem de desenho:** de trás para a frente (linhas de cima primeiro), para a arte alta sobrepor corretamente.
- Peças pequenas (ex.: `house00`, `treesA_cluster00`, `lavaCone00`) são **decorações**: camada separada, por cima dos tiles.
- `hexBase00` / `hexVoid00` servem como hex vazio/base.

## Roadmap
Cada fase deve funcionar sozinha antes de avançar.
1. **Editor de mapa local** — grid, zoom/arrasto, paleta de tiles por categoria, arrastar e soltar com snap,
   camada de decorações, salvar/carregar JSON.
2. **Informação por hex** — painel ao clicar: nome, descrição, notas públicas, notas secretas do mestre.
3. **Fog of war** — mestre revela hexes; botão "ver como jogador".
4. **Online** — Supabase, login Discord, campanhas, papéis, sincronização em tempo real.
5. **Token do grupo** no hexcrawl (movimento, histórico de viagem).
6. **Banco de dados do jogo** — personagens, inventários, itens, NPCs, habilidades, permissões e entrega a jogadores.
7. **Instâncias táticas** — mapa por hex, tokens, grid quadrado ou livre.
8. **Camada CRPG** — medidor de movimento, economia de ações, alcance/área visíveis, animações e efeitos de magia,
   sons, log de combate, rolagens com feedback visual.
9. **Extras** — integração mais profunda com Discord (bot de rolagens, Discord Activity), mais gamificação.

## Status atual
- **Fase 2 em andamento** (informação por hex), dividida em 5 passos:
  1. ✅ Regras em `core/`: nome, descrição, notas e visão do jogador.
  2. ✅ Formato do arquivo com as informações, convertendo mapas antigos.
  3. ✅ Seleção de hex: sem ferramenta, um clique marca o hex e abre o painel.
  4. ✅ Painel de edição, com as notas. Atalhos do mapa não agem enquanto se digita.
  5. Marcador no mapa para hexes com anotações e aviso ao apagar um deles (próximo).
- **Fase 1 concluída** (editor de mapa local). Os passos foram:
  1. ✅ Estrutura do projeto.
  2. ✅ Regras do mapa em `core/`.
  3. ✅ Assets e manifesto.
  4. ✅ Grid, zoom e câmera.
  5. ✅ Paleta e arrastar e soltar com snap.
  6. ✅ Pintar arrastando, apagar, desfazer e refazer.
  7. ✅ Decorações e rios na paleta e no mapa.
  8. ✅ Salvar e carregar JSON, com salvamento automático no navegador.
- Comandos: `npm run dev` (editor), `npm test`, `npm run build`, `npm run assets` (regera `public/assets/` a partir de `Hex Samples/`).

## Decisões já tomadas
- **Tipo do asset vem do nome do arquivo** (`scripts/classificar-asset.mjs`): `hexRiver…` sobreposição (2:3), `hexUnder…` base (4:3), `hex…` tile (2:3), outro nome decoração. Imagens de hex de outros tamanhos são ajustadas para o hex; decorações são desenhadas no tamanho original. `hexPortCentre00` é exceção: decoração.
- Rios só têm o rio desenhado: vão por cima de um terreno, encaixados no centro do hex, sem conexão automática.
- Mapa sem limite de tamanho. Decorações têm posição livre, presas a um hex: apagar o hex apaga as decorações; trocar o terreno as mantém.
- O botão esquerdo fica para editar o mapa; a câmera arrasta com o direito ou o do meio.
- Notas de hex são uma lista, cada nota com sua própria visibilidade. Nome e descrição são visíveis a todos. Só hexes com terreno guardam informação; trocar o terreno mantém as anotações e apagar o hex as apaga.
