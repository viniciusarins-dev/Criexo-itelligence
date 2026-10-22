# Decisões pendentes

Decisões de negócio ou de produto que **não foram tomadas** e que o sistema
não pode inventar. Enquanto estiverem pendentes, a interface mostra o estado
"configuração pendente" ou trata o dado como desconhecido.

As decisões já tomadas (DP-01 a DP-14, DP-17 a DP-25, respondidas por
Christian em 22/10/2026) estão em `REGRAS_DE_NEGOCIO.md`.

## Em aberto

| # | Decisão | Por que importa | Situação |
|---|---------|-----------------|----------|
| DP-15 | **Fontes de dados empresariais** e orçamento | RN-06, seção 7 | Christian quer ver opções e preços antes. Levantamento a fazer (ver `DIAGNOSTICO_E_PLANO.md` §6) |
| DP-16 | **Provedor de IA** e orçamento | Sugestões de produtos | Idem |
| DP-18 | **Arquivo original do logotipo** (SVG ou PNG transparente, alta resolução) | A imagem recebida tem 180 × 205 px: serve para o símbolo pequeno do menu, não para tamanhos maiores | Símbolo extraído da imagem em uso; trocar quando o original chegar |

## Inconsistência a esclarecer

| # | Pergunta | Por que importa | Como o sistema trata hoje |
|---|----------|-----------------|---------------------------|
| DP-26 | As quantidades por dia não fecham com o tempo **por peça** (DP-24): mesmo com a impressora ligada ≈ 9,5 h por dia (08:00–17:30), 12 peças de 5 h ou mais exigiriam 60 h, e 16 peças de 1 a 5 h, pelo menos 16 h. **As quantidades por dia valem para várias peças impressas juntas na mesma mesa?** | Sem isso, o sistema poderia prometer prazos impossíveis | Os números ficam guardados como informados, mas não serão usados para calcular prazos até a resposta |
