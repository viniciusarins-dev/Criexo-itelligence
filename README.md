# CRIEXO Intelligence

Sistema interno de prospecção comercial da **CRIEXO Soluções Criativas** para
encontrar, avaliar e acompanhar empresas que possam comprar produtos e
soluções em impressão 3D.

> **Situação:** etapas 1 e 2 de 8 concluídas — base, design system,
> autenticação, banco com RLS, motor de pontuação, dashboard e configurações. O fluxo de prospecção, as
> integrações e as demais telas ainda **não** estão implementados. Ver
> [`docs/IMPLEMENTACAO.md`](docs/IMPLEMENTACAO.md) e
> [`docs/CRITERIOS_DE_ACEITACAO.md`](docs/CRITERIOS_DE_ACEITACAO.md).

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [`docs/DIAGNOSTICO_E_PLANO.md`](docs/DIAGNOSTICO_E_PLANO.md) | Diagnóstico, arquitetura, plano por etapas, riscos, fontes candidatas |
| [`docs/REGRAS_DE_NEGOCIO.md`](docs/REGRAS_DE_NEGOCIO.md) | Regras RN-01…RN-12 e onde cada uma é garantida |
| [`docs/DECISOES_PENDENTES.md`](docs/DECISOES_PENDENTES.md) | O que o negócio ainda precisa decidir |
| [`docs/CRITERIOS_DE_ACEITACAO.md`](docs/CRITERIOS_DE_ACEITACAO.md) | Critérios do MVP e situação de cada um |
| [`docs/IMPLEMENTACAO.md`](docs/IMPLEMENTACAO.md) | Registro do que foi feito e testado em cada etapa |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estrito · Tailwind CSS 4 ·
componentes no padrão shadcn/ui (Radix UI) · Lucide · Motion · Supabase
(Auth + PostgreSQL + RLS) · Zod · Vitest · Playwright.

## Pré-requisitos

- Node.js 22 ou superior
- Para desenvolvimento local do banco: [Supabase CLI](https://supabase.com/docs/guides/cli)
  e Docker (`supabase start`). Alternativa: um projeto Supabase na nuvem.

## Instalação

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
```

## Supabase

### Local

```bash
npx supabase@2.121.0 start        # sobe Postgres, Auth e API (Docker)
npx supabase@2.121.0 db reset     # aplica supabase/migrations
npx supabase@2.121.0 status       # mostra URL e chave publicável/anon
```

### Nuvem

1. Crie um projeto e vincule: `npx supabase@2.121.0 link --project-ref <ref>`.
2. Aplique as migrations: `npx supabase@2.121.0 db push`.
3. Em **Authentication → Providers → Email**, desative o cadastro público
   ("Allow new users to sign up"). O `supabase/config.toml` já faz isso no
   ambiente local.

### Usuários autorizados

Não há cadastro público. Para liberar alguém:

1. Crie o usuário em **Authentication → Users → Add user** (e-mail e senha).
   Um perfil **inativo** é criado automaticamente.
2. Libere o **primeiro administrador** pelo SQL Editor:
   ```sql
   update public.profiles set is_active = true, role = 'admin'
   where id = (select id from auth.users where email = 'email@exemplo.com');
   ```
3. Os demais usuários são liberados em **Configurações → Equipe**.

Christian e Vinicius são administradores (DP-13).

### Primeira configuração

Em **Configurações**, preencha a região (Rua Landman, 147 + coordenadas,
raio de 10 km) e a capacidade produtiva com os valores aprovados em
`docs/REGRAS_DE_NEGOCIO.md`. Itens ambíguos (DP-22 a DP-25) podem ficar
"a confirmar".

### Tipos do banco

Depois de alterar migrations: `npm run db:types` (requer Supabase local).

## Desenvolvimento

```bash
npm run dev         # http://localhost:3000
npm run build && npm start
```

Sem as variáveis do Supabase, o app mostra a tela "Configuração pendente".

## Testes

```bash
npm run typecheck         # TypeScript
npm run lint              # ESLint
npm run test:unit         # regras de negócio (Vitest)
npm run test:integration  # RLS e funções de histórico — requer TEST_DATABASE_URL
npm run test:e2e          # Playwright — requer build, Supabase e usuários E2E (admin, membro, inativo)
```

Os testes de integração são ignorados quando `TEST_DATABASE_URL` não está
definida; os E2E que dependem de usuários são ignorados sem as variáveis
`E2E_*`.

## Integrações

Nenhuma integração externa (IA, fontes empresariais, geocodificação) está
implementada nesta etapa. Cada uma será adicionada como adaptador próprio
depois de validados plano gratuito, limites e termos de uso — ver
`docs/DIAGNOSTICO_E_PLANO.md` §6.

## Plugins do Claude Code

Declarados em `.claude/settings.json` (escopo do projeto). Quem abre o
repositório no Claude Code recebe a oferta de instalá-los; depois de
instalar, reinicie a sessão ou use `/reload-plugins`.

| Plugin | Origem | Para quê |
|--------|--------|----------|
| `superpowers` | marketplace oficial (autor: obra) | brainstorming, TDD, depuração sistemática, revisão por subagentes |
| `claude-code-setup` | marketplace oficial (Anthropic) | recomenda automações para o projeto |
| `claude-security` | marketplace oficial (Anthropic) | varredura de vulnerabilidades e sugestão de correções |
| `caveman` | `JuliusBrussee/caveman` (terceiro) | respostas curtas para economizar tokens |

O **Caveman** fica em modo manual neste repositório (`.caveman.json`):
começa desligado e liga com `/caveman` (`/caveman off` desliga). Os recursos
opcionais dele que usam conta ou enviam dados (Auto, login) não foram
ativados.

O **OmniRoute** não faz parte do projeto: é um programa à parte, instalado em
cada computador, que troca o modelo do Claude Code por modelos de outros
provedores.

## Segurança

- Todo acesso a dados usa a sessão do usuário; as políticas RLS bloqueiam
  usuários anônimos e inativos.
- A `service_role` key não é usada pela aplicação e nunca deve ir para o
  navegador.
- Históricos (decisões, status, pontuações, configurações) não podem ser
  alterados nem apagados pela API.
- **Migrations novas** que criem tabelas devem revogar os privilégios padrão
  de `anon`/`authenticated` e conceder apenas o necessário (ver comentário na
  migration inicial).

## Limitações conhecidas

- Apenas tema escuro (decisão DP-19).
- Logotipo provisório até o envio do arquivo oficial.
- Projetos Supabase do plano gratuito podem ser pausados por inatividade e
  têm recursos de backup limitados — verificar o plano antes de usar em
  produção (DP-21).

## Implantação

Qualquer plataforma compatível com Next.js (ex.: Vercel). Configure
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no
ambiente de build (são embutidas no build) e inclua a URL de produção em
**Authentication → URL Configuration** do Supabase.
