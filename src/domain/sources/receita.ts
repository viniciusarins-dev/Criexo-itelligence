import { normalizeCompanyName, normalizeCnpj } from "@/domain/rules/normalization";
import { titleCase } from "@/domain/sources/brasilapi";

/**
 * Dados abertos do CNPJ (Receita Federal), arquivos "Estabelecimentos",
 * "Municipios" e "Cnaes" já descompactados. CSV com ";" e aspas, em Latin-1.
 * Só são importados estabelecimentos ativos do município escolhido, com nome
 * fantasia. Telefone, e-mail e dados de sócios não são lidos (LGPD).
 */
export const RECEITA_SOURCE_NAME = "Dados abertos do CNPJ (Receita Federal)";

/** Posição das colunas no arquivo Estabelecimentos (leiaute publicado pela Receita). */
export const ESTABELECIMENTO = {
  cnpjBasico: 0,
  cnpjOrdem: 1,
  cnpjDv: 2,
  matrizFilial: 3,
  nomeFantasia: 4,
  situacao: 5,
  inicioAtividade: 10,
  cnaePrincipal: 11,
  tipoLogradouro: 13,
  logradouro: 14,
  numero: 15,
  complemento: 16,
  bairro: 17,
  cep: 18,
  uf: 19,
  municipio: 20,
} as const;

/** Situação cadastral "02" = ativa. */
export const SITUACAO_ATIVA = "02";

/** Lê uma linha no formato da Receita: campos entre aspas separados por ";". */
export function parseReceitaLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index++;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ";") {
      fields.push(current);
      current = "";
    } else current += char;
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

/** Tabela código → descrição (Municipios e Cnaes têm o mesmo formato). */
export function parseCodeTable(lines: Iterable<string>): Map<string, string> {
  const table = new Map<string, string>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const [code, description] = parseReceitaLine(line);
    if (code && description) table.set(code, description);
  }
  return table;
}

function comparable(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

/** Código do município na tabela da Receita (não é o código do IBGE). */
export function findMunicipioCode(municipios: Map<string, string>, name: string): string[] {
  const wanted = comparable(name);
  return [...municipios].filter(([, description]) => comparable(description) === wanted).map(([code]) => code);
}

export type ReceitaFilter = {
  municipioCodes: string[];
  uf: string;
  /** Prefixos de CNAE aceitos (vazio = todos). */
  cnaePrefixes: string[];
};

export type ReceitaCompany = {
  cnpj: string;
  name: string;
  normalizedName: string;
  segment: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  postalCode: string | null;
  metadata: { cnae: string; situacao: "ATIVA"; inicioAtividade: string | null; matriz: boolean };
};

export type SkipReason = "other_place" | "inactive" | "no_trade_name" | "cnae_filtered" | "invalid_cnpj" | "malformed";

/** Converte uma linha de Estabelecimentos, ou diz por que ela foi ignorada. */
export function estabelecimentoToCompany(
  fields: string[],
  filter: ReceitaFilter,
  tables: { cnaes: Map<string, string>; cityName: string },
): { ok: true; company: ReceitaCompany } | { ok: false; reason: SkipReason } {
  if (fields.length < 21) return { ok: false, reason: "malformed" };
  const field = (key: keyof typeof ESTABELECIMENTO) => fields[ESTABELECIMENTO[key]] ?? "";
  if (field("uf").toUpperCase() !== filter.uf.toUpperCase() || !filter.municipioCodes.includes(field("municipio"))) {
    return { ok: false, reason: "other_place" };
  }
  if (field("situacao").padStart(2, "0") !== SITUACAO_ATIVA) return { ok: false, reason: "inactive" };
  const name = field("nomeFantasia");
  // Sem nome fantasia, o nome seria a razão social — em MEI, o nome da pessoa.
  if (!name) return { ok: false, reason: "no_trade_name" };
  const cnae = field("cnaePrincipal");
  if (filter.cnaePrefixes.length && !filter.cnaePrefixes.some((prefix) => cnae.startsWith(prefix))) {
    return { ok: false, reason: "cnae_filtered" };
  }
  const cnpj = normalizeCnpj(`${field("cnpjBasico")}${field("cnpjOrdem")}${field("cnpjDv")}`);
  if (!cnpj) return { ok: false, reason: "invalid_cnpj" };

  const street = [field("tipoLogradouro"), field("logradouro")].filter(Boolean).join(" ");
  const address = [street, field("numero"), field("complemento")].filter(Boolean).join(", ");
  const postal = field("cep").replace(/\D/g, "");
  const started = field("inicioAtividade");
  const displayName = titleCase(name).slice(0, 200);
  return {
    ok: true,
    company: {
      cnpj,
      name: displayName,
      normalizedName: normalizeCompanyName(displayName),
      segment: tables.cnaes.get(cnae) ?? null,
      address: address ? titleCase(address) : null,
      neighborhood: field("bairro") ? titleCase(field("bairro")) : null,
      city: titleCase(tables.cityName),
      state: field("uf").toUpperCase(),
      postalCode: /^[0-9]{8}$/.test(postal) ? postal : null,
      metadata: {
        cnae,
        situacao: "ATIVA",
        inicioAtividade: /^[0-9]{8}$/.test(started) ? `${started.slice(6, 8)}/${started.slice(4, 6)}/${started.slice(0, 4)}` : null,
        matriz: field("matrizFilial") === "1",
      },
    },
  };
}
