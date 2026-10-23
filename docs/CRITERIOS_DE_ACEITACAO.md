# Critérios de aceitação — MVP

Situação em 23/10/2026 (fim da etapa 5). "Verificado" = coberto por teste
automatizado executado nesta etapa.

Legenda: ✅ verificado · 🟡 parcial · ⬜ não iniciado

## Autenticação
- ✅ Usuário autorizado consegue entrar — E2E `membro ativo entra…`
- ✅ Usuário não autorizado não acessa dados internos — E2E `usuário inativo…` + integração RLS
- ✅ Sessões e permissões verificadas no servidor — `requireActiveMember()` + RLS em todas as tabelas

## Pesquisa
- ✅ Criar pesquisa por segmento ou produto, com cópia das configurações usadas — E2E `pesquisa guiada…`
- ✅ Parâmetros validados no cliente e no servidor (Zod) — E2E + unitário
- ✅ Histórico da pesquisa: pesquisas anteriores e nova execução sem apagar a anterior — E2E + integração
- 🟡 Erros de integração comunicados — busca e IA registram falhas e mostram aviso (unitário do adaptador Gemini); fontes externas pendentes

## Aprovação
- 🟡 IA gera sugestões quando configurada — adaptador Gemini, validação da resposta e limite diário testados com respostas simuladas; sem chamada real (rede bloqueada, A-02/A-03). Sem configuração, aparece "não configurada" (E2E)
- ✅ Aprovação individual na interface, com aviso de ideia parecida — E2E
- ✅ Busca só começa sem ideias pendentes e com ao menos uma aprovada — E2E + unitário
- ✅ Aprovação/rejeição individual (BD) — integração `decisão de ideia…`
- ✅ Aprovação persistida com usuário responsável (BD) — idem

## Descoberta
- 🟡 Fontes consultadas de verdade — base interna (E2E); fontes externas na etapa 6
- ✅ Resultado parcial avisado (menos de 5 empresas), sem completar com irrelevantes — E2E + unitário
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
- ✅ Salvar oportunidade — E2E + integração
- ✅ Registrar observações e contatos — E2E
- ✅ Atualizar status, descartar (com confirmação) e reabrir — E2E + integração
- ✅ Histórico permanece disponível (sem UPDATE/DELETE) — integração
- ✅ Alterações persistidas no banco — integração

## Interface
- ✅ Páginas principais em desktop e celular — todas as telas implementadas verificadas em 1440px e Pixel 7 (sem rolagem horizontal)
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

## Oportunidades e pipeline (etapa 4)
- ✅ Pipeline em colunas e em tabela; mudanças atualizam o banco e o histórico — E2E
- ✅ Oportunidade salva ≠ contatada ≠ convertida — E2E
- ✅ Sem rolagem horizontal da página no pipeline, lista e detalhes — E2E

## Prospecção e ideias (etapa 5)
- ✅ Fluxo guiado: parâmetros → ideias → aprovação → busca — E2E
- ✅ Ideias manuais com premissas marcadas como "declaradas", não confirmadas — E2E
- ✅ Decisão (e revisão da decisão) com responsável e histórico — E2E + integração
- ✅ Oportunidade por empresa × ideia aprovada, reaproveitada em novas execuções — E2E
- ✅ Resultados e uso da IA: somente inclusão, nada para anônimos ou inativos — integração
