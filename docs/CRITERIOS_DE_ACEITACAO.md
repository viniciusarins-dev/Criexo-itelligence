# Critérios de aceitação — MVP

Situação em 23/10/2026 (fim da etapa 8). "Verificado" = coberto por teste
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
- ✅ Erros de integração comunicados — falha do OpenStreetMap registrada na execução e avisada, base interna continua (E2E com servidor simulado); adaptadores com erros traduzidos (unitário)

## Aprovação
- 🟡 IA gera sugestões quando configurada — adaptador Gemini, validação da resposta e limite diário testados com respostas simuladas; sem chamada real (rede bloqueada, A-02/A-03). Sem configuração, aparece "não configurada" (E2E)
- ✅ Aprovação individual na interface, com aviso de ideia parecida — E2E
- ✅ Busca só começa sem ideias pendentes e com ao menos uma aprovada — E2E + unitário
- ✅ Aprovação/rejeição individual (BD) — integração `decisão de ideia…`
- ✅ Aprovação persistida com usuário responsável (BD) — idem

## Descoberta
- 🟡 Fontes consultadas de verdade — base interna e OpenStreetMap integrados e testados contra servidor simulado (E2E); chamada às instâncias reais pendente (rede bloqueada, A-03)
- ✅ Resultado parcial avisado (menos de 5 empresas), sem completar com irrelevantes — E2E + unitário
- ✅ Resultados normalizados — conversão do OpenStreetMap e da BrasilAPI para o formato do cadastro (unitário)
- ✅ Origem registrada — origem por campo e registro da fonte para cadastro manual, OpenStreetMap, BrasilAPI e Nominatim (E2E)
- ✅ Duplicidades tratadas — coincidências vão para a fila de revisão; "mesma empresa" liga o registro e só completa campos vazios, "empresas diferentes" cadastra a nova; decisão com responsável e histórico (E2E + integração)
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

## Fontes e pontuação (etapa 6)
- ✅ Busca no OpenStreetMap pelo raio, com limite diário e atribuição — E2E (servidor simulado) + unitário
- ✅ Empresa nova cadastrada com origem; nova execução reaproveita o mesmo registro — E2E
- ✅ BrasilAPI e Nominatim só completam campos vazios; sem telefone/e-mail nem razão social de MEI — E2E + unitário
- ✅ Pontuação gravada a cada busca, com histórico; proximidade pela distância; critérios sem avaliação ficam desconhecidos — E2E + unitário
- 🟡 Avaliação da IA dos critérios de julgamento — lógica e validação testadas (unitário); sem chamada real (falta a chave, A-02)

## Revisão, relatórios e importação (etapa 7)
- ✅ Fila de possíveis duplicidades com comparação lado a lado e decisão registrada — E2E + integração
- ✅ Confirmação humana da localização e recálculo da pontuação com registro no histórico — E2E + integração
- ✅ Relatórios por período (funil, estrelas, segmentos, produtos, pesquisas, fontes) — E2E + unitário
- ✅ Exportação CSV de oportunidades e empresas, só com sessão, protegida contra fórmulas — E2E + unitário
- ✅ Importação dos dados abertos do CNPJ: só ativos do município, com nome fantasia, sem telefone/e-mail; CNPJ existente ignorado; nome igual vai para revisão — unitário + execução manual com arquivos fictícios
- ✅ Nenhuma área "Em desenvolvimento" restante na navegação — E2E

## Acessibilidade, segurança e implantação (etapa 8)
- ✅ Todas as telas sem violações WCAG 2.1 A/AA no axe, em desktop e celular — E2E
- ✅ Login e atalho "Pular para o conteúdo" só pelo teclado — E2E
- ✅ CSP com nonce por requisição, sem bloqueios nas telas; demais cabeçalhos de segurança — E2E + unitário
- ✅ Redirecionamento após o login sem saída para outros sites — unitário
- ✅ Invariantes de segurança do banco (RLS, `anon`, `search_path`, sem DELETE) — integração
- ✅ Dependências de produção sem vulnerabilidades conhecidas (`npm audit`)
- 🟡 CI no GitHub — criada; a parte com banco não pôde ser executada aqui (sem Docker): conferir na primeira execução
- ⬜ Publicação em produção — guia pronto (`docs/IMPLANTACAO.md`); depende das contas Supabase/Vercel da CRIEXO
- ⬜ Revisão manual com leitor de tela (NVDA/VoiceOver) — recomendada antes do uso diário
