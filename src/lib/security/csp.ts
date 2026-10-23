/**
 * Content Security Policy com nonce por requisição (guia de CSP do Next.js).
 * Scripts: só os do próprio site com o nonce. Estilos: o site e atributos
 * `style` (barras e posições calculadas usam estilo inline; nenhum script é
 * liberado por isso). Nenhuma origem externa: o navegador não fala com o
 * Supabase diretamente — tudo passa pelo servidor.
 */
export function buildContentSecurityPolicy(nonce: string, options: { isDev: boolean; isHttps: boolean }): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.isHttps ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
