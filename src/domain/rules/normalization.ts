/**
 * Normalização usada na deduplicação de empresas (seção 7, passo 1).
 * As funções retornam `null` quando o valor não é utilizável — nunca
 * "corrigem" um dado inventando partes que faltam.
 */

const LEGAL_SUFFIXES = new Set(["ltda", "me", "epp", "eireli", "sa", "s/a", "mei", "ss", "cia"]);

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Nome comparável: sem acentos, pontuação ou sufixos societários. */
export function normalizeCompanyName(name: string): string {
  const tokens = stripAccents(name)
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/s\/a\b/g, "sa")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

/**
 * Telefone brasileiro em dígitos com DDD (10 ou 11 dígitos), sem o código
 * do país. Números sem DDD não são completados.
 */
export function normalizeBrazilianPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  // Prefixo de discagem interurbana ("0" antes do DDD).
  if (digits.startsWith("0")) digits = digits.slice(1);
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("0")) return digits;
  return null;
}

/** URL pública validada (somente http/https, sem credenciais embutidas). */
export function sanitizeWebsiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
  url.hash = "";
  return url.toString();
}

/** Domínio comparável, sem "www.". */
export function normalizeWebsiteDomain(value: string): string | null {
  const sanitized = sanitizeWebsiteUrl(value);
  if (!sanitized) return null;
  return new URL(sanitized).hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * CNPJ normalizado (14 caracteres, maiúsculos), apenas se os dígitos
 * verificadores forem válidos. Aceita o formato alfanumérico adotado pela
 * Receita Federal para novos cadastros a partir de julho de 2026: os 12
 * primeiros caracteres podem ter letras; os 2 verificadores são sempre
 * números. Cada caractere vale seu código ASCII menos 48 (0–9 → 0–9,
 * A–Z → 17–42), com os pesos do módulo 11 tradicional.
 */
export function normalizeCnpj(value: string): string | null {
  const cnpj = value.toUpperCase().replace(/[\s./-]/g, "");
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return null;

  const checkDigit = (base: string) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = [...base].reduce((total, char, index) => total + (char.charCodeAt(0) - 48) * weights[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const first = checkDigit(cnpj.slice(0, 12));
  const second = checkDigit(cnpj.slice(0, 12) + first);
  return cnpj.endsWith(`${first}${second}`) ? cnpj : null;
}

/** CNPJ formatado para exibição: 12.ABC.345/01DE-35. */
export function formatCnpj(cnpj: string): string {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
