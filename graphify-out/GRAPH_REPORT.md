# Graph Report - Criexo-itelligence  (2026-10-26)

## Corpus Check
- 220 files · ~96,269 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .csv 3, (none) 2, .example 1)

## Summary
- 1382 nodes · 4026 edges · 69 communities (62 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a3dd221c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- empresas/page.tsx
- react
- supabase/proxy.ts
- oportunidades/actions.ts
- Registro de implementação
- receita.ts
- @playwright/test
- checks
- repositories/reports.ts
- Skeleton
- research/research.ts
- package.json
- createSupabaseServerClient
- produtos/actions.ts
- empresas/[id]/page.tsx
- engine.ts
- 20261022000100_initial_schema.sql
- osm.ts
- empresas/actions.ts
- search.ts
- produtos/actions.ts
- dependencies
- pesquisas/[id]/page.tsx
- repositories/research.ts
- compilerOptions
- Agent Selection Matrix (25 Skills)
- configuracoes/actions.ts
- server.ts
- settings.ts
- Critérios de aceitação — MVP
- companies.ts
- vitest
- CRIEXO Intelligence
- app/layout.tsx
- scripts
- Orchestration Patterns
- dashboard.ts
- Diagnóstico, arquitetura e plano
- README.md
- production.ts
- mock-sources.mjs
- Implantação — passo a passo
- eslint.config.mjs
- Supabase
- AGENTS.md
- next
- Orchestrator AI - Specification Driven Development
- CodeGraph MCP Server Integration
- oportunidades/[id]/page.tsx
- Etapa 8 — Acessibilidade, segurança, desempenho e implantação (23/10/2026)
- Etapa 2 — Configurações e decisões do Christian (22/10/2026)
- Etapa 5 — Nova prospecção e Produtos e ideias (23/10/2026)
- Etapa 7 — Revisão de duplicidades, relatórios e importação do CNPJ (23/10/2026)
- Etapa 3 — Empresas (23/10/2026)
- 🇬🇧 English Welcome Message
- Workflow Engine Integration (v2.1.0)
- Module Integration Examples
- MUSUBI CLI Commands Reference
- Managed Agents Overview (25 Types)
- Etapa 1 — base segura e verificável (22/10/2026)
- Agent Selection Logic
- Orchestratorの役割（対話モード時）
- ファイル出力要件
- 標準ワークフロー
- CLAUDE.md
- install-graphify.sh

## God Nodes (most connected - your core abstractions)
1. `cn()` - 73 edges
2. `Button()` - 66 edges
3. `createSupabaseServerClient()` - 65 edges
4. `requireActiveMember()` - 61 edges
5. `next` - 49 edges
6. `lucide-react` - 48 edges
7. `react` - 47 edges
8. `Card()` - 44 edges
9. `EmptyState()` - 38 edges
10. `Badge()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `Testes executados` --references--> `normalizeCnpj()`  [INFERRED]
  docs/IMPLEMENTACAO.md → src/domain/rules/normalization.ts
- `Decisões aprovadas — Christian Drager, 22/10/2026` --references--> `evaluateProximity()`  [INFERRED]
  docs/REGRAS_DE_NEGOCIO.md → src/domain/scoring/proximity.ts
- `Autenticação` --references--> `requireActiveMember()`  [INFERRED]
  docs/CRITERIOS_DE_ACEITACAO.md → src/lib/auth/session.ts
- `Implementado` --references--> `requireActiveMember()`  [INFERRED]
  docs/IMPLEMENTACAO.md → src/lib/auth/session.ts
- `2. Preparar o GitHub` --references--> `main()`  [INFERRED]
  docs/PROMPT_COWORK_IMPLANTACAO.md → scripts/import-cnpj.ts

## Import Cycles
- None detected.

## Communities (69 total, 7 thin omitted)

### Community 0 - "empresas/page.tsx"
Cohesion: 0.17
Nodes (32): MemberRow(), TeamTable(), EditCompanyPage(), metadata, CompaniesPage(), Distance(), Location(), metadata (+24 more)

### Community 1 - "react"
Cohesion: 0.06
Nodes (89): lucide-react, radix-ui, react, react-dom, sonner, metadata, PendingAccessPage(), handleSignOut() (+81 more)

### Community 2 - "supabase/proxy.ts"
Cohesion: 0.15
Nodes (16): signIn(), SignInState, EnvResult, PublicEnv, publicEnvSchema, readPublicEnv(), buildContentSecurityPolicy(), createNonce() (+8 more)

### Community 3 - "oportunidades/actions.ts"
Cohesion: 0.16
Nodes (23): addActivity(), changeStatus(), createOpportunity(), dbMessage(), fail(), moveOpportunity(), refresh(), setSaved() (+15 more)

### Community 4 - "Registro de implementação"
Cohesion: 0.15
Nodes (13): Ajustes após os esclarecimentos do Christian (22/10/2026), Etapa 4 — Oportunidades e pipeline comercial (23/10/2026), Etapa 6 — Fontes externas e pontuação automática (23/10/2026), Ferramentas de desenvolvimento: graphify e orchestrator (26/10/2026), Implementado, Pendências, Problemas encontrados e corrigidos, Problemas encontrados e corrigidos (+5 more)

### Community 5 - "receita.ts"
Cohesion: 0.08
Nodes (33): 1. Revogar a chave antiga da OpenAI, 2. Preparar o GitHub, 3. Criar o banco no Supabase, 4. Configurar o login no Supabase, 5. Publicar na Vercel, 6. IA (Gemini, opcional — só se eu confirmar), 7. Conferência final, Ao terminar (+25 more)

### Community 6 - "@playwright/test"
Cohesion: 0.07
Nodes (19): mockPort, port, @playwright/test, WCAG, admin, inactive, admin, admin (+11 more)

### Community 7 - "checks"
Cohesion: 0.06
Nodes (33): env, name, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group (+25 more)

### Community 8 - "repositories/reports.ts"
Cohesion: 0.13
Nodes (29): date(), GET(), BarList(), Bar, cell(), CsvColumn, funnel(), OpportunityRow (+21 more)

### Community 9 - "Skeleton"
Cohesion: 0.13
Nodes (15): SettingsLoading(), DashboardLoading(), DuplicatesLoading(), CompanyLoading(), CompaniesLoading(), OpportunityLoading(), Loading(), ResearchLoading() (+7 more)

### Community 10 - "research/research.ts"
Cohesion: 0.12
Nodes (22): Implementado, Decisões aprovadas — Christian Drager, 22/10/2026, Estratégia de pontuação implementada (aprovada — DP-04 a DP-12), Regras de negócio, CandidateCompany, IdeaDecision, mergeCandidates(), Rankable (+14 more)

### Community 11 - "package.json"
Cohesion: 0.10
Nodes (25): devDependencies, @axe-core/playwright@^4.10.1, @playwright/test@^1.64.1, tailwindcss@^4, @tailwindcss/turbopack@^4, tsx@^4.19.2, @types/node@^22.20.5, @types/pg@^8.23.1 (+17 more)

### Community 12 - "createSupabaseServerClient"
Cohesion: 0.08
Nodes (43): zod, confirmCompanyLocation(), DuplicateDecisionState, resolveDuplicate(), schema, recalculateScore(), createResearch(), submit() (+35 more)

### Community 13 - "produtos/actions.ts"
Cohesion: 0.14
Nodes (21): server-only, addManualIdea(), decideIdea(), decisionSchema, generateAiIdeas(), refresh(), uuid, submit() (+13 more)

### Community 14 - "empresas/[id]/page.tsx"
Cohesion: 0.16
Nodes (27): LastUpdate(), metadata, SECTIONS, SettingsPage(), ScoringSummary(), CompanyPage(), FIELD_LABELS, Item() (+19 more)

### Community 15 - "engine.ts"
Cohesion: 0.06
Nodes (45): AssessmentAvailability, assessmentResponseSchema, criterionAssessmentSchema, criterionInputSchema, evidenceSchema, JUDGED, MAX_ASSESSMENT_PAIRS, OpportunityAssessment (+37 more)

### Community 16 - "20261022000100_initial_schema.sql"
Cohesion: 0.05
Nodes (63): companies_set_updated_at, on_auth_user_created, opportunities_set_updated_at, private.handle_new_user(), private.is_active_member(), private.is_admin(), private.log_system_setting_change(), product_idea_decisions_idea_idx (+55 more)

### Community 17 - "osm.ts"
Cohesion: 0.17
Nodes (11): AMENITY_VALUES, elementSchema, LEISURE_VALUES, OSM_ATTRIBUTION, OSM_CATEGORY_LABELS, OSM_COPYRIGHT_URL, OSM_DAILY_QUERY_LIMIT, OSM_KEYS (+3 more)

### Community 18 - "empresas/actions.ts"
Cohesion: 0.06
Nodes (67): CompanyFormState, draftToRow(), enrichCompanyFromCnpj(), FIELD_NAMES, geocodeCompany(), idSchema, rowToDraft(), saveCompany() (+59 more)

### Community 19 - "search.ts"
Cohesion: 0.17
Nodes (18): findDuplicateCandidates(), AssessmentPromptContext, buildAssessmentPrompt(), IdeasPromptContext, opportunityCriteria(), osmDailyLimit(), startOfDayInSaoPaulo(), Candidate (+10 more)

### Community 20 - "produtos/actions.ts"
Cohesion: 0.11
Nodes (21): AiIdea, aiIdeaSchema, aiIdeasResponseSchema, ExistingIdea, ManualIdea, ManualIdeaInput, manualIdeaSchema, nameSimilarity() (+13 more)

### Community 21 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, class-variance-authority@^0.7.1, clsx@^2.1.1, lucide-react@^1.61.0, next@16.4.2, radix-ui@^1.8.1, react@19.3.0, react-dom@19.3.0 (+11 more)

### Community 22 - "pesquisas/[id]/page.tsx"
Cohesion: 0.15
Nodes (25): Info(), metadata, PRE_SEARCH, ResearchPage(), Step(), ideasSummary(), metadata, IdeaPage() (+17 more)

### Community 23 - "repositories/research.ts"
Cohesion: 0.21
Nodes (15): findSimilarIdeas(), aiStatus, allIdeaNames(), Client, getIdea(), getResearch(), IdeaRow, ideaSessionIds() (+7 more)

### Community 24 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 25 - "Agent Selection Matrix (25 Skills)"
Cohesion: 0.09
Nodes (21): Additional Skills (Beyond Original 25), Agent Selection Matrix (25 Skills), By SDD Workflow Stage, By Task Type, Category 1: Orchestration & Management (3 Skills), Category 2: Requirements & Planning (3 Skills), Category 3: Architecture & Design (4 Skills), Category 4: Development & Implementation (2 Skills) (+13 more)

### Community 26 - "configuracoes/actions.ts"
Cohesion: 0.28
Nodes (15): displayNameSchema, done(), fail(), fieldErrorsFrom(), memberAccessSchema, saveProduction(), saveRegion(), setMemberAccess() (+7 more)

### Community 27 - "server.ts"
Cohesion: 0.10
Nodes (26): fail(), rerunResearch(), runSearch(), uuid, ProvenanceMap, researchInputSchema, recalculationCriteria(), ScoreResult (+18 more)

### Community 28 - "settings.ts"
Cohesion: 0.19
Nodes (12): parseScoringConfig(), GeoReference, geoReferenceSchema, RADIUS_KM_MAX, radiusKmSchema, ProductionSettings, productionSettingsSchema, SettingsData (+4 more)

### Community 29 - "Critérios de aceitação — MVP"
Cohesion: 0.12
Nodes (16): Acessibilidade, segurança e implantação (etapa 8), Aprovação, Autenticação, Configurações (etapa 2), Critérios de aceitação — MVP, Descoberta, Empresas (etapa 3), Fontes e pontuação (etapa 6) (+8 more)

### Community 30 - "companies.ts"
Cohesion: 0.14
Nodes (19): ExistingCompanyKeys, sanitizeSearchTerm(), activeScoringConfig(), companiesMatching(), COMPANY_PAGE_SIZE, COMPANY_SORTS, CompanyDetails, CompanyList (+11 more)

### Community 31 - "vitest"
Cohesion: 0.14
Nodes (7): pg@^8.23.1, vitest@^5.0.5, pg, vitest, as(), setup(), Users

### Community 32 - "CRIEXO Intelligence"
Cohesion: 0.15
Nodes (13): CRIEXO Intelligence, Desenvolvimento, Documentação, Implantação, Importar os dados abertos do CNPJ, Instalação, Integrações, Limitações conhecidas (+5 more)

### Community 33 - "app/layout.tsx"
Cohesion: 0.23
Nodes (8): motion@^14.5.0, motion, metadata, montserrat, RootLayout(), viewport, MotionProvider(), Toaster()

### Community 34 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:types, dev, lint, start, test, test:e2e (+3 more)

### Community 35 - "Orchestration Patterns"
Cohesion: 0.11
Nodes (17): Best Practices, Design Review Gate, Orchestration Patterns, Overview, Pattern 1: Auto Pattern (Recommended), Pattern 2: Sequential Pattern, Pattern 3: Nested Pattern (Hierarchical), Pattern 4: Group Chat Pattern (+9 more)

### Community 36 - "dashboard.ts"
Cohesion: 0.19
Nodes (14): DashboardPage(), metadata, RecentActivity(), StatTile(), StatusDistribution(), ACTIVITY_LABELS, DashboardData, DashboardLoadError (+6 more)

### Community 37 - "Diagnóstico, arquitetura e plano"
Cohesion: 0.20
Nodes (10): 1. Diagnóstico inicial (22/10/2026), 2. Arquitetura, 3. Modelo de dados (resumo), 4. Plano incremental, 5. Riscos técnicos e dependências externas, 6. Fontes de dados e IA — decisão sem custo (DP-15, DP-16, 22/10/2026), Busca de empresas, Diagnóstico, arquitetura e plano (+2 more)

### Community 38 - "README.md"
Cohesion: 0.22
Nodes (3): Ações necessárias (não são decisões), Decisões pendentes, Em aberto

### Community 39 - "production.ts"
Cohesion: 0.25
Nodes (13): dimension, MATERIALS, MODELING_LABELS, MODELING_LEVELS, PRINT_TIME_BANDS, PRINT_TIME_BASES, PRINT_TIME_BASIS_LABELS, PRINT_TIME_LABELS (+5 more)

### Community 41 - "Implantação — passo a passo"
Cohesion: 0.33
Nodes (5): 1. Banco de dados (Supabase), 2. Aplicação (Vercel), 3. Conferência depois do deploy, 4. Operação, Implantação — passo a passo

### Community 42 - "eslint.config.mjs"
Cohesion: 0.33
Nodes (5): eslintConfig, eslint@^9, eslint-config-next@16.4.2, eslint, eslint-config-next

### Community 43 - "Supabase"
Cohesion: 0.33
Nodes (6): Local, Nuvem, Primeira configuração, Supabase, Tipos do banco, Usuários autorizados

### Community 45 - "next"
Cohesion: 0.16
Nodes (15): nextConfig, securityHeaders, next, Comparison(), DuplicatesPage(), metadata, CompanyNotFound(), metadata (+7 more)

### Community 46 - "Orchestrator AI - Specification Driven Development"
Cohesion: 0.20
Nodes (9): Before Starting Orchestration, Benefits, Guardrails Commands (v3.9.0 NEW), Language Preference Policy, Orchestrator AI - Specification Driven Development, Project Memory (Steering System), Role Definition, Your Responsibilities (+1 more)

### Community 48 - "CodeGraph MCP Server Integration"
Cohesion: 0.20
Nodes (10): CodeGraph MCP Server Integration, CodeGraph MCP インストール・設定, CodeGraph活用ワークフロー, Step 1: 環境確認, Step 2: インストール実行, Step 3: プロジェクトインデックス作成, Step 4: 設定ファイル作成（オプション選択）, プロジェクトのインデックス作成 (+2 more)

### Community 49 - "oportunidades/[id]/page.tsx"
Cohesion: 0.24
Nodes (13): metadata, OpportunityPage(), InformationBadge(), TONES, RecentResearch(), RecalculateScoreButton(), SaveToggle(), StatusBadge() (+5 more)

### Community 50 - "Etapa 8 — Acessibilidade, segurança, desempenho e implantação (23/10/2026)"
Cohesion: 0.29
Nodes (7): Acessibilidade, Desempenho, Etapa 8 — Acessibilidade, segurança, desempenho e implantação (23/10/2026), Implantação, Pendências, Segurança, Testes executados (resultados reais)

### Community 51 - "Etapa 2 — Configurações e decisões do Christian (22/10/2026)"
Cohesion: 0.40
Nodes (5): Etapa 2 — Configurações e decisões do Christian (22/10/2026), Implementado, Pendências, Problemas encontrados e corrigidos, Testes executados (resultados reais)

### Community 52 - "Etapa 5 — Nova prospecção e Produtos e ideias (23/10/2026)"
Cohesion: 0.40
Nodes (5): Etapa 5 — Nova prospecção e Produtos e ideias (23/10/2026), Implementado, Pendências, Problemas encontrados e corrigidos, Testes executados (resultados reais)

### Community 53 - "Etapa 7 — Revisão de duplicidades, relatórios e importação do CNPJ (23/10/2026)"
Cohesion: 0.40
Nodes (5): Etapa 7 — Revisão de duplicidades, relatórios e importação do CNPJ (23/10/2026), Implementado, Pendências, Problemas encontrados e corrigidos, Testes executados (resultados reais)

### Community 54 - "Etapa 3 — Empresas (23/10/2026)"
Cohesion: 0.50
Nodes (4): Etapa 3 — Empresas (23/10/2026), Implementado, Problemas encontrados e corrigidos, Testes executados (resultados reais)

### Community 55 - "🇬🇧 English Welcome Message"
Cohesion: 0.20
Nodes (10): 🇬🇧 English Welcome Message, 📋 How to Use, 🎯 Key Features, 🤖 Managed Agents (25 Types), セッション開始メッセージ, 📋 使い方, 🎯 提供機能, 🇯🇵 日本語ウェルカムメッセージ (+2 more)

### Community 58 - "Workflow Engine Integration (v2.1.0)"
Cohesion: 0.29
Nodes (7): 10ステージ ワークフロー, Orchestrator推奨フロー, Workflow Engine Integration (v2.1.0), ステージ遷移, フィードバックループ, メトリクス活用, ワークフロー開始時

### Community 59 - "Module Integration Examples"
Cohesion: 0.29
Nodes (7): Available Modules, Module Integration Examples, OpenHands-Inspired Modules (v3.0.0), Orchestrator Integration Points, Quality Evaluation, Security Pre-check, Stuck Detection

### Community 60 - "MUSUBI CLI Commands Reference"
Cohesion: 0.33
Nodes (6): Advanced Commands (v3.5.0 NEW), Core Workflow Commands, Detailed Command Options, MUSUBI CLI Commands Reference, Replanning Commands (v3.6.0 NEW), Supporting Commands

### Community 61 - "Managed Agents Overview (25 Types)"
Cohesion: 0.33
Nodes (6): Design & Architecture (5 agents), Development & Quality (7 agents), Managed Agents Overview (25 Types), Operations & Infrastructure (5 agents), Orchestration & Governance (3 agents), Specialized Experts (5 agents)

### Community 62 - "Etapa 1 — base segura e verificável (22/10/2026)"
Cohesion: 0.33
Nodes (6): Etapa 1 — base segura e verificável (22/10/2026), Implementado, Observações de ambiente, Pendências desta etapa, Problemas encontrados e corrigidos, Testes executados (resultados reais)

### Community 63 - "Agent Selection Logic"
Cohesion: 0.40
Nodes (5): Agent Selection Logic, Agent Selection Matrix, ステップ1: リクエストタイプの分類, ステップ2: 複雑度評価, ステップ3: 依存関係マッピング

### Community 64 - "Orchestratorの役割（対話モード時）"
Cohesion: 0.40
Nodes (5): Orchestratorの役割（対話モード時）, パターンA: 単一エージェント実行, パターンB: 複数エージェント連携（順次実行）, パターンC: 並列実行可能な複数エージェント, 重要：対話モードについて

### Community 65 - "ファイル出力要件"
Cohesion: 0.40
Nodes (5): ファイル出力要件, ファイル命名規則, 出力ディレクトリ, 必須出力ファイル, 重要：ドキュメント作成の細分化ルール

### Community 66 - "標準ワークフロー"
Cohesion: 0.40
Nodes (5): ワークフロー1: 新機能開発（フルサイクル）, ワークフロー2: バグ修正（迅速対応）, ワークフロー3: セキュリティ強化, ワークフロー4: パフォーマンスチューニング, 標準ワークフロー

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireActiveMember()` connect `createSupabaseServerClient` to `react`, `oportunidades/actions.ts`, `dashboard.ts`, `repositories/reports.ts`, `next`, `produtos/actions.ts`, `empresas/actions.ts`, `repositories/research.ts`, `companies.ts`, `configuracoes/actions.ts`, `server.ts`, `settings.ts`, `Critérios de aceitação — MVP`, `Etapa 1 — base segura e verificável (22/10/2026)`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `requireActiveMember()` (e.g. with `Autenticação` and `Implementado`) actually correct?**
  _`requireActiveMember()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.0629757063914086 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `empresas/page.tsx`, `react`, `app/layout.tsx`, `oportunidades/actions.ts`, `dashboard.ts`, `supabase/proxy.ts`, `package.json`, `createSupabaseServerClient`, `produtos/actions.ts`, `empresas/[id]/page.tsx`, `oportunidades/[id]/page.tsx`, `empresas/actions.ts`, `dependencies`, `pesquisas/[id]/page.tsx`, `configuracoes/actions.ts`, `server.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `supabase/proxy.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14624505928853754 - nodes in this community are weakly interconnected._
- **Why does `Etapa 1 — base segura e verificável (22/10/2026)` connect `Etapa 1 — base segura e verificável (22/10/2026)` to `Registro de implementação`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `receita.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07665505226480836 - nodes in this community are weakly interconnected._