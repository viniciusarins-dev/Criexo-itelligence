# Prompt para o Claude Cowork — publicar o CRIEXO Intelligence

Copie o texto abaixo (da linha `---` em diante) e cole numa conversa nova do
Claude Cowork, com o navegador conectado. Você precisa estar logado no
GitHub, no Supabase, na Vercel e no Google AI Studio, ou estar por perto
para fazer login quando ele pedir.

---

Você vai me ajudar a publicar o **CRIEXO Intelligence**, um sistema interno de prospecção comercial (Next.js + Supabase) que já está pronto no GitHub. Trabalhe pelo navegador, uma etapa por vez, e me mostre o resultado de cada uma antes de seguir.

## Contexto

- Repositório: https://github.com/viniciusarins-dev/Criexo-itelligence
- Todo o código está no branch `claude/affectionate-davinci-rt21ln`. O repositório ainda não tem branch `main`.
- O guia oficial do projeto é `docs/IMPLANTACAO.md`, nesse branch. Leia antes de começar e siga-o; se algo aqui divergir dele, me pergunte.
- Tudo no plano gratuito: Supabase (banco e login) e Vercel (aplicação), região São Paulo.

## Regras de segurança (obrigatórias)

1. **Nunca escreva no chat, em arquivos, em issues ou em comentários** nenhuma senha, chave de API, token, senha do banco ou a chave `service_role`. Quando um segredo precisar ir de um site para outro, **pare e me peça para copiar e colar eu mesmo**, dizendo exatamente em qual campo colar.
2. A aplicação só usa a **URL do projeto Supabase** e a **chave publicável** (publishable/anon). A chave `service_role` e a senha do banco **nunca** vão para a Vercel.
3. Nenhuma variável secreta pode começar com `NEXT_PUBLIC_`.
4. **Peça minha confirmação antes de** criar projetos, rodar SQL, mudar configurações de login, fazer deploy, mudar o branch padrão ou apagar qualquer coisa.
5. Quando aparecer login, verificação em duas etapas, captcha ou cobrança/cartão de crédito, **pare e me chame**. Não aceite nenhum plano pago.
6. Não altere o código do repositório. Se algo falhar por causa do código, me descreva o erro e pare.

## Etapas

### 1. Revogar a chave antiga da OpenAI
Em https://platform.openai.com/api-keys, me ajude a encontrar e **revogar** a chave criada para este projeto (ela foi exposta numa conversa). Confirme comigo qual é antes de revogar.

### 2. Preparar o GitHub
1. Crie o branch `main` a partir de `claude/affectionate-davinci-rt21ln` (página de branches do repositório).
2. Defina `main` como branch padrão (Settings → General → Default branch).
3. Abra a aba Actions e me diga se a CI (`.github/workflows/ci.yml`) rodou e se os dois jobs passaram. O job "Migrations e testes de integração" nunca foi executado antes. Se falhar, me mostre o erro e siga para a próxima etapa (ele não impede a publicação).

### 3. Criar o banco no Supabase
1. Em https://supabase.com/dashboard, crie um projeto chamado `criexo-intelligence`, região **South America (São Paulo)**, plano Free. Na senha do banco, **pare e me deixe digitar**.
2. Aplique as migrations **pelo SQL Editor**, uma de cada vez, **nesta ordem**, abrindo cada arquivo no GitHub (botão "Raw") em `supabase/migrations/`:
   1. `20261022000100_initial_schema.sql`
   2. `20261022000200_dashboard_views.sql`
   3. `20261022000300_settings_and_scoring_v2.sql`
   4. `20261022000400_companies_overview.sql`
   5. `20261023000500_research_flow.sql`
   6. `20261023000600_sources_and_scoring.sql`
   7. `20261023000700_duplicate_reviews.sql`
   8. `20261023000800_security_hardening.sql`

   Cole o conteúdo inteiro de cada arquivo, rode e confira "Success" antes do próximo. **Se uma der erro, pare e me mostre a mensagem**; não tente corrigir o SQL.
3. Conferência: rode no SQL Editor e me mostre o resultado (deve voltar **nenhuma linha**):
   ```sql
   select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
   ```

### 4. Configurar o login no Supabase
1. **Authentication → Sign In / Providers:** desligue "Allow new users to sign up". Em Email, deixe a confirmação de e-mail ligada.
2. **Senhas:** mínimo de 10 caracteres, exigindo letras e números.
3. **Authentication → Users → Add user:** crie os usuários do Christian e do Vinicius. **Pergunte os e-mails** e deixe que eu digite as senhas.
4. No SQL Editor, libere os dois como administradores (troque pelos e-mails que eu informar):
   ```sql
   update public.profiles set is_active = true, role = 'admin'
   where id in (select id from auth.users where email in ('EMAIL_1', 'EMAIL_2'));
   ```
   Confirme que a consulta atualizou 2 linhas.

### 5. Publicar na Vercel
1. Em https://vercel.com/new, importe o repositório `Criexo-itelligence` (framework Next.js, branch `main`).
2. Antes do primeiro deploy, em **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto (Supabase → Project Settings → API);
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave publicável (anon/publishable) da mesma página. **Me peça para copiar e colar.**
3. Faça o deploy e me mostre o endereço gerado (algo como `https://criexo-intelligence.vercel.app`).
4. Em **Settings → Functions**, escolha a região **São Paulo (gru1)** e faça um novo deploy se a Vercel pedir.
5. Volte ao Supabase, em **Authentication → URL Configuration**: coloque o endereço da Vercel em **Site URL** e também em **Redirect URLs**.

### 6. IA (Gemini, opcional — só se eu confirmar)
1. Em https://aistudio.google.com/apikey, ajude a criar uma chave gratuita. **Eu copio a chave**; você não a lê em voz alta nem a escreve em lugar nenhum.
2. Na Vercel, adicione as variáveis:
   - `AI_PROVIDER` = `gemini`;
   - `GEMINI_API_KEY` = (eu colo, marcada como **Sensitive**);
   - `GEMINI_MODEL` = um modelo gratuito listado no AI Studio (me mostre as opções);
   - `AI_DAILY_REQUEST_LIMIT` = `20`.
3. Faça um novo deploy.

Lembrete: no plano gratuito, o Google usa o que é enviado para melhorar os produtos dele. O sistema já envia só dados comerciais (segmento, produto, nome, categoria e bairro das empresas).

### 7. Conferência final
Abra o endereço publicado e confira comigo:
- [ ] A tela de login aparece e eu consigo entrar com meu usuário.
- [ ] Em **Configurações**, preencher (ou conferir) a região: Rua Landman, 147, Joinville–SC · coordenadas `-26.28300, -48.877018` · raio de 10 km.
- [ ] Preencher a capacidade produtiva: Bambu A1 Mini, 18 × 18 × 18 cm, PLA, 30 h de trabalho por semana, prazo padrão de 3 dias, modela só peças simples, impressora ligada só no horário de trabalho com 9,5 h por dia, peça pequena até 8 cm em cada lado, tempo contado por peça, 32 / 16 / 12 peças por dia (menos de 1 h / de 1 a 5 h / 5 h ou mais), várias peças por mesa.
- [ ] Fazer uma pesquisa de teste (ex.: "Oficinas mecânicas") com uma ideia manual aprovada e clicar em "Buscar empresas". Me dizer se a fonte "OpenStreetMap" aparece como "Concluída" ou com erro (e qual).
- [ ] Abrir https://securityheaders.com, testar o endereço publicado e me mostrar a nota.
- [ ] Em **Relatórios**, baixar o CSV de oportunidades.

## Ao terminar

Me entregue um resumo com:
- o endereço publicado;
- o que foi feito em cada etapa e o que ficou pendente ou deu erro (com a mensagem exata);
- o resultado da CI no GitHub.

Não inclua nenhuma senha ou chave no resumo.
