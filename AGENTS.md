<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## CRIEXO Intelligence — regras do projeto

- Leia `docs/` antes de alterar regras de negócio. Não invente decisões: registre-as em `docs/DECISOES_PENDENTES.md`.
- Regras de negócio ficam em `src/domain` (puro, testado) e no banco (funções + RLS), nunca só na interface.
- Novas tabelas: RLS habilitado, privilégios mínimos para `authenticated`, nada para `anon`, teste em `tests/integration`.
- Cores só por tokens semânticos de `src/app/globals.css`.
- Atualize `docs/IMPLEMENTACAO.md` ao final de cada etapa com os testes realmente executados.
