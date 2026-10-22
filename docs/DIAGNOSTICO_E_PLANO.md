# Diagnóstico, arquitetura e plano

## 1. Diagnóstico inicial (22/10/2026)

- O repositório `Criexo-itelligence` estava **vazio** (nenhum commit, nenhum
  arquivo). Não havia trabalho existente a preservar.
- Ferramentas disponíveis no ambiente de desenvolvimento: Node 22, npm,
  PostgreSQL 16 local, Go, Chromium. Sem Docker.
- O registro de componentes do shadcn/ui (`ui.shadcn.com`) está bloqueado pela
  rede do ambiente. Os componentes foram escritos à mão seguindo o mesmo padrão
  (Radix UI + `class-variance-authority` + `tailwind-merge`), o que é
  exatamente o que o CLI do shadcn copiaria para o projeto.

## 2. Arquitetura

```
Navegador ──► Next.js 16 (App Router, Server Components por padrão)
               │  src/proxy.ts            renova sessão, redireciona sem sessão
               │  src/lib/auth            camada de acesso (requireActiveMember)
               │  src/server/repositories consultas com o cliente do usuário
               │  src/domain              regras puras (pontuação, normalização)
               ▼
            Supabase: Auth + PostgREST + PostgreSQL
               RLS em todas as tabelas · funções com histórico · migrations
```

Princípios:

- **Todo acesso a dados usa a sessão do usuário** (chave publicável + RLS).
  A `service_role` key não é usada pela aplicação.
- **Autorização em duas camadas**: o servidor verifica o perfil ativo antes de
  renderizar; o banco recusa qualquer acesso de usuário inativo ou anônimo.
- **Regras de negócio fora dos componentes**: `src/domain` não importa React,
  Next ou Supabase e é testado isoladamente.
- **Histórico garantido pelo banco**: status comercial, decisões de ideias e
  "salvar" só mudam por funções que gravam o histórico na mesma transação.
- **Integrações por adaptadores** (próximas etapas): `src/server/integrations/<fonte>`
  com interface comum, limites de consumo e registro em `research_source_runs`.
- **Cache Components desativado**: todas as telas dependem da sessão e de dados
  sob RLS; renderização por requisição evita cachear dados de um usuário.

Estrutura atual de `src/`:

```
app/                 rotas (login, acesso-pendente, configuracao-pendente, (app)/dashboard)
components/ui        design system (button, input, badge, card, table, dropdown, skeleton…)
components/layout    sidebar, navegação móvel, cabeçalho, menu do usuário
components/states    estados vazios, avisos, cabeçalho de página
components/dashboard seções do dashboard
domain/scoring       motor de pontuação versionado + proximidade + estrelas
domain/rules         normalização para deduplicação
domain/types         tipos de domínio (natureza da informação)
lib/                 env, supabase, auth, validação, formatação, rótulos
server/repositories  acesso a dados no servidor
```

## 3. Modelo de dados (resumo)

Revisão do modelo sugerido na especificação:

- `profiles` ganhou `is_active` (liberação explícita por administrador).
- `product_ideas` usa `decided_by/decided_at` (vale para aprovação e rejeição)
  e ganhou `product_idea_decisions` (histórico).
- `opportunities` é única por (empresa, ideia); a pontuação vigente é copiada
  para ordenação e o histórico completo fica em `opportunity_scores` +
  `score_breakdowns`.
- `commercial_statuses` torna o pipeline configurável.
- `scoring_configs` versiona a configuração de pontuação (imutável).
- `research_source_runs` registra o resultado de cada fonte em cada pesquisa.
- `system_settings_history` registra toda alteração de configuração.
- `companies` ganhou `cnpj` (identificador confiável), campos normalizados
  para deduplicação e `field_provenance` (RN-12).

## 4. Plano incremental

| Etapa | Conteúdo | Situação |
|-------|----------|----------|
| 1 | Estrutura, design system, layout, autenticação, migrations + RLS, motor de pontuação, dashboard, testes | **Concluída** |
| 2 | Configurações: ponto de referência, raio, capacidade produtiva, usuários autorizados, visualização da configuração de pontuação | **Concluída** |
| 3 | Empresas: tabela com busca/filtros/paginação, cadastro e edição manuais, detalhes com fontes e evidências | Próxima |
| 4 | Oportunidades e pipeline: salvar, status, observações, contatos, colunas + tabela, histórico | |
| 5 | Nova prospecção (fluxo guiado) + Produtos e ideias com aprovação individual e detecção de duplicidade | |
| 6 | Integrações reais: provedor de IA (interface trocável), fontes empresariais, geocodificação — após validar termos e limites | |
| 7 | Deduplicação com revisão humana, pesquisas anteriores e reexecução, relatórios, exportação CSV | |
| 8 | Revisão de acessibilidade, segurança, desempenho; implantação | |

## 5. Riscos técnicos e dependências externas

| Risco | Mitigação |
|-------|-----------|
| Fontes de dados empresariais gratuitas com cobertura limitada no bairro | Combinar fontes (RN-06), documentar a limitação, permitir cadastro manual |
| Termos de uso restringindo automação ou armazenamento | Verificar termos antes de cada integração; nenhum scraping |
| Limites de plano gratuito (Supabase, IA, mapas) | Limites de consumo por configuração; registrar falhas em `research_source_runs` |
| IA apresentando inferência como fato | Toda evidência carrega `information_status`; inferência da IA tem fator de confiança baixo |
| Dados pessoais (MEI, telefones pessoais) — LGPD | Priorizar dados comerciais públicos; não coletar contatos pessoais; campo de proveniência |
| Migrations futuras esquecerem de restringir privilégios | Comentário de alerta na migration inicial; testes de RLS como rede de segurança |
| Pausa do projeto Supabase gratuito por inatividade | Documentado no README |

## 6. Fontes de dados e IA — decisão sem custo (DP-15, DP-16, 22/10/2026)

Pesquisa feita em 22/10/2026 nas páginas oficiais. Os serviços não puderam ser
testados porque a rede do ambiente de desenvolvimento os bloqueia (ação A-03).

### Busca de empresas

| Fonte | Papel | Custo | Condições e riscos |
|-------|-------|-------|--------------------|
| **OpenStreetMap (Overpass API)** | Principal: encontra estabelecimentos por raio a partir do ponto de referência, já com coordenadas | Gratuito, sem cadastro | Instância pública: uso baixo (a política do wiki fala em menos de 10.000 consultas/dia, dividido por 100 para uso regular) e recomenda servidor próprio ou pago para uso comercial. Exige atribuição "© colaboradores do OpenStreetMap" (licença ODbL). **Cobertura de pequenos negócios do bairro ainda não medida.** |
| **Dados abertos do CNPJ (Receita Federal)** | Complemento: empresas formais de Joinville por atividade (CNAE) e situação cadastral | Gratuito | Arquivos mensais grandes (~100 GB compactados para o Brasil todo); importação filtrada por município, fora do app. Sem coordenadas. Contém dados pessoais de MEIs: guardar só o necessário (LGPD). CNPJ alfanumérico para novos cadastros desde 07/2026 (o validador atual aceita só dígitos e precisa ser atualizado). |
| **BrasilAPI (consulta por CNPJ)** | Enriquecimento: completa dados de um CNPJ já conhecido | Gratuito | Não encontra empresas novas; depende de serviço comunitário. |
| Google Places | Descartado por enquanto | Tem uso gratuito mensal, mas exige conta de faturamento com cartão | Reavaliar se houver orçamento. |
| Cadastro manual | Sempre disponível | — | — |

### Inteligência artificial

| Opção | Situação | Condições |
|-------|----------|-----------|
| **OpenAI (preferência)** | A API é cobrada separadamente da assinatura do ChatGPT. A documentação oficial cita um nível "Free" por região, mas há relatos de exigência de saldo. **Confirmar criando uma conta sem cartão (A-01).** | Se exigir pagamento, fica para quando houver orçamento. |
| **Gemini (plano gratuito)** | Alternativa sem custo. | No plano gratuito, o Google **usa o conteúdo enviado para melhorar seus produtos**: enviar só segmento, produto e dados comerciais públicos das empresas, nunca dados pessoais ou confidenciais. Os limites do plano gratuito mudam sem aviso. |

A camada de IA terá uma interface única, com limite de consumo configurável,
para trocar de provedor sem mudar o resto do sistema.

### Fontes consultadas
- OpenAI — limites e níveis de uso: https://developers.openai.com/api/docs/guides/rate-limits
- OpenAI — cobrança separada do ChatGPT: https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform
- Gemini — preços e plano gratuito: https://ai.google.dev/gemini-api/docs/pricing
- Gemini — termos adicionais: https://ai.google.dev/gemini-api/terms_preview
- Overpass API — política de uso: https://wiki.openstreetmap.org/wiki/Overpass_API
