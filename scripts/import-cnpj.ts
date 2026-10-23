/**
 * Importa estabelecimentos ativos de um município a partir dos dados abertos
 * do CNPJ (Receita Federal). Roda fora do aplicativo, por um administrador.
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/import-cnpj.ts \
 *     --estabelecimentos dados/Estabelecimentos0.csv [dados/Estabelecimentos1.csv ...] \
 *     --municipios dados/Municipios.csv --cnaes dados/Cnaes.csv \
 *     --municipio Joinville --uf SC --responsavel email@exemplo.com \
 *     [--cnae 47,86] [--simular]
 *
 * Regras: nada é substituído. CNPJ já cadastrado é ignorado; nome igual a uma
 * empresa sem CNPJ vai para a fila de "Possíveis duplicidades" em vez de
 * criar outra empresa. Telefone, e-mail e sócios não são lidos.
 */
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

import { Client } from "pg";

import {
  estabelecimentoToCompany,
  findMunicipioCode,
  parseCodeTable,
  parseReceitaLine,
  RECEITA_SOURCE_NAME,
  type ReceitaCompany,
  type SkipReason,
} from "../src/domain/sources/receita";

const { values } = parseArgs({
  options: {
    estabelecimentos: { type: "string", multiple: true },
    municipios: { type: "string" },
    cnaes: { type: "string" },
    municipio: { type: "string" },
    uf: { type: "string" },
    responsavel: { type: "string" },
    cnae: { type: "string", default: "" },
    simular: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

function fail(message: string): never {
  console.error(`Erro: ${message}`);
  process.exit(1);
}

const latin1 = (path: string) => readFileSync(path).toString("latin1").split(/\r?\n/);

async function main() {
  if (!values.estabelecimentos?.length || !values.municipios || !values.cnaes || !values.municipio || !values.uf || !values.responsavel) {
    fail("informe --estabelecimentos, --municipios, --cnaes, --municipio, --uf e --responsavel.");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl && !values.simular) fail("defina DATABASE_URL (conexão direta com o banco) ou use --simular.");

  const municipios = parseCodeTable(latin1(values.municipios));
  const codes = findMunicipioCode(municipios, values.municipio);
  if (codes.length !== 1) fail(`município "${values.municipio}" encontrado ${codes.length} vez(es) na tabela da Receita.`);
  const cnaes = parseCodeTable(latin1(values.cnaes));
  const filter = { municipioCodes: codes, uf: values.uf, cnaePrefixes: values.cnae.split(",").map((item) => item.trim()).filter(Boolean) };
  console.log(`Município ${values.municipio}/${values.uf}: código ${codes[0]} na tabela da Receita.`);

  const found: ReceitaCompany[] = [];
  const skipped: Record<SkipReason, number> = { other_place: 0, inactive: 0, no_trade_name: 0, cnae_filtered: 0, invalid_cnpj: 0, malformed: 0 };
  for (const file of values.estabelecimentos) {
    const lines = createInterface({ input: createReadStream(file, { encoding: "latin1" }), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      const result = estabelecimentoToCompany(parseReceitaLine(line), filter, { cnaes, cityName: values.municipio });
      if (result.ok) found.push(result.company);
      else skipped[result.reason]++;
    }
  }
  console.log(`Encontrados: ${found.length}. Ignorados: ${JSON.stringify(skipped)}.`);
  if (values.simular) {
    for (const company of found.slice(0, 10)) console.log(` - ${company.name} (${company.segment ?? "sem CNAE"}) · ${company.neighborhood ?? "sem bairro"}`);
    console.log("Simulação: nada foi gravado.");
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const owner = await client.query<{ id: string }>(
      "select p.id from public.profiles p join auth.users u on u.id = p.id where lower(u.email) = lower($1) and p.is_active",
      [values.responsavel],
    );
    if (owner.rows.length !== 1) fail("o responsável precisa ser um usuário ativo do sistema.");
    const ownerId = owner.rows[0].id;
    const observedAt = new Date().toISOString();
    let created = 0;
    let existing = 0;
    let queued = 0;

    await client.query("begin");
    for (const company of found) {
      const byCnpj = await client.query("select id from public.companies where cnpj = $1", [company.cnpj]);
      if (byCnpj.rows.length) {
        existing++;
        continue;
      }
      const provenanceEntry = { status: "source_declared", source: RECEITA_SOURCE_NAME, observedAt };
      const provenance = Object.fromEntries(
        (["name", "cnpj", "segment", "address", "neighborhood", "city", "state", "postalCode"] as const)
          .filter((field) => company[field])
          .map((field) => [field, provenanceEntry]),
      );
      const sameName = await client.query("select id from public.companies where normalized_name = $1 and cnpj is null limit 1", [company.normalizedName]);
      if (sameName.rows.length) {
        const result = await client.query(
          `insert into public.duplicate_reviews (company_id, source_name, source_record_id, candidate, reasons, created_by)
           values ($1, $2, $3, $4, '{name}', $5)
           on conflict (source_name, source_record_id) where status = 'pending' do nothing`,
          [
            sameName.rows[0].id,
            RECEITA_SOURCE_NAME,
            company.cnpj,
            JSON.stringify({
              name: company.name,
              normalized_name: company.normalizedName,
              segment: company.segment,
              address: company.address,
              neighborhood: company.neighborhood,
              city: company.city,
              state: company.state,
              postal_code: company.postalCode,
              field_provenance: provenance,
            }),
            ownerId,
          ],
        );
        queued += result.rowCount ?? 0;
        continue;
      }
      const inserted = await client.query(
        `insert into public.companies (name, normalized_name, cnpj, segment, address, neighborhood, city, state, postal_code, field_provenance, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
        [company.name, company.normalizedName, company.cnpj, company.segment, company.address, company.neighborhood, company.city, company.state, company.postalCode, JSON.stringify(provenance), ownerId],
      );
      await client.query(
        `insert into public.company_sources (company_id, source_name, source_record_id, last_verified_at, evidence_metadata)
         values ($1, $2, $3, $4, $5)
         on conflict (source_name, source_record_id) where source_record_id is not null do nothing`,
        [inserted.rows[0].id, RECEITA_SOURCE_NAME, company.cnpj, observedAt, JSON.stringify(company.metadata)],
      );
      created++;
    }
    await client.query("commit");
    console.log(`Gravado: ${created} empresa(s) nova(s); ${existing} já cadastrada(s) pelo CNPJ; ${queued} enviada(s) para revisão de duplicidade.`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
