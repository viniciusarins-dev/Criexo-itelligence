import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readPublicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/configuracao-pendente"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Renova a sessão do Supabase e redireciona visitantes sem sessão para o
 * login. A autorização definitiva (perfil ativo, papel) é verificada no
 * servidor, na camada de acesso a dados, e pelas políticas RLS.
 */
export async function updateSession(request: NextRequest) {
  const envResult = readPublicEnv();
  if (!envResult.ok) {
    if (request.nextUrl.pathname === "/configuracao-pendente") return NextResponse.next();
    return NextResponse.redirect(new URL("/configuracao-pendente", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    envResult.env.NEXT_PUBLIC_SUPABASE_URL,
    envResult.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Não coloque código entre a criação do cliente e esta chamada.
  const { data } = await supabase.auth.getClaims();
  const hasSession = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  // Server Actions não podem ser redirecionadas aqui (um 307 quebra a
  // chamada); cada action verifica a sessão por conta própria.
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  if (!hasSession && !isPublicPath(pathname) && !isServerAction) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return redirectWithCookies(url, response);
  }

  if (hasSession && pathname === "/login") {
    return redirectWithCookies(new URL("/dashboard", request.url), response);
  }

  return response;
}

function redirectWithCookies(url: URL, source: NextResponse) {
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
