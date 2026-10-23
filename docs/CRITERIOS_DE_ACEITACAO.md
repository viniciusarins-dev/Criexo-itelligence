# Critérios de aceitação — MVP

Situação em 23/10/2026 (fim da etapa 3). "Verificado" = coberto por teste
automatizado executado nesta etapa.

Legenda: ✅ verificado · 🟡 parcial · ⬜ não iniciado

## Autenticação
- ✅ Usuário autorizado consegue entrar — E2E `membro ativo entra…`
- ✅ Usuário não autorizado não acessa dados internos — E2E `usuário inativo…` + integração RLS
- ✅ Sessões e permissões verificadas no servidor — `requireActiveMember()` + RLS em todas as tabelas

## Pesquisa
- 🟡 Criar pesquisa por segmento ou produto — tabela, validações de BD e RLS prontas; fluxo de interface pendente
- ⬜ Parâmetros validados no cliente e no servidor (Zod)
- 🟡 Histórico da pesquisa — `research_sessions` e `research_source_runs` prontos
- ⬜ Erros de integração comunicados

## Aprovação
- ⬜ IA gera sugestões quando configurada
- ✅ Aprovação/rejeição individual (BD) — integração `decisão de ideia…`
- ✅ Aprovação persistida com usuário responsável (BD) — idem

## Descoberta
- ⬜ Fontes configuradas consultadas de verdade
- 🟡 Resultados normalizados — funções de normalização testadas; adaptadores pendentes
- 🟡 Origem registrada — origem por campo no cadastro manual (E2E); `company_sources` pronto para as fontes
- 🟡 Duplicidades tratadas — cadastro manual: CNPJ igual bloqueado, coincidências sinalizadas para revisão humana (E2E); falta para dados vindos das fontes
- ✅ Dados ausentes não são inventados (motor de pontuação e proximidade) — testes unitários

## Pontuação
- ✅ Determinística para mesma entrada e versão — teste unitário
- ✅ Critérios e pesos consultáveis — Configurações → Pontuação (E2E)
- ✅ Estrelas conforme intervalos configurados — teste unitário
- ✅ Confiança separada — teste unitário
- ✅ Dados insuficientes sinalizados — teste unitário; dashboard mostra "dados incompletos"

## Gestão comercial
- 🟡 Salvar empresa/oportunidade — `set_opportunity_saved()` testada; interface pendente
- 🟡 Registrar observações — BD testado; interface pendente
- 🟡 Atualizar status — `change_opportunity_status()` testada; interface pendente
- ✅ Histórico permanece disponível (sem UPDATE/DELETE) — integração
- ✅ Alterações persistidas no banco — integração

## Interface
- 🟡 Páginas principais em desktop e celular — login, dashboard, configurações e acesso pendente verificados em 1440px e Pixel 7 (sem rolagem horizontal); demais telas pendentes
- ✅ Identidade visual consistente — tokens semânticos em `globals.css`
- ✅ Estados de carregamento, erro e lista vazia — dashboard
- ✅ Nenhum botão aparenta funcionar sem executar ação — áreas não implementadas aparecem como "Em desenvolvimento", não navegáveis

## Qualidade
- ✅ TypeScript sem erros (`npm run typecheck`)
- ✅ Lint passa (`npm run lint`)
- ✅ Regras principais com testes unitários (pontuação, proximidade, estrelas, normalização)
- ✅ Fluxos críticos com integração/E2E (RLS, histórico, login, logout, acesso negado)
- ✅ Migrations versionadas (`supabase/migrations`)
- ✅ Documentação de configuração e execução (README)

## Configurações (etapa 2)
- ✅ Região: somente administradores editam; validação no servidor e no banco — E2E + integração
- ✅ Capacidade produtiva versionada; campos ausentes tratados como "a confirmar" — E2E + unitário + integração
- ✅ Equipe: liberar/bloquear com confirmação; sem alterar o próprio acesso — E2E + integração
- ✅ Histórico de alterações de configuração — integração

## Empresas (etapa 3)
- ✅ Tabela com busca, filtros, ordenação e paginação — E2E
- ✅ Cadastro e edição com validação no servidor e valores preservados após erro — E2E + unitário
- ✅ Detalhes com origem de cada informação, distância e mapa — E2E
- ✅ Duplicidade sinalizada, sem união automática — E2E + unitário
- ✅ Funciona no celular sem rolagem horizontal — E2E
