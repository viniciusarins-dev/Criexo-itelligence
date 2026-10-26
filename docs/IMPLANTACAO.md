# Implantação — passo a passo

Guia para publicar o CRIEXO Intelligence sem custo inicial: **Supabase**
(banco e login) e **Vercel** (aplicação), ambos no plano gratuito. Leva cerca
de 1 hora.

> Estes passos não puderam ser executados a partir do ambiente de
> desenvolvimento, porque exigem as contas da CRIEXO. Eles seguem a
> documentação oficial de 23/10/2026; confira as telas, que podem mudar de
> nome.

## 1. Banco de dados (Supabase)

1. Em https://supabase.com, crie a organização e um projeto:
   - **Região:** South America (São Paulo);
   - **Senha do banco:** forte, guardada no gerenciador de senhas (não
     envie por chat).
2. Aplique as migrations a partir do seu computador, na pasta do projeto:
   ```bash
   npx supabase@2.121.0 login
   npx supabase@2.121.0 link --project-ref <id-do-projeto>
   npx supabase@2.121.0 db push
   ```
   O `db push` mostra as migrations de `supabase/migrations` e pede
   confirmação.
3. Em **Authentication → Sign In / Providers**:
   - desligue **Allow new users to sign up**;
   - em **Email**, deixe a confirmação de e-mail ligada.
4. Em **Authentication → Policies / Passwords**: senha mínima de 10
   caracteres, com letras e números.
5. Em **Authentication → URL Configuration**, preencha **Site URL** com o
   endereço de produção (passo 2.4) e inclua-o em **Redirect URLs**.
6. Crie os usuários (Christian e Vinicius) com **Auto Confirm User** marcado e
   libere o primeiro administrador, como em README → "Usuários autorizados".

**Chaves:** a aplicação usa só a **URL do projeto** e a **chave
publicável** (Project Settings → API). A chave `service_role` e a senha do
banco **nunca** vão para a Vercel nem para o código.

## 2. Aplicação (Vercel)

1. Em https://vercel.com, entre com o GitHub e importe o repositório
   `criexo-itelligence`.
2. Em **Settings → Environment Variables**, configure:

   | Variável | Valor | Observação |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | pública por natureza |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publicável | protegida pelo RLS |
   | `AI_PROVIDER` | `gemini` | opcional |
   | `GEMINI_API_KEY` | chave do Google AI Studio | marque como **Sensitive** |
   | `GEMINI_MODEL` | modelo escolhido no AI Studio | opcional |
   | `AI_DAILY_REQUEST_LIMIT` | por exemplo `20` | opcional |

   Nenhuma variável secreta pode começar com `NEXT_PUBLIC_`.
3. Em **Settings → Functions**, escolha a região **São Paulo (gru1)**, perto
   do banco.
4. Faça o deploy. Use o endereço gerado (ou um domínio próprio) no passo
   1.5.

## 3. Conferência depois do deploy

- [ ] Entrar com um administrador; um usuário não liberado vê "Acesso
      pendente".
- [ ] Em **Configurações**, preencher região e capacidade (README →
      "Primeira configuração").
- [ ] Fazer uma pesquisa de teste: as fontes aparecem como "Concluída" (se o
      OpenStreetMap falhar, a página mostra o motivo).
- [ ] Conferir os cabeçalhos de segurança em https://securityheaders.com
      (esperado: CSP com nonce, HSTS, X-Frame-Options, Referrer-Policy).
- [ ] Baixar um CSV em **Relatórios** e abrir no Excel.

## 4. Operação

- **Pausa por inatividade:** o Supabase gratuito pausa o projeto depois de
  cerca de 1 semana sem uso. Reative pelo painel; nada é perdido.
- **Cópia de segurança:** o plano gratuito não tem restauração para um
  ponto no tempo. Faça uma cópia semanal:
  ```bash
  npx supabase@2.121.0 db dump --data-only -f backup-$(date +%F).sql
  ```
  Guarde o arquivo fora do computador (contém dados de empresas).
- **Importação do CNPJ:** README → "Importar os dados abertos do CNPJ".
- **Atualizações:** cada push no GitHub roda a CI
  (`.github/workflows/ci.yml`). Antes de publicar, rode as migrations novas
  com `db push`.

## 5. Login não entra — o que verificar

| O que aparece | Causa provável | Como resolver |
|---|---|---|
| "Este e-mail ainda não foi confirmado" | Usuário criado sem **Auto Confirm User** | Supabase → Authentication → Users → abrir o usuário → **Confirm email** (ou recriar com a caixa marcada) |
| "E-mail ou senha incorretos." | Senha diferente da cadastrada, ou o usuário foi criado em outro projeto Supabase | Supabase → Users → **Send password recovery** ou redefinir a senha; conferir se a URL na Vercel é a deste projeto |
| Tela "Configuração pendente" | Variáveis `NEXT_PUBLIC_SUPABASE_*` ausentes no build | Cadastrar na Vercel e fazer **Redeploy** (elas são embutidas no build) |
| Entra, mas cai em "Acesso pendente" | Perfil não liberado | Rodar o `update public.profiles … is_active = true` do README com o e-mail exato |
| Erro de servidor depois de entrar | Migrations não aplicadas (tabela `profiles` ausente) | Aplicar as migrations na ordem e conferir com a consulta de RLS do guia |

O motivo exato de cada recusa aparece em Vercel → projeto → **Logs**, na linha
"Falha no login" (só o código do erro, sem e-mail nem senha).
