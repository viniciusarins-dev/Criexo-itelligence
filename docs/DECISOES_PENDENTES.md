# Decisões pendentes

Decisões de negócio ou de produto que **não foram tomadas** e que o sistema
não pode inventar. Enquanto estiverem pendentes, a interface mostra o estado
"configuração pendente" ou trata o dado como desconhecido.

As decisões já tomadas (DP-01 a DP-26, exceto DP-18) estão em
`REGRAS_DE_NEGOCIO.md`.

## Em aberto

| # | Decisão | Por que importa | Situação |
|---|---------|-----------------|----------|
| DP-18 | **Arquivo original do logotipo** (SVG ou PNG transparente, alta resolução) | A imagem recebida tem 180 × 205 px: serve para o símbolo pequeno do menu, não para tamanhos maiores | Símbolo extraído da imagem em uso; trocar quando o original chegar |

## Ações necessárias (não são decisões)

| # | Ação | Responsável |
|---|------|-------------|
| A-01 | Criar conta na plataforma de API da OpenAI (platform.openai.com), sem cadastrar cartão, e verificar se a API funciona sem saldo | Vinicius |
| A-02 | Se A-01 não funcionar sem pagar: criar chave gratuita no Google AI Studio para o Gemini | Vinicius |
| A-03 | Permitir no ambiente de desenvolvimento o acesso a `overpass-api.de`, `brasilapi.com.br` e ao provedor de IA escolhido, para testar as integrações de verdade | Vinicius |
