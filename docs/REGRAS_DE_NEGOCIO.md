# Regras de negócio

Regras extraídas da especificação ("Prompt Mestre — CRIEXO Intelligence") e o
local onde cada uma está garantida, mais as decisões aprovadas por Christian
Drager (questionário respondido em 22/10/2026). O que ainda falta decidir está
em `DECISOES_PENDENTES.md`.

Legenda de garantia: **BD** = banco (constraint, função, RLS) · **Domínio** =
`src/domain` · **UI** = apenas apresentação.

| Regra | Resumo | Onde é garantida | Situação |
|-------|--------|------------------|----------|
| RN-01 | O sistema busca **clientes** potenciais, não fornecedores | Modelo de dados (`companies` = empresas-alvo) | Estrutura pronta |
| RN-02 | Pesquisa por segmento ou por produto | BD: enum `research_type` | Estrutura pronta; fluxo não implementado |
| RN-03 | A IA sugere, Christian decide; aprovação individual; aprovar ≠ fabricação garantida | BD: `decide_product_idea()` grava decisão + histórico; colunas de decisão não podem ser alteradas diretamente; constraint de consistência | Implementado no BD e testado |
| RN-04 | Região a partir do Costa e Silva com raio em km | BD: `system_settings` validado; Domínio: `evaluateProximity` retorna "desconhecido" sem ponto/raio; tela de Configurações | Implementado e testado; endereço e raio aprovados, coordenadas pendentes (DP-22) |
| RN-05 | Capacidade informada manualmente; sem dados = incerteza | BD: `production_settings` (versionada, somente inclusão); Domínio: `productionSettingsSchema`; tela de Configurações | Implementado e testado; avaliador de viabilidade depende dos requisitos das ideias (etapa 5) |
| RN-06 | Fontes combinadas, origem preservada, deduplicação | BD: `company_sources`, índice único por (fonte, id do registro), `field_provenance`; Domínio: normalização | Normalização implementada e testada; adaptadores pendentes |
| RN-07 | 5 a 10 empresas por pesquisa, sem completar com irrelevantes | — | Pendente (fluxo de descoberta) |
| RN-08 | Pontuação automática explicável, critérios e pesos configuráveis e versionados | BD: `scoring_configs` imutável, uma versão ativa; `opportunity_scores` + `score_breakdowns` somente inclusão; Domínio: `computeScore` | Motor implementado e testado; v2 **aprovada** e ativa |
| RN-09 | Proximidade não compensa incompatibilidade nem inviabilidade | Domínio: proximidade anulada se compatibilidade < 40; teto 39 para critério bloqueante | Implementado, testado e aprovado |
| RN-10 | Dados persistem após novo login; falhas de integração não apagam registros | BD: sem políticas de DELETE para nenhum papel da API | Implementado e testado |
| RN-11 | Histórico de status, decisões e versões de pontuação | BD: `change_opportunity_status()`, `set_opportunity_saved()`, `decide_product_idea()`, histórico de `system_settings` por trigger; históricos sem UPDATE/DELETE | Implementado e testado |
| RN-12 | Distinguir confirmada / declarada pela fonte / inferência da IA / desconhecida / desatualizada | BD: enum `information_status`; Domínio: cada evidência carrega o status; critério mostra o status mais fraco | Implementado e testado |

## Decisões aprovadas — Christian Drager, 22/10/2026

| DP | Decisão | Onde está aplicada |
|----|---------|--------------------|
| DP-01 | Distância medida a partir do endereço da impressora: **Rua Landman, 147, Joinville–SC** | Inserir em Configurações → Região |
| DP-02 | Raio de atuação: **10 km** | Inserir em Configurações → Região |
| DP-03 | Capacidade: Bambu A1 Mini, área 18 × 18 × 18 cm, peças maiores possíveis em módulos com encaixe, material PLA, prazo padrão de 3 dias (projetos do zero avaliados caso a caso), modelagem só de peças simples. Peças pequenas por dia: 32 (impressão < 1 h), 16 (1–5 h), 12 (≥ 5 h); acima do limite de peça pequena, uma por vez | Inserir em Configurações → Capacidade (ver DP-26) |
| DP-04 | Pesos 30/30/20/20 aprovados | `scoring_configs` v2 (`approved`) |
| DP-18 | Logotipo enviado por WhatsApp (imagem de 180 × 205 px) | Símbolo extraído e aplicado no menu e no ícone da aba; arquivo original ainda pedido |
| DP-22 | Coordenadas do ponto de referência: **-26.28300, -48.877018** (Joinville–SC) | Inserir em Configurações → Região |
| DP-23 | "Peça pequena" = até **8 cm em cada lado** | Capacidade → limite 8, unidade "cm em cada lado" |
| DP-24 | As faixas de tempo de impressão são **por peça** | Capacidade → "por peça" |
| DP-26 | Peças pequenas são impressas **várias juntas na mesma mesa**; as quantidades por dia (32 / 16 / 12) já consideram isso e valem diretamente como capacidade diária para cada faixa de tempo | Capacidade → "Várias peças pequenas são impressas juntas na mesma mesa" |
| DP-25 | A impressora fica ligada **só no horário de trabalho, das 08:00 às 17:30 (≈ 9,5 h por dia)**; parte desse tempo às vezes vai para testes de treino. As **30 h por semana** são tempo de trabalho do Christian (preparar, acabar, atender, entregar), não tempo de impressora | Capacidade → "Horas de trabalho por semana" = 30, "A impressora fica ligada" = só no horário de trabalho, "Horas por dia com a impressora ligada" = 9,5; testes de treino nas observações |
| DP-05 | Estrelas 0–19…80–100 aprovadas | `scoring_configs` v2 |
| DP-06 | Qualificada a partir de **60** (4 estrelas) | `scoring_configs` v2 |
| DP-07 | Dados ausentes: nota sobre o que é conhecido + aviso + faixa | Motor de pontuação |
| DP-08 | Proximidade linear dentro do raio, zero fora | `evaluateProximity` |
| DP-09 | Endereço não confirmado: proximidade máxima 75 | `scoring_configs` v2 |
| DP-10 | Compatibilidade < 40 anula a proximidade | `scoring_configs` v2 |
| DP-11 | Peça inviável: nota máxima 39 | `scoring_configs` v2 |
| DP-12 | Confiança separada, com fatores e 180 dias para "desatualizada" | `scoring_configs` v2 |
| DP-13 | Christian e Vinicius são **administradores** | Papel `admin` para os dois ao liberar os usuários |
| DP-14 | Christian e Vinicius aprovam ideias | `decide_product_idea` já aceita qualquer membro ativo |
| DP-17 | O sistema **não envia** mensagens; contatos são feitos e registrados manualmente | Nenhuma integração de envio |
| DP-19 | Apenas tema escuro | Sem preferência de tema |
| DP-20 | Etapas do funil aprovadas | `commercial_statuses` |
| DP-21 | Plano gratuito do Supabase no início | README → Limitações |

## Estratégia de pontuação implementada (aprovada — DP-04 a DP-12)

1. Cada critério (compatibilidade, viabilidade, proximidade, potencial
   comercial) chega ao motor como **avaliado** (nota 0–100 + evidências) ou
   **desconhecido** (lista do que falta).
2. **Dado ausente não vira zero.** A nota é a média ponderada dos critérios
   avaliados, normalizada pelo peso avaliado (`coverage`). Para não esconder a
   incerteza, o resultado traz a **faixa possível** `[scoreMin, scoreMax]`,
   assumindo os critérios desconhecidos como 0 e como 100, e a marca
   `incomplete`.
3. Sem nenhum critério avaliado, a nota é `null` (`insufficient_data`).
4. **Proximidade** só conta se a compatibilidade avaliada for ≥ mínimo
   configurado; se a compatibilidade for desconhecida, o mínimo da faixa não
   conta com a proximidade.
5. Localização não confirmada nunca recebe a nota máxima de proximidade.
6. Critério **bloqueante** (ex.: inviável com a capacidade cadastrada) limita a
   nota final ao teto configurado.
7. **Estrelas** vêm dos intervalos da versão de configuração.
8. **Qualificação** só existe com nota mínima configurada; com dados
   incompletos ela é "inconclusiva" a menos que até o mínimo da faixa supere a
   nota de corte.
9. **Confiança** é separada da nota: média ponderada da qualidade das
   evidências (fator por tipo × penalidade para evidência antiga ou sem data).
   Critério desconhecido contribui com zero. Não representa probabilidade de
   compra.
10. O cálculo é puro e determinístico: a data de avaliação é um parâmetro.
