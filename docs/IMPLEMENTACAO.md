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
