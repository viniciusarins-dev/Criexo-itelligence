# Registro de implementação

## Etapa 1 — base segura e verificável (22/10/2026)

### Implementado
- Projeto Next.js 16.4 (App Router, TypeScript estrito, Tailwind CSS 4, ESLint).
- **Design system**: tokens semânticos sobre a paleta da CRIEXO
  (`src/app/globals.css`), Montserrat via `next/font`, componentes no padrão
  shadcn/ui (button, input, label, badge, card, table, dropdown-menu, skeleton,
  separator, avatar, toaster) e estados (vazio, aviso, cabeçalho de página).
  `prefers-reduced-motion` respeitado no CSS e no Motion.
- **Layout**: sidebar com ícones Lucide, navegação móvel (Radix Dialog + Motion),
  cabeçalho com menu do usuário e saída. Áreas não implementadas aparecem em
  "Em desenvolvimento" e não são links.
- **Autenticação**: login por e-mail e senha (Server Action + Zod, mensagem de
  erro genérica, proteção contra redirecionamento aberto), proxy de sessão,
  camada de acesso `requireActiveMember()`, tela de acesso pendente para
  usuários não liberados, tela de configuração pendente sem variáveis de
  ambiente, cabeçalhos de segurança. Cadastro público desativado.
- **Banco** (`supabase/migrations`): esquema completo da especificação revisado,
  RLS em todas as tabelas, privilégios mínimos por coluna, funções com
  histórico (`decide_product_idea`, `change_opportunity_status`,
  `set_opportunity_saved`, `admin_set_member_access`, `activate_scoring_config`),
  trigger de perfil inativo para novos usuários, histórico de configurações,
  configuração de pontuação v1 **proposta**, view do dashboard com
  `security_invoker`.
- **Domínio**: motor de pontuação versionado e determinístico, avaliador de
  proximidade (Haversine), estrelas, confiança, normalização (nome, telefone,
  domínio, URL, CNPJ).
- **Dashboard** com dados reais do banco: indicadores, oportunidades
  prioritárias, distribuição por status, pesquisas recentes, atividade
  recente, com estados de carregamento, erro e vazio.

### Testes executados (resultados reais)
- `npm run typecheck` — sem erros.
- `npm run lint` — sem erros.
- `npm run test:unit` — 45 testes passando.
- `npm run test:integration` — 11 testes passando contra PostgreSQL 16 com
  GoTrue (Supabase Auth) compilado do código-fonte. Sensibilidade conferida:
  afrouxar a política `companies_select` faz o teste correspondente falhar.
- `npm run test:e2e` — 12 testes passando (desktop 1440px e Pixel 7), contra
  Supabase Auth + PostgREST locais.
- `npm run build` — sucesso.

### Problemas encontrados e corrigidos
- **Sair falhava quando a sessão já tinha sido encerrada em outro dispositivo**:
  o proxy redirecionava (307) a requisição da Server Action por não encontrar
  sessão válida, quebrando a página. Correção: o proxy não redireciona Server
  Actions (que verificam a sessão por conta própria). Coberto por teste E2E.
- **Rolagem horizontal no celular**: cards dentro do grid não encolhiam com a
  tabela. Correção: `min-w-0` no Card. Coberto por verificação no E2E.
- Mistura de cor inválida (`color-mix` com porcentagens somando menos de 100%)
  gerava superfícies semitransparentes.

### Observações de ambiente
- O ambiente de desenvolvimento não tem Docker, então `supabase start` não foi
  usado. Os testes rodaram com PostgreSQL 16, GoTrue e PostgREST executados
  diretamente, com os mesmos papéis e privilégios padrão do Supabase. Os
  testes são independentes desse arranjo: basta apontar `TEST_DATABASE_URL`
  e as variáveis E2E para um `supabase start` local.
- Os tipos em `src/lib/supabase/database.types.ts` foram gerados pelo CLI do
  Supabase a partir do banco migrado (`npm run db:types` regenera a partir do
  Supabase local).

### Pendências desta etapa
- Pesquisa global no cabeçalho e notificações: não implementadas (dependem das
  telas de Empresas e de eventos reais).
- Logotipo oficial (DP-18).
- React Hook Form: não instalado ainda (nenhum formulário complexo nesta etapa;
  a versão atual de `@hookform/resolvers` tem conflito de dependências a
  resolver quando for adotada).

## Etapa 2 — Configurações e decisões do Christian (22/10/2026)

### Implementado
- **Decisões aprovadas** registradas em `REGRAS_DE_NEGOCIO.md` (questionário
  respondido por Christian). Esclarecimentos abertos: DP-22 a DP-25.
- **Pontuação v2 aprovada** (migration `20261022000300`): mesmos pesos e regras
  da v1, nota mínima de qualificação 60. A v1 permanece como histórico.
- **Validação no banco** das configurações conhecidas (`geo.reference`,
  `geo.radius_km`; chaves desconhecidas são recusadas) e do formato de
  `production_settings`.
- **Tela de Configurações** (`/configuracoes`):
  - Região: endereço, coordenadas (aceita o texto copiado do Google Maps),
    raio, link para conferir o ponto no mapa. Somente administradores editam.
  - Capacidade produtiva: equipamento, materiais, tempos, produção diária de
    peças pequenas, observações. Campos vazios ficam "a confirmar" e a tela
    lista o que falta. Cada gravação cria uma nova versão.
  - Pontuação: versão vigente, pesos, estrelas e regras (somente leitura).
  - Equipe (administradores): papel, liberar e bloquear acesso com
    confirmação; ninguém altera o próprio acesso.
  - Integrações: estado real (nenhuma ativa).
  - Perfil: nome de exibição.
- Dashboard avisa quando região ou capacidade não estão configuradas.

### Testes executados (resultados reais)
- `npm run typecheck` e `npm run lint` — sem erros.
- `npm run test:unit` — 53 testes passando.
- `npm run test:integration` — 15 testes passando (banco recriado do zero).
- `npm run test:e2e` — 24 testes passando (desktop e celular), executados
  duas vezes seguidas no mesmo banco para confirmar que não dependem de
  estado limpo.
- `npm run build` — sucesso.

### Problemas encontrados e corrigidos
- **Administrador não conseguia salvar configurações**: a constraint chamava
  uma função sem permissão de execução para `authenticated`. Pego pelo teste
  de integração.
- **JSON incompleto era aceito**: um `CHECK` que resulta em `NULL` passa no
  PostgreSQL; a validação agora usa `coalesce(..., false)`.
- **Formulário perdia o que foi digitado após um erro de validação**
  (o React reinicia o formulário depois da action). As actions devolvem os
  valores enviados, que viram os valores padrão. Coberto por E2E.

### Pendências
- Cadastrar os valores reais do Christian em Configurações no ambiente de
  produção (depende do projeto Supabase e de DP-22).
- Avaliador de viabilidade: depende dos requisitos de cada ideia de produto
  (tamanho, material, quantidade, prazo), que entram na etapa 5.
- Levantar opções e preços de fontes de dados e IA (DP-15, DP-16).

## Ajustes após os esclarecimentos do Christian (22/10/2026)

- Registradas as respostas DP-18 e DP-22 a DP-25. Nova inconsistência DP-26
  (quantidades por dia × tempo por peça × horário da impressora).
- Capacidade: o campo de horas passou a ser **horas de trabalho por semana**
  (`weeklyWorkHours`), e foi criado **quando a impressora fica ligada**
  (`printerSchedule`). Versões já gravadas sem esse campo continuam válidas
  (lidas como "a confirmar").
- Logotipo: símbolo extraído da imagem recebida (fundo preto removido),
  aplicado no menu, no login e no ícone da aba. Sem arquivo original ainda.
- Caveman: um teste do hook feito fora do repositório tinha gravado o modo
  "caveman" como estado global da máquina, e a sessão retomada o herdou.
  Os arquivos de teste foram removidos; o repositório continua em modo manual.

### Testes executados
- `npm run typecheck`, `npm run lint` — sem erros.
- Vitest — 69 testes passando (54 unitários + 15 de integração), banco recriado.
- Playwright — 24 testes passando. `npm run build` — sucesso.

- Impressora ligada das 08:00 às 17:30 (≈ 9,5 h/dia), com parte do tempo para
  testes de treino: novo campo `printerHoursPerDay` na capacidade. DP-26
  reduzida a uma pergunta (quantidades por dia = várias peças na mesma mesa?).
- DP-26 resolvida: várias peças por mesa; quantidades por dia usadas
  diretamente como capacidade diária. Novo campo `multiplePartsPerPlate`.
- DP-15 e DP-16 decididas (sem custo; OpenAI preferida, Gemini gratuito como
  alternativa; OpenStreetMap + dados do CNPJ + BrasilAPI). Ações A-01 a A-03
  registradas. Observado: o CNPJ passou a ter formato alfanumérico para novos
  cadastros; o validador `normalizeCnpj` precisa ser atualizado antes da
  importação de dados da Receita.

## Etapa 3 — Empresas (23/10/2026)

### Implementado
- **CNPJ alfanumérico** (novos cadastros desde 07/2026): validação no domínio
  (valor ASCII − 48, módulo 11; conferido com o exemplo oficial
  12.ABC.345/01DE-35) e constraint no banco.
- **View `company_overview`** (`security_invoker`): distância até o ponto de
  referência (mesma fórmula do domínio), melhor oportunidade, quantidade de
  oportunidades e última verificação.
- **Lista de empresas** (`/empresas`): busca por nome, segmento, bairro ou
  cidade; filtros por segmento e status; ordenação por atualização, nome,
  distância ou pontuação; paginação de 20; tabela no computador e cartões no
  celular; estados vazio, sem resultado, carregando e região pendente.
- **Cadastro e edição manuais**: validação no servidor (telefone com DDD, site
  seguro, CNPJ, UF, CEP, coordenadas), valores preservados após erro, origem
  de cada campo registrada (RN-12), localização "confirmada" só com a
  conferência marcada.
- **Duplicidade** (seção 7): mesmo CNPJ é bloqueado; mesmo nome, site ou
  telefone gera aviso com links e o usuário decide. Na edição, o aviso só
  considera os identificadores alterados.
- **Detalhes da empresa**: identificação, contato, localização com distância e
  link para o mapa, tabela de origem das informações, fontes, oportunidades e
  histórico (somente leitura; ações comerciais chegam na etapa 4).
- **Pesquisa global** no cabeçalho, que abre a lista filtrada.

### Testes executados (resultados reais)
- `npm run typecheck`, `npm run lint` — sem erros.
- Vitest — 86 testes passando (69 unitários + 17 de integração).
- Playwright — 28 testes passando, em duas execuções seguidas no mesmo banco.
- `npm run build` — sucesso.

### Problemas encontrados e corrigidos
- **Aviso de duplicidade repetido na edição**: editar qualquer campo de uma
  empresa reabria o aviso sobre um nome já revisado no cadastro. Agora só os
  identificadores alterados geram aviso.
- **Filtros cortados em 1440 px** e esqueleto de carregamento da lista usado
  na página de detalhes: corrigidos após conferência visual.

## Etapa 4 — Oportunidades e pipeline comercial (23/10/2026)

### Implementado
- **Criar oportunidade** na página da empresa, com produto aprovado opcional
  (RN-03: só ideias aprovadas). Uma oportunidade por empresa e produto; tentar
  criar de novo leva à existente.
- **Página da oportunidade** (`/oportunidades/[id]`): salvar/remover dos
  salvos; mudar status com observação; registrar observação ou contato (mover
  para "Contatada" só se o usuário marcar); descartar com janela de
  confirmação e motivo; reabrir escolhendo outro status; pontuação com
  critérios, pesos, natureza das evidências e faixa quando incompleta;
  histórico completo.
- **Lista de oportunidades** com busca por empresa, filtro por status e
  "somente salvas", ordenação e paginação; cartões no celular.
- **Pipeline** (`/pipeline`) em colunas por status (configuráveis no banco) e
  em tabela; troca de status por seleção acessível em cada cartão; filtro de
  salvas; limite de 300 cartões com aviso.
- Todas as mudanças passam pelas funções do banco que gravam o histórico
  (`change_opportunity_status`, `set_opportunity_saved`).
- OpenAI exige créditos (A-01): a IA começará pelo plano gratuito do Gemini.

### Testes executados (resultados reais)
- `npm run typecheck`, `npm run lint` — sem erros.
- Vitest — 92 testes passando (74 unitários + 18 de integração).
- Playwright — 32 testes passando, em duas execuções seguidas.
- `npm run build` — sucesso.

### Problemas encontrados e corrigidos
- **Pipeline alargava a página** (1830 px numa tela de 1440): rótulos para
  leitores de tela dentro das colunas fora da área visível tinham posição
  absoluta calculada pela página. O quadro passou a ser o contexto de
  posição; o teste E2E agora mede a largura também na visão em colunas.
- **Janela de descarte continuava aberta** após concluir: fecha dentro da
  própria ação.

## Etapa 5 — Nova prospecção e Produtos e ideias (23/10/2026)

### Implementado
- **Nova prospecção** (`/prospeccao`): pesquisa por segmento ou por produto,
  com objetivo opcional. A pesquisa grava uma cópia das configurações usadas
  (região, raio, resumo da capacidade produtiva, versão da pontuação).
- **Página da pesquisa** (`/pesquisas/[id]`) com as quatro etapas:
  - ideias de produto sugeridas pela IA (quando configurada) ou cadastradas
    manualmente;
  - aprovação ou rejeição individual, com observação opcional e aviso de
    ideia parecida (sem unir nem bloquear);
  - botão de busca liberado só sem ideias pendentes e com ao menos uma
    aprovada (RN-03, verificado também no servidor);
  - resultados agrupados por empresa, com motivo, fonte, distância (ou
    "desconhecida") e as oportunidades criadas; aviso de resultado parcial
    abaixo de 5 empresas (RN-07), sem completar a lista.
- **Busca nesta etapa: somente a base interna.** Os termos de busca são o
  texto da pesquisa e os segmentos-alvo das ideias aprovadas. Segmento
  coincidente vale mais que nome; o empate é desfeito pela distância
  conhecida. A busca cria, ou reaproveita, uma oportunidade por empresa e
  ideia aprovada. Cada execução fica em `research_source_runs`.
- **Nova execução:** cria outra pesquisa ligada à original (`rerun_of`),
  com as configurações atuais. Reaproveita as ideias já decididas e não
  altera a pesquisa anterior nem os resultados dela.
- **Pesquisas anteriores** (`/pesquisas`): situação, ideias, empresas e
  fontes de cada pesquisa, com paginação.
- **Produtos e ideias**:
  - `/produtos`: lista com filtro por decisão;
  - `/produtos/nova`: ideia avulsa;
  - `/produtos/[id]`: detalhes, natureza de cada premissa, histórico de
    decisões, oportunidades relacionadas e revisão da decisão.
- **IA trocável** (`src/server/ai`):
  - o adaptador Gemini usa chave só no servidor, tempo limite e mensagens
    claras para chave inválida, limite do provedor, indisponibilidade,
    bloqueio e resposta inválida;
  - a resposta é validada com Zod antes de gravar e entra como "inferência
    da IA";
  - o limite diário vem de `AI_DAILY_REQUEST_LIMIT`;
  - as instruções enviadas à IA proíbem inventar dados e incluem só o
    contexto comercial, sem dados pessoais.
- Migration `20261023000500_research_flow.sql` cria
  `research_session_results` e `ai_usage_log`, com RLS, somente inclusão
  para membros ativos e nada para `anon`.
- Navegação: Nova prospecção, Pesquisas anteriores e Produtos e ideias
  passam a estar disponíveis. O botão do dashboard leva à nova prospecção.

### Testes executados (resultados reais)
- `npm run typecheck`, `npm run lint` — sem erros.
- Vitest — 111 testes passando: 91 unitários (inclui pesquisa, ranking,
  ideias parecidas, instruções da IA e adaptador Gemini com respostas
  simuladas) e 20 de integração.
- Playwright — 36 testes passando em duas execuções seguidas. Os novos
  testes cobrem:
  - o fluxo guiado completo: validação, IA não configurada, ideias manuais,
    aviso de ideia parecida, aprovação e rejeição;
  - busca, resultado parcial e nova execução preservando a anterior;
  - histórico da ideia e ideia avulsa.
- `npm run build` — sucesso.
- Verificação visual de `/prospeccao`, `/pesquisas`, `/pesquisas/[id]` e
  `/produtos` em 1440 px e em celular.
- **Não testado:** chamada real ao Gemini. A rede do ambiente bloqueia o
  serviço e ainda não há chave (A-02, A-03).

### Problemas encontrados e corrigidos
- **Testes de integração dependiam dos dados já existentes no banco:**
  falhavam depois dos E2E. Agora comparam antes e depois, ou filtram pelos
  registros criados no próprio teste.
- **Lista de ideias parecidas ficava longa:** mostra no máximo 5 e indica
  quantas há a mais.
- **Ideia manual numa pesquisa já buscada:** passou a ser recusada no
  servidor, com orientação para executar a pesquisa novamente.

### Pendências
- A-02 (chave do Gemini como segredo do ambiente) e A-03 (liberar a rede)
  para testar a IA de verdade.
- A pontuação automática das oportunidades criadas pela busca entra na
  etapa 6, junto com as fontes externas e a geocodificação.
- A lista de Produtos e ideias mostra até 300 ideias, sem paginação.

## Etapa 6 — Fontes externas e pontuação automática (23/10/2026)

### Implementado
- **OpenStreetMap na busca** (`src/domain/sources/osm.ts`, `src/server/integrations/overpass.ts`):
  - uma consulta Overpass por busca, com estabelecimentos com nome no raio a
    partir do ponto de referência da pesquisa;
  - categorias traduzidas para português;
  - limite de 100 consultas por dia, pela política da instância pública;
  - atribuição "© colaboradores do OpenStreetMap (ODbL)" na pesquisa e na
    empresa.
- **Comparação de termos** sem diferenciar plural, gênero, acentos ou
  maiúsculas (`termMatches`). A pesquisa pode ter vários termos separados por
  vírgula, ";", "/" ou "ou".
- **Junção das fontes** (`mergeCandidates`): cada empresa aparece uma vez,
  com as fontes que a encontraram; máximo de 10 empresas.
- **Empresas vindas do OpenStreetMap**:
  - **mesmo registro já importado:** reaproveita a empresa;
  - **coincide com uma empresa cadastrada** (CNPJ, site, telefone ou nome):
    usa a empresa existente, marca "Possível duplicidade" com o link do
    registro, e não copia nem une dados;
  - **empresa nova:** entra no cadastro com origem por campo ("declarada pela
    fonte") e com o registro em `company_sources`. Telefone só é aceito com
    DDD.
- **Completar pelo CNPJ (BrasilAPI)**, na página da empresa:
  - preenche só campos vazios (segmento pelo CNAE, endereço, bairro, cidade,
    UF, CEP);
  - guarda situação cadastral, CNAE, porte, início das atividades e MEI;
  - não importa telefone nem e-mail, nem a razão social de MEI (LGPD);
  - avisa quando a situação não é "ativa";
  - CNPJ com letras: avisa que a consulta pública ainda não aceita.
- **Localizar pelo endereço (Nominatim)**:
  - só para empresas sem coordenadas;
  - no máximo 1 requisição por segundo;
  - recusa resultado impreciso (bairro ou cidade inteira);
  - a posição fica "declarada pela fonte", ou seja, não confirmada, e a
    proximidade continua limitada a 75 (DP-09).
- **Pontuação automática a cada busca** (`src/server/scoring.ts`): grava uma
  nova linha em `opportunity_scores` e `score_breakdowns`; a anterior fica no
  histórico.
  - **Proximidade:** pela distância até o ponto de referência da pesquisa.
  - **Compatibilidade, viabilidade e potencial comercial:**
    - com a IA configurada, uma chamada por busca, com até 40 combinações
      empresa × produto. A IA recebe só nome, categoria e bairro/cidade das
      empresas. As notas entram como "inferência da IA", com justificativa e
      aviso; "inviável" aplica o teto 39;
    - sem IA, esses três critérios ficam desconhecidos. A nota aparece como
      incompleta, com a faixa possível (ver DP-27).
  - Sem nenhum critério avaliado, nada é gravado e a tela mostra "sem nota".
- A página da oportunidade mostra a justificativa, a fonte e os avisos de
  cada critério. A página da pesquisa mostra a nota de cada oportunidade e as
  fontes com problema.
- Adaptador do Gemini generalizado (`generateJsonWithGemini`), com o esquema
  de validação passado por parâmetro.
- Migration `20261023000600_sources_and_scoring.sql`:
  - `ai_usage_log` aceita a finalidade `opportunity_assessment`;
  - `research_session_results` ganha `is_new_company` e
    `possible_duplicate_url` (só http/https).

### Testes executados (resultados reais)
- `npm run typecheck`, `npm run lint`: sem erros.
- `npm run build`: sucesso.
- Vitest: 132 testes passando, 111 unitários e 21 de integração. Os novos
  testes cobrem:
  - comparação de termos;
  - conversão do OpenStreetMap e da BrasilAPI;
  - escolha do resultado do Nominatim;
  - critérios avaliados pela IA ou desconhecidos, e o teto de inviável;
  - instruções da IA sem dados de contato;
  - adaptadores com respostas simuladas;
  - nova restrição do banco.
- Playwright: 42 testes passando, em duas execuções seguidas.
  - Os novos testes usam um servidor simulado das fontes
    (`tests/e2e/support/mock-sources.mjs`).
  - Cobrem importação, pontuação, aviso de duplicidade, reaproveitamento na
    nova execução, falha do OpenStreetMap comunicada, BrasilAPI e Nominatim.
- Verificação visual da pesquisa, da empresa importada e da oportunidade, em
  1440 px e em celular.
- **Não testado contra os serviços reais:**
  - Overpass, BrasilAPI e Nominatim continuam bloqueados pela rede do
    ambiente (A-03);
  - a avaliação pelo Gemini depende da chave (A-02).

### Problemas encontrados e corrigidos
- **Comparação de termos permissiva demais:** "segmento…" casava com
  "Segmento manual" porque uma palavra começava com a outra. Agora só aceita
  variações curtas da mesma palavra, com teste de regressão.
- **Teste E2E de completar pelo CNPJ:** esperava preencher cidade e UF, que
  já vêm no cadastro novo (Joinville–SC). O sistema estava certo; o teste foi
  ajustado.

### Pendências
- DP-27: decidir se a nota deve aparecer quando só a proximidade é conhecida.
- A-02 e A-03 para testar com os serviços reais.
- Etapa 7:
  - tela de revisão das possíveis duplicidades;
  - importação dos dados abertos do CNPJ;
  - confirmação de localização;
  - relatórios e exportação CSV.

## Etapa 7 — Revisão de duplicidades, relatórios e importação do CNPJ (23/10/2026)

### Implementado
- **Possíveis duplicidades** (`/empresas/duplicidades`):
  - a busca coloca na fila (`duplicate_reviews`) cada registro de fonte que
    coincide com uma empresa cadastrada por CNPJ, site, telefone ou nome;
  - a tela compara os dados lado a lado e mostra o que seria completado;
  - **"É a mesma empresa"** liga o registro à empresa existente e só
    preenche campos vazios, com a origem marcada;
  - **"São empresas diferentes"** cadastra a da fonte como nova;
  - a decisão passa por `resolve_duplicate_review()`, numa única transação,
    com responsável, data e observação. Não dá para decidir duas vezes;
  - as próximas buscas reconhecem o registro ligado e não mostram mais o
    aviso;
  - a página de Empresas mostra quantas revisões estão pendentes.
- **Confirmar localização**, na página da empresa:
  - confirmação humana, registrada com o nome de quem conferiu e a data;
  - libera a nota máxima de proximidade (DP-09).
- **Recalcular pontuação**, na oportunidade:
  - usa a localização e a região atuais e reaproveita a avaliação anterior
    dos demais critérios (sem nova chamada à IA);
  - grava uma nova versão da nota e registra "Pontuação recalculada" no
    histórico, com a nota anterior e a nova, por
    `record_score_recalculation()`.
- **Relatórios** (`/relatorios`):
  - período de 30 dias, 90 dias ou tudo;
  - números de destaque (criadas, em andamento, ganhas, perdidas; a taxa de
    ganho só aparece se houver encerradas);
  - funil por status, estrelas (com "sem nota" e quantas notas estão
    incompletas), segmentos, produtos, pesquisas e saúde das fontes;
  - barras de um só tom com o valor escrito ao lado.
- **Exportação CSV** de oportunidades e empresas:
  - `;`, BOM UTF-8 e vírgula decimal, para abrir no Excel em português;
  - proteção contra fórmulas;
  - exige sessão de membro ativo.
- **Importação dos dados abertos do CNPJ** (`scripts/import-cnpj.ts`):
  - roda fora do app, por um administrador;
  - acha o código do município na tabela da própria Receita;
  - importa só estabelecimentos ativos, com nome fantasia, sem telefone nem
    e-mail;
  - ignora CNPJ já cadastrado e manda nome igual para revisão;
  - tem modo de simulação. `tsx` foi adicionado como dependência de
    desenvolvimento.
- A navegação não tem mais áreas "Em desenvolvimento".
- Migration `20261023000700_duplicate_reviews.sql`: tabela
  `duplicate_reviews` (RLS, sem atualização direta, um pendente por
  registro) e as funções `resolve_duplicate_review` e
  `record_score_recalculation`.

### Testes executados (resultados reais)
- `npm run typecheck`, `npm run lint` e `npm run build`: sem erros.
- Vitest: 146 testes passando, 122 unitários e 24 de integração. Os novos
  testes cobrem:
  - leitura dos arquivos da Receita (com arquivos fictícios em
    `tests/fixtures/receita`);
  - comparação das duplicidades;
  - recálculo reaproveitando a avaliação;
  - relatórios e CSV;
  - as duas funções do banco, o bloqueio da decisão direta e o acesso de
    inativo e anônimo.
- Playwright: 48 testes passando, em duas execuções seguidas. Os novos
  testes cobrem:
  - decidir duplicidades, confirmar localização, recalcular e executar de
    novo sem aviso;
  - relatórios e os dois CSV;
  - exportação sem sessão redireciona para o login.
- Script de importação executado duas vezes no banco local com os arquivos
  fictícios: 1 empresa criada e, na segunda vez, 1 ignorada pelo CNPJ.
  Telefone e e-mail não foram gravados. Os dados de teste foram apagados
  depois.
- Verificação visual de `/empresas/duplicidades` e `/relatorios` em 1440 px
  e em celular.

### Problemas encontrados e corrigidos
- **Comparação de duplicidades alargava a página no celular** (36 px): a
  tabela tinha largura mínima. Agora as linhas quebram, e o teste E2E mede
  a largura.
- **Dados de teste repetidos entre execuções:** o mesmo telefone em dois
  testes fez o sistema apontar, corretamente, uma coincidência. O telefone e
  a observação de teste passaram a ser únicos por execução.
- **Teste antigo da navegação** esperava "Relatórios" em desenvolvimento;
  foi atualizado.
- **Ambiente local:** depois de aplicar uma migration à mão, o PostgREST
  precisa recarregar o esquema (`notify pgrst, 'reload schema'`).

### Pendências
- DP-27 (nota com só a proximidade), A-02 e A-03 continuam abertas.
- A importação real dos dados do CNPJ depende de baixar os arquivos do mês;
  só foi testada com arquivos fictícios.
- Etapa 8: revisão de acessibilidade, segurança e desempenho; implantação.

## Etapa 8 — Acessibilidade, segurança, desempenho e implantação (23/10/2026)

### Acessibilidade
- **Teste automático com axe (WCAG 2.1 A/AA)** em todas as telas, desktop e
  celular, incluindo as de detalhe quando há dados
  (`tests/e2e/accessibility.spec.ts`).
- **Corrigido:**
  - **Contraste do texto mais apagado:** subia para 3,8:1 nas superfícies
    claras; com o token `--subtle-foreground` ajustado chega a ≥ 4,77:1 em
    todas.
  - **Pipeline:** o link "Somente salvas" usava `aria-pressed`, que só vale
    para botões; passou a usar `aria-current`.
  - **Login no celular:** o título principal ficava escondido; agora o
    título é "Entrar".
  - **Tabelas largas:** as que rolam na horizontal passaram a receber foco
    pelo teclado.
- Teste só pelo teclado: entrar e usar o atalho "Pular para o conteúdo".

### Segurança
- **Content Security Policy com nonce novo a cada requisição**, em
  `src/proxy.ts` e `src/lib/security/csp.ts`:
  - só scripts do próprio site;
  - nenhuma origem externa;
  - `frame-ancestors 'none'`;
  - `upgrade-insecure-requests` em HTTPS;
  - todas as páginas renderizadas por requisição (`connection()` no layout
    raiz).
- **Novos cabeçalhos:** HSTS e `Cross-Origin-Opener-Policy`.
- **Redirecionamento aberto corrigido:** `next=/<TAB>/site.com` passava pelo
  filtro e o navegador o transformava em `//site.com`. A validação agora
  usa o parser de URL e recusa caracteres de controle e barras invertidas,
  com testes.
- **Banco:**
  - novo teste de integração verifica que toda tabela tem RLS, que o
    `anon` não tem nenhum privilégio, que as funções privilegiadas têm
    `search_path` fixo, que as views respeitam o RLS de quem consulta e que
    nenhum papel apaga dados;
  - `set_updated_at()` deixou de ser executável pela API (o gatilho
    continua funcionando; conferido).
- **Autenticação local:** cadastro público desligado e senha mínima de 10
  caracteres com letras e números (`supabase/config.toml`). O guia de
  implantação repete isso para o projeto na nuvem.
- **Revisão manual dos pontos sensíveis:**
  - toda Server Action verifica a sessão;
  - as ações de administrador verificam o papel no servidor e no banco;
  - links externos têm `rel="noopener"`;
  - não há `dangerouslySetInnerHTML`;
  - mensagens de erro não expõem detalhes internos;
  - `.env*` está no `.gitignore`.
- `npm audit --omit=dev`: 0 vulnerabilidades.

### Desempenho
- **Índices para as consultas do app:** oportunidades por produto e por
  data; empresas por data; novas execuções; limite diário por fonte;
  resultados por empresa e por oportunidade; revisões por empresa.
- **Zod fora do navegador:** cinco componentes puxavam a biblioteca de
  validação (cerca de 100 KB) por importar módulos do domínio. Constantes e
  regras simples foram separadas em módulos sem dependências
  (`statuses.ts`, `production-options.ts`, `research/types.ts`,
  `companies/options.ts`); os módulos originais reexportam tudo.
- **Motion carregado com `LazyMotion` + `domAnimation`.**
- **Medido:** cerca de 765 KB de JavaScript descompactado (cerca de 250 KB
  transferidos com compressão) por tela, a maior parte do React e do
  Next.js.

### Implantação
- **CI no GitHub** (`.github/workflows/ci.yml`):
  - lint, tipos, testes unitários, build e `npm audit`;
  - um segundo job aplica as migrations em um Supabase local e roda os
    testes de integração. Esse job não pôde ser executado aqui (sem
    Docker): conferir na primeira execução no GitHub.
- **Guia passo a passo** (`docs/IMPLANTACAO.md`), com Supabase e Vercel no
  plano gratuito, região São Paulo, variáveis, conferência depois do deploy,
  cópia de segurança semanal e pausa por inatividade.

### Testes executados (resultados reais)
- `npm run typecheck`, `npm run lint` e `npm run build`: sem erros.
- Vitest: 153 testes passando, 126 unitários e 27 de integração.
- Playwright: 56 testes passando, em duas execuções seguidas. Incluem axe
  em todas as telas, uso só pelo teclado e cabeçalhos de segurança.
- Conferido à mão: login, navegação e menu do celular com a CSP ativa, sem
  nenhum erro no console.

### Pendências
- Publicar seguindo `docs/IMPLANTACAO.md` (contas Supabase e Vercel da
  CRIEXO).
- Conferir o job de banco da CI na primeira execução no GitHub.
- Revisão manual com leitor de tela antes do uso diário.
- DP-27, DP-18, A-02 e A-03 continuam abertas.

## Ajuste — Primeiro acesso (26/10/2026)

### Motivo
Os dois usuários criados no Supabase não conseguiam entrar. O app mostrava
"E-mail ou senha incorretos." para qualquer erro, inclusive "e-mail não
confirmado", então não dava para saber a causa.

### Implementado
- **Mensagens do login:** agora diferenciam e-mail não confirmado, usuário
  bloqueado, excesso de tentativas e serviço indisponível. Senha errada
  continua com a mensagem genérica. O código do erro vai para o log do
  servidor, sem e-mail nem senha.
- **E-mail com espaços ou maiúsculas:** é normalizado **antes** da
  validação. Antes, um e-mail colado com espaço no fim era recusado no
  login.
- **Primeiro acesso (DP-28):**
  - migration `20261026000900_first_access.sql` cria a lista
    `authorized_emails` (só administradores leem; ninguém altera pela API);
  - gatilho `before insert` em `auth.users`: só e-mail liberado e ainda não
    usado vira conta;
  - o perfil nasce liberado, com o papel e o nome da lista;
  - excluir o usuário devolve o e-mail à lista como não usado;
  - tela `/primeiro-acesso` (e-mail, nova senha, repetir senha) e link na
    tela de login.
- **Script de uso único** `docs/sql/primeiro-acesso-recomecar.sql`: passa
  os usuários atuais para a lista, como administradores, e os apaga.
- **Documentação:** README, guia de implantação e prompt do Cowork
  atualizados. No Supabase, "Allow new users to sign up" fica ligado (a
  lista é a trava) e "Confirm email" desligado.

### Testes executados (resultados reais)
- Vitest: 159 testes passando, incluindo:
  - a trava do banco (fora da lista recusado, uso único, exclusão devolve o
    e-mail);
  - o acesso à lista;
  - as mensagens e a validação de senha.
- Playwright: o novo `first-access.spec.ts` passa no computador e no
  celular (validação, e-mail fora da lista, criação, uso único e login com
  a senha criada). A suíte completa está registrada no commit.
- Script de recomeço executado no banco local dentro de uma transação
  desfeita: passou os usuários para a lista, apagou-os e liberou os
  e-mails.
