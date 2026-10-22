# Regras de negócio

Regras extraídas da especificação ("Prompt Mestre — CRIEXO Intelligence") e o
local onde cada uma está garantida. Valores numéricos marcados como
**proposta** ainda não foram aprovados — ver `DECISOES_PENDENTES.md`.

Legenda de garantia: **BD** = banco (constraint, função, RLS) · **Domínio** =
`src/domain` · **UI** = apenas apresentação.

| Regra | Resumo | Onde é garantida | Situação |
|-------|--------|------------------|----------|
| RN-01 | O sistema busca **clientes** potenciais, não fornecedores | Modelo de dados (`companies` = empresas-alvo) | Estrutura pronta |
| RN-02 | Pesquisa por segmento ou por produto | BD: enum `research_type` | Estrutura pronta; fluxo não implementado |
| RN-03 | A IA sugere, Christian decide; aprovação individual; aprovar ≠ fabricação garantida | BD: `decide_product_idea()` grava decisão + histórico; colunas de decisão não podem ser alteradas diretamente; constraint de consistência | Implementado no BD e testado |
| RN-04 | Região a partir do Costa e Silva com raio em km; valores não definidos | Domínio: `evaluateProximity` retorna "desconhecido" sem ponto/raio | Implementado e testado; valores pendentes (DP-01, DP-02) |
| RN-05 | Capacidade informada manualmente; sem dados = incerteza | BD: `production_settings` (versionada, somente inclusão) | Estrutura pronta; formulário pendente |
| RN-06 | Fontes combinadas, origem preservada, deduplicação | BD: `company_sources`, índice único por (fonte, id do registro), `field_provenance`; Domínio: normalização | Normalização implementada e testada; adaptadores pendentes |
| RN-07 | 5 a 10 empresas por pesquisa, sem completar com irrelevantes | — | Pendente (fluxo de descoberta) |
| RN-08 | Pontuação automática explicável, critérios e pesos configuráveis e versionados | BD: `scoring_configs` imutável, uma versão ativa; `opportunity_scores` + `score_breakdowns` somente inclusão; Domínio: `computeScore` | Motor implementado e testado; pesos são **proposta** |
| RN-09 | Proximidade não compensa incompatibilidade nem inviabilidade | Domínio: proximidade anulada se compatibilidade < mínimo (**proposta 40**); teto para critério bloqueante (**proposta 39**) | Implementado e testado |
| RN-10 | Dados persistem após novo login; falhas de integração não apagam registros | BD: sem políticas de DELETE para nenhum papel da API | Implementado e testado |
| RN-11 | Histórico de status, decisões e versões de pontuação | BD: `change_opportunity_status()`, `set_opportunity_saved()`, `decide_product_idea()`, histórico de `system_settings` por trigger; históricos sem UPDATE/DELETE | Implementado e testado |
| RN-12 | Distinguir confirmada / declarada pela fonte / inferência da IA / desconhecida / desatualizada | BD: enum `information_status`; Domínio: cada evidência carrega o status; critério mostra o status mais fraco | Implementado e testado |

## Estratégia de pontuação implementada (proposta — DP-04 a DP-12)

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
