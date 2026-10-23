import { z } from "zod";

import type { CompanyDraft, TrackedField } from "@/domain/companies/company";

/**
 * BrasilAPI — consulta de CNPJ (dados abertos da Receita Federal). Só
 * completa campos vazios: nada informado manualmente é substituído.
 * Telefone e e-mail não são importados: em MEIs costumam ser pessoais (LGPD).
 */
export const BRASILAPI_SOURCE_NAME = "BrasilAPI (dados da Receita Federal)";

const optionalText = z
  .string()
  .nullish()
  .transform((value) => (value && value.trim() ? value.trim() : null));

export const brasilApiCnpjSchema = z.object({
  cnpj: z.string(),
  razao_social: optionalText,
  nome_fantasia: optionalText,
  descricao_situacao_cadastral: optionalText,
  cnae_fiscal: z.union([z.number(), z.string()]).nullish(),
  cnae_fiscal_descricao: optionalText,
  descricao_tipo_de_logradouro: optionalText,
  logradouro: optionalText,
  numero: optionalText,
  complemento: optionalText,
  bairro: optionalText,
  municipio: optionalText,
  uf: optionalText,
  cep: z.union([z.string(), z.number()]).nullish(),
  opcao_pelo_mei: z.boolean().nullish(),
  porte: optionalText,
  data_inicio_atividade: optionalText,
});
export type BrasilApiCnpj = z.output<typeof brasilApiCnpjSchema>;

const LOWERCASE_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "RUA DOUTOR JOAO COLIN" → "Rua Doutor Joao Colin" (a Receita grava tudo em maiúsculas). */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => (index > 0 && LOWERCASE_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export type CnpjEnrichment = {
  changes: Partial<Pick<CompanyDraft, "segment" | "address" | "neighborhood" | "city" | "state" | "postalCode">>;
  filled: TrackedField[];
  /** Informações exibidas e guardadas com a fonte (sem dados pessoais). */
  metadata: {
    situacao: string | null;
    cnae: string | null;
    porte: string | null;
    inicioAtividade: string | null;
    isMei: boolean | null;
    /** Omitida para MEI: a razão social costuma ser o nome da pessoa. */
    razaoSocial: string | null;
    nomeFantasia: string | null;
  };
  isActive: boolean | null;
};

export function enrichFromCnpj(company: CompanyDraft, data: BrasilApiCnpj): CnpjEnrichment {
  const street = [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" ");
  const address = [street, data.numero, data.complemento].filter(Boolean).join(", ");
  const postal = data.cep === null || data.cep === undefined ? "" : String(data.cep).replace(/\D/g, "").padStart(8, "0");
  const uf = data.uf?.toUpperCase();
  const proposed: CnpjEnrichment["changes"] = {
    segment: data.cnae_fiscal_descricao,
    address: address ? titleCase(address) : null,
    neighborhood: data.bairro ? titleCase(data.bairro) : null,
    city: data.municipio ? titleCase(data.municipio) : null,
    state: uf && /^[A-Z]{2}$/.test(uf) ? uf : null,
    postalCode: /^[0-9]{8}$/.test(postal) && postal !== "00000000" ? postal : null,
  };

  const changes: CnpjEnrichment["changes"] = {};
  const filled: TrackedField[] = [];
  for (const [field, value] of Object.entries(proposed) as [keyof CnpjEnrichment["changes"], string | null][]) {
    if (value && !company[field]) {
      changes[field] = value;
      filled.push(field);
    }
  }

  const situacao = data.descricao_situacao_cadastral;
  return {
    changes,
    filled,
    metadata: {
      situacao,
      cnae: data.cnae_fiscal ? `${data.cnae_fiscal}${data.cnae_fiscal_descricao ? ` — ${data.cnae_fiscal_descricao}` : ""}` : null,
      porte: data.porte,
      inicioAtividade: data.data_inicio_atividade,
      isMei: data.opcao_pelo_mei ?? null,
      razaoSocial: data.opcao_pelo_mei ? null : data.razao_social,
      nomeFantasia: data.nome_fantasia,
    },
    isActive: situacao ? situacao.toUpperCase() === "ATIVA" : null,
  };
}
