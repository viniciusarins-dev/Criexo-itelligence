# Decisões pendentes

Decisões de negócio ou de produto que **não foram tomadas** e que o sistema
não pode inventar. Enquanto estiverem pendentes, a interface mostra o estado
"configuração pendente" ou trata o dado como desconhecido.

As decisões já tomadas (DP-01 a DP-14, DP-17, DP-19 a DP-21, respondidas por
Christian em 22/10/2026) estão em `REGRAS_DE_NEGOCIO.md`.

## Em aberto

| # | Decisão | Por que importa | Situação |
|---|---------|-----------------|----------|
| DP-15 | **Fontes de dados empresariais** e orçamento | RN-06, seção 7 | Christian quer ver opções e preços antes. Levantamento a fazer (ver `DIAGNOSTICO_E_PLANO.md` §6) |
| DP-16 | **Provedor de IA** e orçamento | Sugestões de produtos | Idem |
| DP-18 | **Arquivo oficial do logotipo** (SVG ou PNG transparente) | Identidade visual | Christian vai enviar |

## Esclarecimentos sobre as respostas de 22/10/2026

| # | Pergunta | Por que importa | Como o sistema trata hoje |
|---|----------|-----------------|---------------------------|
| DP-22 | **Coordenadas da Rua Landman, 147** — confirmar cidade (Joinville–SC) e copiar as coordenadas do ponto no Google Maps | A distância é calculada a partir de coordenadas; o sistema não adivinha a localização de um endereço | Região fica "pendente" até alguém salvar endereço + coordenadas em Configurações |
| DP-23 | "Até **8cm³**": significa **8 cm em cada lado** (peça de até 8 × 8 × 8 cm) ou **8 cm³ de volume** (um cubo de 2 cm)? | Define o que é "peça pequena" nas regras de produção diária | Valor 8 guardado com unidade "a confirmar" |
| DP-24 | As faixas "menos de 1 h / 1–5 h / 5 h ou mais" são o tempo **de cada peça** ou **de uma mesa de impressão** (lote)? | Muda completamente o cálculo de quantas peças cabem em um prazo | Guardado como "a confirmar" |
| DP-25 | "Peças por dia" considera quantas horas de impressora ligada por dia? Como isso se relaciona com as **30 h por semana**? | Evita prometer volume que não cabe na semana | Os dois valores ficam registrados; nenhum cálculo combina os dois ainda |
