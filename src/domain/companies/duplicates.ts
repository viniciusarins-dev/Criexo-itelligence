import { formatPhoneBr, formatPostalCode } from "@/lib/formatting/numbers";

/** Campos comparados lado a lado na revisão de duplicidade. */
export type ComparableCompany = {
  name: string | null;
  segment: string | null;
  website: string | null;
  phone_normalized: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ComparisonRow = {
  field: keyof ComparableCompany | "location";
  label: string;
  existing: string | null;
  candidate: string | null;
  /** Iguais depois de ignorar maiúsculas, acentos e espaços. */
  same: boolean;
  /** "Mesma empresa" preencheria este campo (vazio no cadastro, presente na fonte). */
  wouldFill: boolean;
};

const FIELDS: { field: ComparisonRow["field"]; label: string; format?: (value: string) => string }[] = [
  { field: "name", label: "Nome" },
  { field: "segment", label: "Segmento" },
  { field: "website", label: "Site" },
  { field: "phone_normalized", label: "Telefone", format: formatPhoneBr },
  { field: "address", label: "Endereço" },
  { field: "neighborhood", label: "Bairro" },
  { field: "city", label: "Cidade" },
  { field: "state", label: "UF" },
  { field: "postal_code", label: "CEP", format: formatPostalCode },
  { field: "location", label: "Localização" },
];

function comparable(value: string | null): string {
  return (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function valueOf(company: Partial<ComparableCompany>, field: ComparisonRow["field"]): string | null {
  if (field === "location") {
    return company.latitude != null && company.longitude != null ? `${company.latitude.toFixed(5)}, ${company.longitude.toFixed(5)}` : null;
  }
  const value = company[field];
  return value === null || value === undefined || value === "" ? null : String(value);
}

export function compareDuplicate(existing: ComparableCompany, candidate: Partial<ComparableCompany>): ComparisonRow[] {
  return FIELDS.map(({ field, label, format }) => {
    const left = valueOf(existing, field);
    const right = valueOf(candidate, field);
    return {
      field,
      label,
      existing: left && format ? format(left) : left,
      candidate: right && format ? format(right) : right,
      same: left !== null && right !== null && comparable(left) === comparable(right),
      wouldFill: left === null && right !== null && field !== "name",
    };
  });
}
