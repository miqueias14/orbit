# Orbit Replay

Replayer local de históricos de torneio PokerStars em inglês. HTML, CSS e JavaScript puro, sem instalação, dependências de execução, CDN ou envio de arquivos. A biblioteca de desenvolvimento `linkedom` é usada somente nos testes automatizados de interface.

## Usar

1. Abra `index.html` no navegador.
2. Clique em **Importar histórico** e selecione `reference-history.txt`, arraste o arquivo para a janela ou cole o histórico.
3. Use **▶**, a timeline e os botões de street para estudar. O arquivo de referência é uma cópia integral do histórico real localizado na pasta de torneios, sem dados fixados no parser.

### Layout inspirado na referência

No desktop, a interface organiza os filtros e a lista de mãos em uma coluna à esquerda e a mesa em um painel próprio à direita. A coluna separa filtros de ações (Todas, RFI, 3-bet, Meus all-ins, Joguei/VPIP e Favoritas) dos filtros de resultado em fichas. Esses atalhos utilizam as classificações existentes; as regras de cálculo não foram alteradas. A importação permanece disponível no cabeçalho.

O cabeçalho da sessão reúne torneio, blinds e ferramentas de revisão. A mesa usa um contorno horizontal arredondado e mantém as coordenadas dos jogadores e apostas. No desktop, os controles fixos se alinham à área do replay; em janelas menores, podem se organizar em duas linhas. A navegação por abas e a mesa oval do celular continuam disponíveis. As cores selecionadas nas Configurações têm prioridade.

### Redesign visual premium

A camada `premium.css` é carregada após os estilos existentes e refina tipografia, cards dos jogadores, apostas, pote, lista de mãos, painéis e controles. Reutiliza os tokens dinâmicos das Configurações (`--site-accent`, `--table-color`, `--card-*` e superfícies do tema), sem redefinir as preferências de cor. As coordenadas dos assentos, os pontos das apostas e o posicionamento fixo dos controles permanecem nos estilos originais. A largura dos cards dos jogadores se adapta à largura disponível da mesa no desktop, sem alterar as coordenadas.

O motor, o parser e os cálculos foram preservados. A reorganização da interface agrupa controles existentes. Os testes de replay, filtros, exportação e configurações passaram. Foram verificados seis perfis de preferências em DOM simulado, cobrindo os três temas, as quatro mesas, fundos e versos de cartas, quatro cores e destaques preto/branco. O CSS foi analisado sem redefinições dos tokens de cor ou das coordenadas dos jogadores. Esses testes não comprovam o layout renderizado; a conferência visual em navegador/aparelho real continua pendente.

### Configurações

Abra **Configurações** (engrenagem no cabeçalho) mesmo antes de importar um histórico. O botão **Ajustes** do replay abre diretamente a aba Reprodução.

- **Aparência:** temas escuro, claro e azul-noite; destaque com seletor de cor e quatro sugestões; exibição de explicações, posições nos assentos e redução de efeitos. O texto dos botões de destaque alterna entre claro e escuro conforme a luminosidade da cor escolhida.
- **Mesa e cartas:** mesa verde, azul, roxa ou grafite; fundo das cartas marfim, branco ou escuro; verso roxo, azul, verde ou vermelho; baralho de duas ou quatro cores. A prévia muda imediatamente e as mesmas cores de mesa e baralho entram na imagem PNG exportada.
- **Reprodução:** unidade fichas/BB, velocidade, tempo extra em momentos importantes, reprodução contínua, pausa antes do herói e ocultação de resultados futuros. Os controles da tela principal permanecem sincronizados.
- As escolhas são aplicadas na hora e salvas neste navegador. Se o armazenamento estiver indisponível, a área informa que valem somente para a sessão atual. **Restaurar padrão** redefine apenas as preferências, preservando históricos, biblioteca, favoritos e notas.

### Controles sempre acessíveis

**Voltar**, **Reproduzir**, **Avançar**, **Minha próxima decisão** e **Marcar jogada** ficam em uma barra fixa na parte inferior da tela. No celular, a barra fica acima das abas Mãos/Mesa/Estudo. A página reserva espaço abaixo do conteúdo para permitir que as últimas informações sejam roladas acima dos controles. Timeline, mudança de mão e streets continuam no painel da página.

No computador, ação atual e valores da decisão ficam lado a lado em telas largas. A altura da mesa se adapta à altura da janela, preservando uma margem para o assento inferior. Janelas menores continuam permitindo rolagem para consultar informações, com os controles principais disponíveis na aba Mesa.

### Leitura da mão e novo visual

- Mesa verde sobre superfícies neutras, com menos textos decorativos e um bloco dedicado à ação atual. A mesa continua oval no celular. Valores, ação e controles têm áreas distintas; os detalhes de reprodução ficam em **Ajustes**.
- Cada assento mostra a posição inicial na mão (BTN, SB, BB, CO etc.). Nomes longos continuam abreviados no assento; o nome completo aparece no texto da ação e no contexto do jogador a agir.
- A contagem acima da mesa informa quantos jogadores continuam na disputa e quantos estão all-in.
- A explicação de uma aposta usa o pote imediatamente anterior à ação, inclusive em all-ins. Um aumento informa o valor anterior da aposta, o novo total e quanto o jogador acrescentou. Não há classificação de qualidade da jogada.
- **Stack**, **Para pagar** e **Pot odds** pertencem ao jogador identificado em **Vez de…** e seguem a unidade escolhida em **Configurações → Reprodução → Unidade dos valores**. Entre decisões e ao concluir a mão, os valores ficam vazios. As pot odds usam o pote após o call; quando o jogador não é elegível a todas as contribuições, o percentual é ocultado.
- No showdown, as combinações das cartas conhecidas aparecem abaixo da ação (par, dois pares, sequência etc.). O cálculo escolhe as cinco melhores cartas entre as disponíveis. Cartas presentes apenas no resumo só entram após o fim da mão e com a consulta explícita habilitada; voltar antes do showdown oculta os nomes das combinações.
- Em **Ajustes → Tempo extra em cartas novas e all-ins**, escolha de zero a três segundos adicionais após flop, turn, river, showdown e ações all-in. A preferência é salva no navegador e respeita a pausa antes da decisão do herói.

### Biblioteca e ferramentas de estudo

- **Biblioteca:** importe vários `.txt` de uma vez, por seletor ou arrastando os arquivos. O sistema agrupa as mãos por torneio e ignora IDs duplicados. Abra um torneio salvo, retome sua posição, exporte seu texto ou remova-o da biblioteca. Os arquivos originais no computador não são alterados. Importar novos trechos do mesmo torneio acrescenta as mãos que faltam.
- **Etiquetas:** no painel **Estudo**, use sugestões ou crie etiquetas personalizadas. Elas ficam associadas à mão, podem ser removidas e aparecem na busca avançada. Limite de 12 etiquetas por mão, com até 32 caracteres cada.
- **Busca avançada:** combine nome/ID/cartas na busca principal com jogador, cartas do herói (`AKs`, `AQo`, `88`, `As Kh`), posição, faixa de pote e etiqueta. O pote é informado em BB e convertido com o big blind nominal de cada mão. No modo sem spoilers, filtros por pote não usam resultados futuros.
- **Stack em BB:** o gráfico mostra início e fim de cada mão. Use **Até a mão atual** para acompanhar o replay ou **Torneio completo** para revelar explicitamente toda a evolução dentro do gráfico. Essa escolha não altera a preferência de spoilers do replay. No início, um ponto central e um aviso explicam que só o stack inicial está disponível. Toque em um ponto, use o teclado ou o seletor acessível para abrir a mão correspondente. Cada ponto usa o nível de blinds daquela mão; mudanças de nível também alteram o stack expresso em BB.
- **Quatro cores:** em **Ajustes**, ative o baralho de quatro cores: espadas escuras, copas vermelhas, ouros azuis e paus verdes. A preferência também é aplicada à imagem exportada.
- **Imagem da mesa:** o botão **Imagem** salva um PNG do evento atual, desenhado localmente em Canvas, com mesa oval, jogadores, cartas, apostas, stacks e pote. Cartas desconhecidas continuam ocultas. Cartas do resumo só entram se a consulta de estudo estiver explicitamente habilitada após a mão. O layout da imagem é próprio para compartilhamento e não é uma captura da página.
- **Fila de revisão:** decisões adicionadas com **Marcar jogada** aparecem na fila, inclusive de outros torneios da biblioteca. Abra o ponto exato, marque a decisão como revisada ou reabra a revisão. Favoritos e etiquetas ajudam a organizar as mãos, mas não acrescentam decisões automaticamente à fila.

Históricos, biblioteca, progresso por torneio, etiquetas e notas ficam no navegador. Não há conta, sincronização entre dispositivos ou upload do histórico. O backup JSON inclui notas, favoritos, etiquetas e status de revisão; os históricos podem ser exportados em `.txt` pela biblioteca.

**Atalhos:** Espaço reproduz/pausa; ← e → navegam entre eventos; Shift + ← e Shift + → mudam de mão dentro do filtro/busca. Atalhos não são capturados durante digitação nem com a importação aberta. Com a pausa antes do herói ativada, **Continuar** revela a decisão pausada e segue até a próxima; → também revela um evento por vez.

### Interface simplificada

A tela inicial apresenta uma ação principal para importar. Após a importação, a mesa ocupa o espaço central; **Voltar**, **Reproduzir** e **Avançar** controlam o replay. Use **Ações e notas** para abrir o painel de estudo e **Ajustes** para reprodução contínua, pausa antes da sua decisão, spoilers e saltos ao início/fim. A seleção de uma mão já posiciona o replay após a distribuição das cartas; todos os eventos de antes e blinds continuam disponíveis ao voltar ou usar **Ir ao início**.

O replay reaproveita os elementos dos assentos e das ações, atualiza cartas somente quando mudam e calcula os diagnósticos uma vez por importação. A contabilidade usa o mesmo motor validado.

Os eventos de ante são pulados automaticamente durante a reprodução, os passos e a navegação pela timeline. **Ir ao início** já aplica os antes. Os descontos continuam nos stacks e no pote, e os registros permanecem no histórico de ações e no texto original.

### Estudo e celular

- **Minha próxima decisão** pula para antes da próxima ação do herói, inclusive na próxima mão que tiver uma decisão. Ao chegar, o botão muda para **Revelar minha decisão**. Nenhuma ação futura é mostrada antes desse clique.
- **Resumo da mão** aparece ao concluir os eventos: resultado líquido em fichas, stack final em BB e cada pagamento/pote registrado. Voltar na timeline oculta novamente o resumo. Mãos incompletas ou com divergências recebem uma indicação explícita.
- **Retomada automática:** o histórico e a posição são salvos neste navegador. Ao reabrir, a sessão volta pausada no mesmo evento. **Apagar sessão** remove histórico e progresso, preservando favoritos e notas. Se o navegador não tiver espaço ou bloquear o armazenamento, o replay continua funcionando e informa que a retomada não foi salva.
- **Filtros rápidos:** Todas, Joguei (participação voluntária), Meus all-ins (call, aposta ou aumento do herói) e Favoritas. O seletor também separa **Meu all-in obrigatório (ante/blind)** e **All-in na mesa (qualquer jogador)**. Assim, fold pré-flop com all-in de um adversário não aparece em Meus all-ins.
- **Fila de estudo:** mão anterior/próxima, resumo, reprodução contínua e próxima decisão seguem somente as mãos do filtro e da busca atuais. Alterar o filtro pausa o replay. Sem resultados, os controles de reprodução ficam desabilitados. Ao chegar ao fim da seleção, a reprodução para; tocar em Play novamente reinicia a última mão quando não houver outra na fila.
- **Sessão protegida:** a importação salva o novo histórico e uma posição inicial em uma única gravação. Se faltar espaço, o novo histórico continua aberto na memória e a sessão anterior permanece disponível para retomar. Históricos salvos por versões anteriores continuam compatíveis.
- **Marcar jogada** salva uma nota naquele ponto da timeline. Em **Ações e notas → Jogadas marcadas**, toque na nota para voltar ao evento ou use **Editar**. É possível remover a marcação. O backup de anotações inclui essas notas e aceita backups antigos sem notas por evento. Notas futuras ficam ocultas no modo sem spoilers.
- **Mesa:** o jogador da última ação continua destacado; o próximo a agir tem uma marca na base do assento e aparece no texto acima dos controles. A aposta mais recente tem destaque e jogadores que foldaram ficam discretos.
- **Celular:** abas fixas na base, controles de reprodução acima delas, botões maiores, margem para a área segura do aparelho, formulários legíveis e mesa adaptada a telas estreitas e orientação horizontal. Ao abrir outra aba ou deixar a página em segundo plano, a reprodução pausa.
- **Leitura da mesa no celular:** o cabeçalho é compacto durante a sessão e a mesa oval usa a altura disponível, com limite mínimo para preservar a leitura. Em telas muito baixas, continua havendo rolagem. As cartas do herói são maiores, pote e valor para pagar têm mais contraste, e as apostas ficam dentro da mesa com posições próprias para 2–9 jogadores.

Para acessar de outro dispositivo por um endereço, os arquivos precisam estar em uma hospedagem estática; esta entrega permanece local, sem publicação. Mesmo em hospedagem estática, a importação e o replay não enviam o histórico ao servidor. A retomada pertence ao navegador/dispositivo usado, sem sincronização entre aparelhos.

No celular, use as abas **Mãos**, **Mesa** e **Ações e notas**. O botão **Ações e notas** abre o painel; **Fechar ×** retorna à mesa. Cada estrela salva um favorito; as caixas à esquerda selecionam mãos para exportar. O menu de backup exporta e restaura favoritos e notas, associados ao torneio e ao ID da mão.

**Sem spoilers** oculta resultados líquidos e ações futuras. Os filtros de lucro/prejuízo só mostram a mão atual quando concluída nesse modo; desative a opção para estudar os resultados de toda a sessão. O histórico original copiado/exportado contém a mão inteira. Cartas conhecidas apenas pelo resumo ficam disponíveis na opção explícita de consulta após a conclusão.

Preferências, favoritos e notas usam `localStorage`. Se o navegador bloquear esse recurso, a aplicação mantém as alterações na sessão e informa a condição no rodapé. Exporte um backup antes de fechar nesse caso.

## Arquivos

- `parser.js`: leitura e eventos com linhas de origem, duplicatas e avisos.
- `replay-engine.js`: reducer sem DOM, snapshots, potes, conferências e filtros.
- `app.js`: importação local, interface, reprodução, persistência e exportações.
- `settings.js`, `settings.css`: preferências locais, temas e diálogo de configurações.
- `settings-tests.js`: persistência e restauração de preferências, sincronização com o replay, paletas de exportação, armazenamento indisponível e preservação dos dados ao restaurar o padrão.
- `viewer-tools.js`: explicações factuais de apostas, posições, contagem de jogadores e avaliação das melhores cinco cartas no showdown.
- `viewer-tests.js`: elegibilidade ao pote, contexto do jogador correto, cartas ocultas, combinações e kickers, posições e tempo extra de reprodução.
- `study-tools.js`: decisões, resumo, validação das notas e restauração da posição.
- `feature-tools.js`: busca avançada, etiquetas, biblioteca, gráfico e fila de revisão.
- `studio.js`: controles das ferramentas de estudo e persistência da biblioteca.
- `table-export.js`: desenho da mesa e exportação PNG pelo navegador.
- `styles.css`, `studio.css`, `viewer.css`, `settings.css` e `index.html`: interface responsiva em português, mesa oval e componentes de estudo.
- `reference-history.txt`: histórico real de referência com 47 mãos.
- `tests.js`: testes executáveis com Node, sem bibliotecas adicionais.
- `ui-tests.js`: testes de integração em DOM simulado; exige instalar as dependências de desenvolvimento com `pnpm install` e executar `node ui-tests.js`.
- `regression-tests.js`: regressões de pausa/retomada, reinício da última mão, fila filtrada e preservação da sessão ao exceder armazenamento. Execute `node regression-tests.js` ou `pnpm test` para todas as verificações.
- `feature-tools-tests.js`, `table-export-tests.js` e `studio-ui-tests.js`: validações das oito ferramentas e sua integração. `node run-tests.js` executa todas as suítes; os testes de DOM exigem as dependências de desenvolvimento, mas abrir a aplicação não exige instalação.
- `chart-tests.js`: testes do ponto inicial, visão completa com 94 pontos/47 mãos, seleção e navegação, ausência de dados, reabertura segura. O SVG completo também foi renderizado e inspecionado em `stack-chart-preview.png`; isso não é uma captura do diálogo no navegador.

## Validação executada

Execute `node tests.js`. Os testes passaram com o histórico real:

| Conferência | Resultado |
| --- | --- |
| Importação | 47 mãos, herói `zaroizinho`, torneio `4040939869`; nenhum aviso ou divergência |
| `262448536385` | 9 antes de 3, blinds 10/20, raise para 50, call de 50, devolução de 65, pagamentos de 157, stack do herói 1447 |
| `262448633713` | Principal 177 dividido em 89 e 88; paralelo 116; total 293; `4973509` recebe 204 e `ritter7777` recebe 89 |
| `262448727319` | Devolução de 461; potes 1214 + 1386 + 1702 = 4302; `VicLong80` recebe 3088 e `ritter7777` recebe 1214 |
| `262448910884` | Ante 25, BB nominal 200, BB parcial 39 all-in, fold preservado, devolução de 61, pote 203, eliminação em 5º |
| Determinismo | Reconstrução idêntica em todos os 1298 estados das 47 mãos |
| Contabilidade | Conservação de fichas em todos os estados, stacks finitos e não negativos, pote final zero, pagamentos únicos; resumos não executam pagamentos |
| Tolerância | Duplicatas, BOM/CRLF, mão incompleta e aviso com ID/linha para ação desconhecida |

Também foram executadas as verificações de sintaxe JavaScript com `node --check`.

Os testes de integração `node ui-tests.js` passaram: importação real, parada antes de decisões, revelação explícita, salto entre mãos, resumo e ocultação ao voltar, marcação/edição/remoção de notas, backup, renderização segura de texto, retomada, exclusão da sessão, armazenamento bloqueado, filtros, pausa nas abas e reutilização dos assentos. Eles simulam o DOM e não renderizam pixels nem comprovam o layout em um aparelho real.

Os testes `node regression-tests.js` também passaram: Play retoma após a pausa no herói e pausa na decisão seguinte; a última mão reinicia por comando sem entrar em loop; favoritos e busca limitam navegação, decisões e reprodução contínua; buscas vazias interrompem a reprodução; falha por falta de espaço preserva o histórico anterior e sua posição; sessões antigas em texto continuam sendo restauradas.

As ferramentas novas foram testadas com importação múltipla (incluindo BOM em cada arquivo), deduplicação, segundo torneio, filtros combinados, faixa de pote em BB, etiquetas e backup, quatro cores, navegação direta das decisões, gráfico sem spoilers e conclusão de revisão. A exportação foi verificada contra os 1.298 estados para impedir vazamento de cartas; também foi gerado e inspecionado visualmente o arquivo `export-preview.png` com um renderizador Canvas local. Isso valida a imagem exportada e não substitui a conferência da página no navegador.

## Limites e verificações pendentes

- A conferência visual em 390, 768 e 1440 px e o teste em navegador/aparelho real **não foram executados**: a ferramenta de navegação bloqueou a abertura de URLs `file://`. As regras responsivas incluem também telas de 320 px, mas isso não substitui QA visual. Os controles foram exercitados em DOM simulado, conforme descrito acima.
- A página de referência GPRO Replay não pôde ser acessada pela ferramenta; a interface foi construída a partir da direção visual e dos requisitos fornecidos.
- Compatibilidade principal: torneios PokerStars No Limit Hold’em com histórico em inglês e um único board. Outros jogos, idiomas, cash games, Zoom e múltiplos boards não são suportados. Linhas desconhecidas permanecem na sequência e geram avisos.
- Potes calculados durante as apostas são provisórios, antes de devoluções e ações seguintes. O fim da mão usa o detalhamento do resumo para conferência; pagamentos sempre vêm dos eventos `collected`. Histórico incompleto não recebe pagamentos inventados.
- Pot odds usam o call efetivo limitado ao stack e só mostram o percentual quando o jogador pode disputar todas as contribuições após o call. Caso contrário, a interface informa a limitação de elegibilidade e oculta o percentual; não calcula equity, ICM, ROI ou GTO.
- Em arquivos inconsistentes, o diagnóstico informa divergências; o motor preserva os valores registrados sem corrigir o histórico silenciosamente. O arquivo real de referência passou sem valores negativos.
- O fim do arquivo é apresentado como **fim do histórico importado**. Não há inferência sobre o restante do torneio.
