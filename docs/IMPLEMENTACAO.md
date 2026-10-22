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
