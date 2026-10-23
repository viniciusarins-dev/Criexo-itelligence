import { REPORT_PERIODS, toCsv, type ReportPeriod } from "@/domain/reports/reports";
import { formatCnpj } from "@/domain/rules/normalization";
import { INFORMATION_STATUS_LABELS, type InformationStatus } from "@/domain/types/information";
import { companiesForExport, opportunitiesForExport } from "@/server/repositories/reports";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null);

/** Exportação CSV (somente membros ativos; os dados vêm pela sessão, sob RLS). */
export async function GET(request: Request, context: RouteContext<"/relatorios/exportar/[tipo]">) {
  const { tipo } = await context.params;
  const periodParam = new URL(request.url).searchParams.get("periodo") ?? "todos";
  const period: ReportPeriod = periodParam in REPORT_PERIODS ? (periodParam as ReportPeriod) : "todos";
  const stamp = new Date().toISOString().slice(0, 10);

  let csv: string;
  if (tipo === "oportunidades") {
    const { rows } = await opportunitiesForExport(period);
    csv = toCsv(rows, [
      { header: "Empresa", value: (row) => row.company.name },
      { header: "CNPJ", value: (row) => (row.company.cnpj ? formatCnpj(row.company.cnpj) : null) },
      { header: "Segmento", value: (row) => row.company.segment },
      { header: "Bairro", value: (row) => row.company.neighborhood },
      { header: "Cidade", value: (row) => row.company.city },
      { header: "Produto", value: (row) => row.productName },
      { header: "Status", value: (row) => row.statusLabel },
      { header: "Salva", value: (row) => row.isSaved },
      { header: "Pontuação", value: (row) => row.score },
      { header: "Estrelas", value: (row) => row.stars },
      { header: "Dados completos", value: (row) => row.isComplete },
      { header: "Confiança (%)", value: (row) => row.confidence },
      { header: "Criada em", value: (row) => date(row.createdAt) },
      { header: "Atualizada em", value: (row) => date(row.updatedAt) },
    ]);
  } else if (tipo === "empresas") {
    const { rows } = await companiesForExport(period);
    csv = toCsv(rows, [
      { header: "Empresa", value: (row) => row.name },
      { header: "CNPJ", value: (row) => (row.cnpj ? formatCnpj(row.cnpj) : null) },
      { header: "Segmento", value: (row) => row.segment },
      { header: "Site", value: (row) => row.website },
      { header: "Telefone comercial", value: (row) => row.phone },
      { header: "Bairro", value: (row) => row.neighborhood },
      { header: "Cidade", value: (row) => row.city },
      { header: "UF", value: (row) => row.state },
      { header: "Localização", value: (row) => (row.location_status ? INFORMATION_STATUS_LABELS[row.location_status as InformationStatus] : null) },
      { header: "Distância (km)", value: (row) => (row.distance_km === null ? null : Number(row.distance_km)) },
      { header: "Oportunidades", value: (row) => row.opportunity_count },
      { header: "Melhor pontuação", value: (row) => (row.score === null ? null : Number(row.score)) },
      { header: "Produto da melhor oportunidade", value: (row) => row.product_name },
      { header: "Cadastrada em", value: (row) => date(row.created_at) },
    ]);
  } else {
    return new Response("Exportação desconhecida.", { status: 404 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="criexo-${tipo}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
