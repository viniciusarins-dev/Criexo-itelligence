# Decisões pendentes

Decisões de negócio ou de produto que **não foram tomadas** e que o sistema
não pode inventar. Enquanto estiverem pendentes, a interface mostra o estado
"configuração pendente" ou trata o dado como desconhecido.

As decisões já tomadas (DP-01 a DP-26, exceto DP-18) estão em
`REGRAS_DE_NEGOCIO.md`.

## Em aberto

| # | Decisão | Por que importa | Situação |
|---|---------|-----------------|----------|
| DP-27 | **Nota com só a proximidade conhecida.** Sem a IA, compatibilidade, viabilidade e potencial ficam desconhecidos. Pela regra aprovada (DP-07), a nota considera só o que é conhecido: uma empresa a 200 m recebe 75/100 e 4 estrelas, com aviso de "dados incompletos" e faixa 0–95. Manter assim, ou não mostrar nota/estrelas até a compatibilidade ser avaliada? | Pode fazer uma empresa só por estar perto parecer prioritária | Comportamento atual = regra aprovada DP-07; aguardando Christian |
| DP-18 | **Arquivo original do logotipo** (SVG ou PNG transparente, alta resolução) | A imagem recebida tem 180 × 205 px: serve para o símbolo pequeno do menu, não para tamanhos maiores | Símbolo extraído da imagem em uso; trocar quando o original chegar |

## Ações necessárias (não são decisões)

| # | Ação | Responsável |
|---|------|-------------|
| A-01 | ~~Verificar se a API da OpenAI funciona sem saldo~~ — **concluída em 23/10/2026: exige créditos.** A chave criada foi exposta no chat e deve ser revogada | Vinicius |
| A-02 | Criar chave gratuita no Google AI Studio para o Gemini e cadastrá-la como segredo do ambiente (nunca no chat ou no código) | Vinicius |
| A-03 | Permitir no ambiente de desenvolvimento o acesso a `overpass-api.de`, `brasilapi.com.br` e `nominatim.openstreetmap.org`, para testar as integrações de verdade. Em 23/10/2026 o Gemini já estava acessível; os três continuavam bloqueados | Vinicius |
