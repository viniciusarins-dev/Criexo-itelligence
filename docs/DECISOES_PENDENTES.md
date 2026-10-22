# Decisões pendentes

Decisões de negócio ou de produto que **não foram tomadas** e que o sistema
não pode inventar. Enquanto estiverem pendentes, a interface mostra o estado
"configuração pendente" ou trata o dado como desconhecido.

Quando uma decisão for tomada, mova-a para `REGRAS_DE_NEGOCIO.md` com a data
e o responsável.

| # | Decisão | Por que importa | Como o sistema se comporta hoje |
|---|---------|-----------------|---------------------------------|
| DP-01 | **Ponto de referência geográfico** (endereço ou coordenadas no Costa e Silva, Joinville–SC) | Base do cálculo de distância (RN-04) | Proximidade fica "desconhecida" em toda avaliação |
| DP-02 | **Raio inicial em km** | Define o que conta como região atendida | Idem: sem raio, não há nota de proximidade |
| DP-03 | **Limites de capacidade produtiva** (volume de impressão, tamanho máximo de peça, materiais, prazo, quantidade por pedido...) | Viabilidade de atendimento (RN-05) | Ainda não há formulário; viabilidade é sempre "incerta" |
| DP-04 | **Pesos dos critérios de pontuação** | Proposta 30/30/20/20 ainda não aprovada (RN-08) | Versão 1 gravada como `proposal`; o dashboard avisa |
| DP-05 | **Intervalos de estrelas** | Conversão provisória 0–19…80–100 (seção 6.6) | Usada como proposta, marcada como não aprovada |
| DP-06 | **Nota mínima de qualificação** | Define "oportunidade qualificada" | `null`: o indicador "Qualificadas" mostra "Nota mínima não configurada" |
| DP-07 | **Estratégia para dados ausentes** | Proposta: normalizar sobre critérios avaliados + faixa mín/máx (ver `REGRAS_DE_NEGOCIO.md`, RN-08) | Implementada como proposta; precisa de validação |
| DP-08 | **Curva de proximidade** | Proposta: decaimento linear dentro do raio, 0 fora | Implementada como proposta (`linear_within_radius`) |
| DP-09 | **Teto de proximidade para localização não confirmada** | Proposta: 75 | Valor proposto na configuração v1 |
| DP-10 | **Regra "proximidade exige compatibilidade"** | Proposta: compatibilidade < 40 anula a proximidade (RN-09) | Valor proposto na configuração v1 |
| DP-11 | **Teto quando um critério é bloqueante** (ex.: fabricação inviável) | Proposta: 39 (máx. 2 estrelas) | Valor proposto na configuração v1 |
| DP-12 | **Parâmetros de confiança** (fatores por tipo de evidência, 180 dias para "desatualizada", limites baixa/média/alta 40/70) | Indicador de confiança (seção 6.7) | Valores propostos na configuração v1 |
| DP-13 | **Permissões entre Christian e o desenvolvedor/operador** | Seção 9: não conceder privilégios indiscriminadamente | Dois papéis: `admin` (altera configurações e libera usuários) e `member`. Quem será admin está em aberto. Dados são compartilhados entre membros ativos |
| DP-14 | **Quem pode aprovar ideias de produto** | RN-03 diz "Christian decide" | Hoje qualquer membro ativo aprova; a decisão fica registrada com o responsável. Restringir a um papel é uma mudança de uma linha na função `decide_product_idea` |
| DP-15 | **Fontes de dados empresariais** | RN-06, seção 7 | Nenhuma integrada. Ver candidatas em `DIAGNOSTICO_E_PLANO.md` §6 |
| DP-16 | **Provedor de IA e limite de consumo** | Seção 7 (IA) | Nenhum integrado |
| DP-17 | **Envio de mensagens a empresas** | Seção 4.5: fora do escopo sem decisão explícita | Não implementado |
| DP-18 | **Arquivo oficial do logotipo (SVG)** | Identidade visual | Usado símbolo geométrico provisório + logotipo tipográfico |
| DP-19 | **Modo claro** | "Preferências de interface" (seção 4.9) | Apenas tema escuro |
| DP-20 | **Status do pipeline** | Seção 4.6: lista sugerida, configurável depois | Os 7 status sugeridos estão cadastrados na tabela `commercial_statuses` |
| DP-21 | **Estratégia de backup** | Seção 9 | Depende do plano do Supabase escolhido (o plano gratuito tem limitações de backup — verificar no momento da contratação) |
