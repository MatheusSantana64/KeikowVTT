# KeikowVTT

Virtual Tabletop pessoal para jogar RPG de mesa (estilo D&D) com amigos pela internet.
A meta de longo prazo é que, para o jogador, a mesa **pareça um CRPG** (referência de experiência: Baldur's Gate 3, em 2D):
movimento com medidor, ações com custos, feedback visual de habilidades e magias, mecânicas "gamificadas".
Não é um videogame completo, mas deve parecer um aos olhos do jogador; muito fica para a imaginação da mesa.
O clima de CRPG é objetivo principalmente das instâncias táticas, e não do hexcrawl.
Ambição de tamanho: bem grande, na direção do que o Foundry VTT oferece, sem chegar à mesma magnitude.
**Sistema de regras:** muito parecido com D&D 5e, para começar.

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
- **Online**, com contas próprias e campanhas. Papéis: mestre e jogadores, com permissões diferentes. Sem integração com o Discord: a voz fica em uma call separada.
- **Banco de dados** de personagens, fichas, inventários, itens, NPCs, compêndios, habilidades, com novas entradas criadas pelo mestre e objetos que interagem entre si; fácil de entregar/associar a jogadores.
- **Instâncias** com dungeons, objetos espalhados e inimigos em diversos pontos do mapa.
- **Chat de texto** dentro da ferramenta, com resultado de rolagens e mensagens públicas ou secretas, entre mestre e jogadores e entre jogadores.
- Futuro: camada de jogo estilo CRPG (movimento medido, economia de ações, animações e efeitos de magia, sons).

## Stack
- **Frontend:** React + Vite + TypeScript (interface: fichas, inventário, painéis, banco de dados).
- **Cena/mapa:** PixiJS v8 (renderização 2D acelerada por GPU: tiles, tokens, partículas, shaders/filtros).
  - Bibliotecas de apoio quando necessário: pixi-viewport (câmera/zoom), GSAP (animações), @pixi/sound, emissor de partículas.
- **Backend (a partir da fase 7):** a definir quando chegarmos lá. Supabase (Postgres, Auth, Realtime, Storage) é o candidato;
  alternativas são um plano pago ou um servidor próprio, inclusive hospedado pelo mestre, como no Foundry.
  - Se o combate exigir validação autoritativa no servidor, adicionar um servidor de jogo em Node/TypeScript
    (ex.: Colyseus) reaproveitando o mesmo motor de regras.
- **Hospedagem:** decidida junto com o backend (Vercel ou Netlify são candidatos para o frontend).
- Tudo web.

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
4. **Banco de dados do jogo** — personagens, fichas, inventários, itens, NPCs, habilidades, novas entradas, objetos que interagem
   entre si, permissões e entrega a jogadores. Começa trocando o armazenamento local, pois o do navegador (cerca de 5 MB) não comporta um compêndio.
5. **Token do grupo** no hexcrawl (movimento, histórico de viagem).
6. **Instâncias táticas** — mapa por hex, dungeons, tokens, objetos e inimigos espalhados, grid quadrado ou livre.
7. **Online** — contas, campanhas, papéis, sincronização em tempo real, hospedagem, chat de texto com rolagens e mensagens públicas ou secretas.
8. **Camada CRPG** — medidor de movimento, economia de ações, alcance/área visíveis, animações e efeitos de magia,
   sons, log de combate, rolagens com feedback visual. Vem depois do online porque combate depende de quem age e de quem tem a palavra final.
9. **Extras** — mais gamificação, personalização da aparência pelos jogadores, profissão "cartógrafo".

## Status atual
- **Fase 4 em andamento** (banco de dados do jogo), dividida em 12 passos:
  1. ✅ Armazenamento novo (IndexedDB), trazendo o mapa do armazenamento antigo.
  2. ✅ Campanha, jogadores simulados e registro de quem fez cada ação.
  3. ✅ Regras das entradas do compêndio em `core/` (`entradas.ts`, `compendio.ts`, `persistenciaCompendio.ts`). O desfazer virou uma peça comum, em `lojaHistorico.ts`.
  4. ✅ Tela do compêndio: buscar, filtrar, criar, editar, duplicar, apagar, com desfazer próprio. O compêndio entra no salvamento automático e no arquivo. Efeitos e ações ainda não são editáveis na tela (passos 9 e 10).
  5. ✅ SRD 5.1 completo (1.610 entradas) como pacote importável, com tela de créditos e `CREDITOS.md`.
  6. Motor de fórmulas e regras parecidas com 5e, guardadas como dados (próximo).
  7. Ficha de personagem, NPC e monstro, mostrando de onde vem cada número.
  8. Inventário e organização livre de itens, habilidades e notas.
  9. Efeitos dos objetos: equipar altera a ficha.
  10. Menu do botão direito com ações vindas do item, e rolagens de dados.
  11. Permissões e "ver como" cada jogador.
  12. Tela para alterar as fórmulas.
- Depois da Fase 4, proposta: assistente de criação de personagem e subida de nível.
- **Fase 3 concluída** (visão dos jogadores). Os passos foram:
  1. ✅ Teste visual das aparências dos hexes não vistos (página provisória, já removida).
  2. ✅ Regras em `core/`: vizinhos, posição do grupo, revelar e ocultar, visão do jogador e aparência do mapa.
  3. ✅ Formato do arquivo com revelação, aparência e posição do grupo, convertendo mapas antigos.
  4. ✅ Ferramentas Posicionar grupo, Revelar e Ocultar.
  5. ✅ Ver como jogador, com todas as aparências. O modo desenha só a visão filtrada e trava toda edição.
  6. ✅ Tela para escolher a aparência do mapa.
  7. ✅ Painel do mestre e painel somente leitura do jogador.
- **Fase 2 concluída** (informação por hex). Os passos foram:
  1. ✅ Regras em `core/`: nome, descrição, notas e visão do jogador.
  2. ✅ Formato do arquivo com as informações, convertendo mapas antigos.
  3. ✅ Seleção de hex: sem ferramenta, um clique marca o hex e abre o painel.
  4. ✅ Painel de edição, com as notas. Atalhos do mapa não agem enquanto se digita.
  5. ✅ Marcador no mapa para hexes com anotações e aviso ao apagar um deles.
- **Fase 1 concluída** (editor de mapa local). Os passos foram:
  1. ✅ Estrutura do projeto.
  2. ✅ Regras do mapa em `core/`.
  3. ✅ Assets e manifesto.
  4. ✅ Grid, zoom e câmera.
  5. ✅ Paleta e arrastar e soltar com snap.
  6. ✅ Pintar arrastando, apagar, desfazer e refazer.
  7. ✅ Decorações e rios na paleta e no mapa.
  8. ✅ Salvar e carregar JSON, com salvamento automático no navegador.
- Comandos: `npm run dev` (editor), `npm test`, `npm run build`, `npm run assets` (regera `public/assets/` a partir de `Hex Samples/`), `npm run srd` (regera `public/pacotes/` e `CREDITOS.md` a partir da base do 5e-bits).

## Decisões já tomadas
- **Tudo é construído pensando no online, mesmo antes de ele existir:** toda ação registra quem a fez, toda informação diz quem pode vê-la (incluindo jogador específico) e "ver como jogador" simula cada jogador para testar permissões sem internet.
- **Tipo do asset vem do nome do arquivo** (`scripts/classificar-asset.mjs`): `hexRiver…` sobreposição (2:3), `hexUnder…` base (4:3), `hex…` tile (2:3), outro nome decoração. Imagens de hex de outros tamanhos são ajustadas para o hex; decorações são desenhadas no tamanho original. `hexPortCentre00` é exceção: decoração.
- Rios só têm o rio desenhado: vão por cima de um terreno, encaixados no centro do hex, sem conexão automática.
- Mapa sem limite de tamanho. Decorações têm posição livre, presas a um hex: apagar o hex apaga as decorações; trocar o terreno as mantém.
- O botão esquerdo fica para editar o mapa; a câmera arrasta com o direito ou o do meio.
- Visão dos jogadores: hex do grupo (tudo o que é público) e os 6 vizinhos (só terreno e decorações), mais hexes revelados pelo mestre (só terreno e decorações). O que fica para trás volta a ficar oculto; registrar descobertas será da profissão "cartógrafo", no futuro. A posição do grupo fica fora do histórico do mapa.
- Aparência dos hexes não vistos é configuração de cada mapa: fundo escuro (com ou sem grid), neblina clara ou escura, ou um tile à escolha, com bordas suaves opcionais.
- Compêndio pertence à campanha, com exportação entre campanhas. Personagens recebem cópias das entradas. Personagens, NPCs e monstros usam a mesma ficha. Conteúdo inicial: SRD 5.1 em inglês, interface em português.
- **Licença do SRD:** o texto vem do SRD 5.1 pela CC-BY 4.0 (frase de crédito oficial obrigatória, sem nenhum outro crédito à Wizards; pode-se dizer "compatível com a quinta edição"). A base organizada é a do 5e-bits (`5e-srd-api`, pacote `5e-database`, licença MIT), fixada num commit em `scripts/srd/converterSrd.ts`. Os créditos aparecem na tela Créditos, no painel de importação e em `CREDITOS.md`.
- **Pacotes de conteúdo** ficam em `public/pacotes/` (lista em `indice.json`). Importar só acrescenta entradas novas, nunca substitui as editadas. Do SRD, monstros chegam "Só o mestre" e o resto "Todos"; características de classe idênticas viram uma entrada só; sub-espécies viram espécies completas; subclasses ainda não são um tipo (as habilidades delas entram com o requisito escrito). As entradas de pacote seguem o formato atual do compêndio: se ele mudar de versão, rode `npm run srd` de novo.
- Fórmulas e ações de itens são dados, editáveis, interpretados sem executar texto como código. O jogador só edita a ficha inteira se o mestre liberar; notas pessoais, nome, imagem, organização e ações pré-programadas são sempre permitidas.
- Notas de hex são uma lista, cada nota com sua própria visibilidade. Nome e descrição são visíveis a todos. Só hexes com terreno guardam informação; trocar o terreno mantém as anotações e apagar o hex as apaga.
