/**
 * Testes de autorização contra um Postgres com o esquema do Supabase.
 *
 * Requer TEST_DATABASE_URL apontando para um banco com as migrations
 * aplicadas e conexão de superusuário (ex.: Supabase local:
 * postgresql://postgres:postgres@127.0.0.1:54322/postgres).
 * Cada teste roda em uma transação desfeita ao final.
 */
import { randomUUID } from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { haversineDistanceKm } from "@/domain/scoring";

const databaseUrl = process.env.TEST_DATABASE_URL;

type Users = { admin: string; member: string; inactive: string };

describe.skipIf(!databaseUrl)("RLS e funções de histórico", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  async function inTransaction(run: (users: Users) => Promise<void>) {
    await client.query("begin");
    try {
      const users: Users = { admin: randomUUID(), member: randomUUID(), inactive: randomUUID() };
      for (const [name, id] of Object.entries(users)) {
        await client.query(
          `insert into auth.users (id, email, raw_user_meta_data, aud, role)
           values ($1, $2, jsonb_build_object('display_name', $3::text), 'authenticated', 'authenticated')`,
          [id, `${name}-${id}@teste.local`, name],
        );
      }
      await client.query("update public.profiles set is_active = true, role = 'admin' where id = $1", [users.admin]);
      await client.query("update public.profiles set is_active = true where id = $1", [users.member]);
      await run(users);
    } finally {
      await client.query("rollback");
    }
  }

  async function as(userId: string | null) {
    await client.query("reset role");
    if (userId === null) {
      await client.query("set local role anon");
      await client.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
      return;
    }
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
  }

  async function asSuperuser() {
    await client.query("reset role");
  }

  /** Executa em um savepoint e devolve o código de erro do Postgres, se houver. */
  async function errorCode(sql: string, params: unknown[] = []): Promise<string | null> {
    await client.query("savepoint attempt");
    try {
      await client.query(sql, params);
      await client.query("release savepoint attempt");
      return null;
    } catch (error) {
      await client.query("rollback to savepoint attempt");
      return (error as { code?: string }).code ?? "unknown";
    }
  }

  async function count(table: string) {
    const { rows } = await client.query<{ n: string }>(`select count(*) as n from public.${table}`);
    return Number(rows[0].n);
  }

  it("novo usuário do Auth recebe perfil inativo", async () => {
    await inTransaction(async (users) => {
      const { rows } = await client.query("select role, is_active, display_name from public.profiles where id = $1", [
        users.inactive,
      ]);
      expect(rows[0]).toEqual({ role: "member", is_active: false, display_name: "inactive" });
    });
  });

  it("anon não lê nenhuma tabela interna", async () => {
    await inTransaction(async () => {
      await as(null);
      for (const table of ["profiles", "companies", "opportunities", "research_sessions", "scoring_configs"]) {
        expect(await errorCode(`select * from public.${table}`)).toBe("42501");
      }
    });
  });

  it("usuário autenticado porém inativo não vê dados internos", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      await client.query(
        "insert into public.companies (name, normalized_name, created_by) values ('Empresa Teste', 'empresa teste', $1)",
        [users.member],
      );

      await as(users.inactive);
      expect(await count("companies")).toBe(0);
      expect(await count("scoring_configs")).toBe(0);
      expect(await count("commercial_statuses")).toBe(0);
      // Vê apenas o próprio perfil.
      const { rows } = await client.query("select id from public.profiles");
      expect(rows).toEqual([{ id: users.inactive }]);
      // Não consegue escrever.
      expect(
        await errorCode(
          "insert into public.companies (name, normalized_name, created_by) values ('X', 'x', $1)",
          [users.inactive],
        ),
      ).toBe("42501");
    });
  });

  it("view do dashboard respeita RLS (security_invoker)", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      // Independe de dados já existentes no banco: compara antes e depois.
      const totalNew = async () => {
        const { rows } = await client.query("select total from public.opportunity_status_counts where commercial_status = 'nova'");
        return rows.length ? Number(rows[0].total) : 0;
      };
      const before = await totalNew();
      const company = await client.query(
        "insert into public.companies (name, normalized_name) values ('Empresa View', 'empresa view') returning id",
      );
      await client.query("insert into public.opportunities (company_id) values ($1)", [company.rows[0].id]);
      expect(await totalNew()).toBe(before + 1);

      await as(users.inactive);
      expect(await count("opportunity_status_counts")).toBe(0);
      await as(null);
      expect(await errorCode("select * from public.opportunity_status_counts")).toBe("42501");
    });
  });

  it("membro ativo lê os dados da equipe e não se autopromove", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      expect(await count("profiles")).toBeGreaterThanOrEqual(2);
      expect(await count("commercial_statuses")).toBe(7);

      // Coluna role não pode ser alterada diretamente.
      expect(await errorCode("update public.profiles set role = 'admin' where id = $1", [users.member])).toBe("42501");
      expect(await errorCode("update public.profiles set is_active = true where id = $1", [users.inactive])).toBe(
        "42501",
      );
      // Nome de exibição próprio pode.
      await client.query("update public.profiles set display_name = 'Novo nome' where id = $1", [users.member]);
      // Função administrativa é negada a não administradores.
      expect(
        await errorCode("select public.admin_set_member_access($1, 'admin', true)", [users.inactive]),
      ).toBe("42501");
    });
  });

  it("administrador libera acesso pela função dedicada", async () => {
    await inTransaction(async (users) => {
      await as(users.admin);
      await client.query("select public.admin_set_member_access($1, 'member', true)", [users.inactive]);
      expect(
        await errorCode("select public.admin_set_member_access($1, 'member', true)", [users.admin]),
      ).toBe("42501");
      await asSuperuser();
      const { rows } = await client.query("select is_active from public.profiles where id = $1", [users.inactive]);
      expect(rows[0].is_active).toBe(true);
    });
  });

  it("registros são criados apenas em nome do próprio usuário", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      expect(
        await errorCode(
          "insert into public.research_sessions (research_type, query, created_by) values ('segment', 'Oficinas', $1)",
          [users.admin],
        ),
      ).toBe("42501");
      const { rows } = await client.query(
        "insert into public.research_sessions (research_type, query) values ('segment', 'Oficinas') returning created_by",
      );
      expect(rows).toEqual([{ created_by: users.member }]);
    });
  });

  it("decisão de ideia é individual e fica registrada (RN-03, RN-11)", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      const { rows } = await client.query(
        `insert into public.product_ideas (name, normalized_name, origin)
         values ('Suporte de ferramentas', 'suporte de ferramentas', 'manual') returning id, approval_status`,
      );
      const ideaId = rows[0].id as string;
      expect(rows[0].approval_status).toBe("pending");

      // Não é possível aprovar diretamente, sem histórico.
      expect(
        await errorCode("update public.product_ideas set approval_status = 'approved' where id = $1", [ideaId]),
      ).toBe("42501");

      await client.query("select public.decide_product_idea($1, 'approved', 'Faz sentido testar')", [ideaId]);
      await client.query("select public.decide_product_idea($1, 'rejected', null)", [ideaId]);
      expect(await errorCode("select public.decide_product_idea($1, 'pending', null)", [ideaId])).toBe("22023");

      const idea = await client.query("select approval_status, decided_by from public.product_ideas where id = $1", [
        ideaId,
      ]);
      expect(idea.rows[0]).toEqual({ approval_status: "rejected", decided_by: users.member });

      const history = await client.query(
        "select previous_status, new_status, note from public.product_idea_decisions where product_idea_id = $1 order by id",
        [ideaId],
      );
      expect(history.rows).toEqual([
        { previous_status: "pending", new_status: "approved", note: "Faz sentido testar" },
        { previous_status: "approved", new_status: "rejected", note: null },
      ]);

      // Histórico é somente inclusão.
      expect(await errorCode("delete from public.product_idea_decisions where product_idea_id = $1", [ideaId])).toBe(
        "42501",
      );
    });
  });

  it("status comercial só muda com registro no histórico", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      const company = await client.query(
        "insert into public.companies (name, normalized_name) values ('Empresa Pipeline', 'empresa pipeline') returning id",
      );
      const opportunity = await client.query(
        "insert into public.opportunities (company_id) values ($1) returning id, commercial_status, is_saved",
        [company.rows[0].id],
      );
      const opportunityId = opportunity.rows[0].id as string;
      expect(opportunity.rows[0]).toMatchObject({ commercial_status: "nova", is_saved: false });

      expect(
        await errorCode("update public.opportunities set commercial_status = 'convertida' where id = $1", [
          opportunityId,
        ]),
      ).toBe("42501");
      expect(
        await errorCode("select public.change_opportunity_status($1, 'inexistente', null)", [opportunityId]),
      ).toBe("22023");

      await client.query("select public.set_opportunity_saved($1, true)", [opportunityId]);
      await client.query("select public.change_opportunity_status($1, 'contatada', 'Ligação feita')", [
        opportunityId,
      ]);
      expect(
        await errorCode("select public.change_opportunity_status($1, 'contatada', null)", [opportunityId]),
      ).toBe("22023");

      const activities = await client.query(
        `select activity_type, previous_status, new_status, note, user_id
           from public.commercial_activities where opportunity_id = $1 order by created_at, activity_type`,
        [opportunityId],
      );
      expect(activities.rows).toEqual([
        { activity_type: "status_change", previous_status: "nova", new_status: "contatada", note: "Ligação feita", user_id: users.member },
        { activity_type: "saved", previous_status: null, new_status: null, note: null, user_id: users.member },
      ]);

      // Atividade manual de mudança de status é bloqueada (deve usar a função).
      expect(
        await errorCode(
          "insert into public.commercial_activities (opportunity_id, activity_type, new_status) values ($1, 'status_change', 'convertida')",
          [opportunityId],
        ),
      ).toBe("42501");
      await client.query(
        "insert into public.commercial_activities (opportunity_id, activity_type, note) values ($1, 'note', 'Pediu orçamento')",
        [opportunityId],
      );
      expect(await errorCode("delete from public.commercial_activities where opportunity_id = $1", [opportunityId])).toBe(
        "42501",
      );
      expect(
        await errorCode("update public.commercial_activities set note = 'alterada' where opportunity_id = $1", [
          opportunityId,
        ]),
      ).toBe("42501");
    });
  });

  it("configurações: só administradores alteram e o histórico é mantido", async () => {
    await inTransaction(async (users) => {
      // Parte de um estado conhecido, qualquer que seja o banco (desfeito no rollback).
      await client.query("delete from public.system_settings");
      await as(users.member);
      expect(
        await errorCode("insert into public.system_settings (key, value) values ('geo.radius_km', '5')"),
      ).toBe("42501");

      await as(users.admin);
      await client.query("insert into public.system_settings (key, value) values ('geo.radius_km', '5')");
      await client.query("update public.system_settings set value = '8' where key = 'geo.radius_km'");
      const history = await client.query(
        "select previous_value, new_value, changed_by from public.system_settings_history where key = 'geo.radius_km' and changed_by = $1 order by id",
        [users.admin],
      );
      expect(history.rows).toEqual([
        { previous_value: null, new_value: 5, changed_by: users.admin },
        { previous_value: 5, new_value: 8, changed_by: users.admin },
      ]);
    });
  });

  it("versões de pontuação são imutáveis e só uma fica ativa", async () => {
    await inTransaction(async (users) => {
      await as(users.admin);
      expect(await errorCode("update public.scoring_configs set config = '{}' where version = 1")).toBe("42501");
      await client.query(
        "insert into public.scoring_configs (version, config, created_by) values (99, '{\"weights\":{}}', $1)",
        [users.admin],
      );
      await client.query("select public.activate_scoring_config(99)");
      const { rows } = await client.query("select version from public.scoring_configs where is_active");
      expect(rows).toEqual([{ version: 99 }]);

      await as(users.member);
      expect(await errorCode("select public.activate_scoring_config(1)")).toBe("42501");
    });
  });

  it("pontuação v2 aprovada está ativa com nota mínima 60", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      const { rows } = await client.query(
        "select version, approval_state, config->'qualificationMinScore' as min from public.scoring_configs where is_active",
      );
      expect(rows).toEqual([{ version: 2, approval_state: "approved", min: 60 }]);
    });
  });

  it("o banco só aceita configurações conhecidas e bem formadas", async () => {
    await inTransaction(async (users) => {
      await client.query("delete from public.system_settings");
      await as(users.admin);
      const valid = JSON.stringify({ address: "Endereço de teste, 1", latitude: -26.3, longitude: -48.8 });
      expect(await errorCode("insert into public.system_settings (key, value) values ('geo.reference', $1)", [valid])).toBeNull();
      expect(await errorCode("insert into public.system_settings (key, value) values ('geo.radius_km', '10')")).toBeNull();

      const noCoordinates = JSON.stringify({ address: "Endereço de teste, 1" });
      expect(await errorCode("update public.system_settings set value = $1 where key = 'geo.reference'", [noCoordinates])).toBe("23514");
      expect(await errorCode("update public.system_settings set value = '150' where key = 'geo.radius_km'")).toBe("23514");
      expect(await errorCode("update public.system_settings set value = '0' where key = 'geo.radius_km'")).toBe("23514");
      expect(await errorCode("insert into public.system_settings (key, value) values ('chave.desconhecida', '1')")).toBe("23514");
    });
  });

  it("capacidade produtiva: membro registra nova versão, histórico imutável", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      expect(
        await errorCode("insert into public.production_settings (settings, created_by) values ('{\"schemaVersion\": 1}', $1)", [users.member]),
      ).toBeNull();
      expect(
        await errorCode("insert into public.production_settings (settings, created_by) values ('{}', $1)", [users.member]),
      ).toBe("23514");
      expect(
        await errorCode("insert into public.production_settings (settings, created_by) values ('{\"schemaVersion\": 1}', $1)", [users.admin]),
      ).toBe("42501");
      expect(await errorCode("update public.production_settings set settings = '{\"schemaVersion\": 1}'")).toBe("42501");
      expect(await errorCode("delete from public.production_settings")).toBe("42501");

      await as(users.inactive);
      expect(await count("production_settings")).toBe(0);
    });
  });

  it("lista da equipe com e-mail é exclusiva de administradores", async () => {
    await inTransaction(async (users) => {
      await as(users.admin);
      const { rows } = await client.query("select id, email, is_active from public.admin_list_members()");
      const inactive = rows.find((row) => row.id === users.inactive);
      expect(inactive).toMatchObject({ is_active: false });
      expect(inactive.email).toMatch(/^inactive-/);

      await as(users.member);
      expect(await errorCode("select * from public.admin_list_members()")).toBe("42501");
      await as(users.inactive);
      expect(await errorCode("select * from public.admin_list_members()")).toBe("42501");
    });
  });

  it("visão de empresas: distância igual à do domínio, melhor oportunidade e RLS", async () => {
    await inTransaction(async (users) => {
      await client.query("delete from public.system_settings");
      await as(users.admin);
      const reference = { latitude: -26.283, longitude: -48.877018 };
      await client.query("insert into public.system_settings (key, value) values ('geo.reference', $1)", [
        JSON.stringify({ address: "Ponto de teste", ...reference }),
      ]);
      const company = await client.query(
        `insert into public.companies (name, normalized_name, latitude, longitude, location_status)
         values ('Empresa Distância', 'empresa distancia', -26.25, -48.85, 'source_declared') returning id`,
      );
      const companyId = company.rows[0].id as string;
      const noLocation = await client.query(
        "insert into public.companies (name, normalized_name) values ('Sem Local', 'sem local') returning id",
      );
      const idea = await client.query(
        "insert into public.product_ideas (name, normalized_name, origin) values ('Suporte', 'suporte', 'manual') returning id",
      );
      // Notas só são gravadas pelo fluxo de pontuação; aqui o preparo é feito como superusuário.
      await asSuperuser();
      await client.query("insert into public.opportunities (company_id, score, created_by) values ($1, 40, $2)", [companyId, users.admin]);
      await client.query(
        "insert into public.opportunities (company_id, product_idea_id, score, created_by) values ($1, $2, 72, $3)",
        [companyId, idea.rows[0].id, users.admin],
      );
      await as(users.admin);

      const { rows } = await client.query(
        "select distance_km, score, product_name, opportunity_count from public.company_overview where id = $1",
        [companyId],
      );
      const expected = haversineDistanceKm(reference, { latitude: -26.25, longitude: -48.85 });
      expect(Number(rows[0].distance_km)).toBeCloseTo(expected, 2);
      expect(rows[0]).toMatchObject({ product_name: "Suporte", opportunity_count: 2 });
      expect(Number(rows[0].score)).toBe(72);

      const without = await client.query("select distance_km from public.company_overview where id = $1", [noLocation.rows[0].id]);
      expect(without.rows[0].distance_km).toBeNull();

      await as(users.inactive);
      expect(await count("company_overview")).toBe(0);
      await as(null);
      expect(await errorCode("select * from public.company_overview")).toBe("42501");
    });
  });

  it("aceita CNPJ alfanumérico em maiúsculas e recusa outros formatos", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      const insert = (cnpj: string) =>
        errorCode("insert into public.companies (name, normalized_name, cnpj) values ('X', 'x', $1)", [cnpj]);
      expect(await insert("12ABC34501DE35")).toBeNull();
      expect(await insert("12abc34501de35")).toBe("23514");
      expect(await insert("12ABC34501DE3A")).toBe("23514");
      expect(await insert("12ABC34501DE35")).toBe("23505");
    });
  });

  it("uma oportunidade por empresa e produto (inclusive sem produto) e reabertura registrada", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      const company = await client.query(
        "insert into public.companies (name, normalized_name) values ('Empresa Única', 'empresa unica') returning id",
      );
      const companyId = company.rows[0].id as string;
      const first = await client.query("insert into public.opportunities (company_id) values ($1) returning id", [companyId]);
      expect(await errorCode("insert into public.opportunities (company_id) values ($1)", [companyId])).toBe("23505");

      const opportunityId = first.rows[0].id as string;
      await client.query("select public.change_opportunity_status($1, 'descartada', 'Sem interesse')", [opportunityId]);
      await client.query("select public.change_opportunity_status($1, 'para_analisar', 'Voltou a ter interesse')", [opportunityId]);
      const history = await client.query(
        "select previous_status, new_status from public.commercial_activities where opportunity_id = $1 order by created_at, id",
        [opportunityId],
      );
      expect(history.rows).toEqual(
        expect.arrayContaining([
          { previous_status: "nova", new_status: "descartada" },
          { previous_status: "descartada", new_status: "para_analisar" },
        ]),
      );
      // Salvar duas vezes não duplica o histórico.
      await client.query("select public.set_opportunity_saved($1, true)", [opportunityId]);
      await client.query("select public.set_opportunity_saved($1, true)", [opportunityId]);
      const saved = await client.query(
        "select count(*)::int as n from public.commercial_activities where opportunity_id = $1 and activity_type = 'saved'",
        [opportunityId],
      );
      expect(saved.rows[0].n).toBe(1);
    });
  });

  it("resultados de pesquisa e uso da IA: só membros ativos, somente inclusão", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      const session = await client.query(
        "insert into public.research_sessions (created_by, research_type, query) values ($1, 'segment', 'clínicas') returning id",
        [users.member],
      );
      const sessionId = session.rows[0].id as string;
      const company = await client.query(
        "insert into public.companies (name, normalized_name, created_by) values ('Clínica Teste', 'clinica teste', $1) returning id",
        [users.member],
      );
      const companyId = company.rows[0].id as string;
      const opportunity = await client.query(
        "insert into public.opportunities (company_id, research_session_id, created_by) values ($1, $2, $3) returning id",
        [companyId, sessionId, users.member],
      );
      const opportunityId = opportunity.rows[0].id as string;

      await client.query(
        `insert into public.research_session_results (research_session_id, opportunity_id, company_id, source_name, match_reason, rank)
         values ($1, $2, $3, 'Base interna', 'Segmento corresponde', 1)`,
        [sessionId, opportunityId, companyId],
      );
      // A mesma oportunidade não entra duas vezes na mesma pesquisa.
      expect(
        await errorCode(
          `insert into public.research_session_results (research_session_id, opportunity_id, company_id, source_name, match_reason, rank)
           values ($1, $2, $3, 'Base interna', 'Repetida', 2)`,
          [sessionId, opportunityId, companyId],
        ),
      ).toBe("23505");
      await client.query(
        "insert into public.ai_usage_log (provider, model, purpose, research_session_id, status, error_code, created_by) values ('gemini', 'modelo', 'product_ideas', $1, 'failed', 'timeout', $2)",
        [sessionId, users.member],
      );
      // Uso da IA é registrado em nome do próprio usuário.
      expect(
        await errorCode(
          "insert into public.ai_usage_log (provider, model, purpose, status, created_by) values ('gemini', 'modelo', 'product_ideas', 'succeeded', $1)",
          [users.admin],
        ),
      ).toBe("42501");

      // Somente inclusão: nada é alterado nem apagado.
      for (const sql of [
        "update public.research_session_results set rank = 5",
        "delete from public.research_session_results",
        "update public.ai_usage_log set status = 'succeeded'",
        "delete from public.ai_usage_log",
      ]) {
        expect(await errorCode(sql)).toBe("42501");
      }

      const ownRows = async () => {
        const results = await client.query("select count(*)::int as n from public.research_session_results where research_session_id = $1", [sessionId]);
        const usage = await client.query("select count(*)::int as n from public.ai_usage_log where research_session_id = $1", [sessionId]);
        return [results.rows[0].n, usage.rows[0].n];
      };
      await as(users.inactive);
      expect(await count("research_session_results")).toBe(0);
      expect(await count("ai_usage_log")).toBe(0);
      expect(
        await errorCode(
          "insert into public.ai_usage_log (provider, model, purpose, status, created_by) values ('gemini', 'modelo', 'product_ideas', 'succeeded', $1)",
          [users.inactive],
        ),
      ).toBe("42501");

      await as(null);
      expect(await errorCode("select * from public.research_session_results")).toBe("42501");
      expect(await errorCode("select * from public.ai_usage_log")).toBe("42501");

      await as(users.admin);
      expect(await ownRows()).toEqual([1, 1]);
    });
  });

  it("nova execução referencia a pesquisa original sem alterá-la", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      const original = await client.query(
        "insert into public.research_sessions (created_by, research_type, query, status) values ($1, 'product', 'chaveiros', 'ready') returning id",
        [users.member],
      );
      const originalId = original.rows[0].id as string;
      await client.query("update public.research_sessions set status = 'partial', completed_at = now() where id = $1", [originalId]);
      const rerun = await client.query(
        "insert into public.research_sessions (created_by, research_type, query, rerun_of) values ($1, 'product', 'chaveiros', $2) returning id, status",
        [users.member, originalId],
      );
      expect(rerun.rows[0].status).toBe("draft");
      // rerun_of não pode ser trocado depois.
      expect(await errorCode("update public.research_sessions set rerun_of = null where id = $1", [rerun.rows[0].id])).toBe("42501");
      const { rows } = await client.query("select status from public.research_sessions where id = $1", [originalId]);
      expect(rows[0].status).toBe("partial");
    });
  });

  it("etapa 6: uso da IA na avaliação e marcação de empresa nova ou possível duplicidade", async () => {
    await inTransaction(async (users) => {
      await as(users.member);
      const insertUsage = (purpose: string) =>
        errorCode(
          "insert into public.ai_usage_log (provider, model, purpose, status, created_by) values ('gemini', 'modelo', $1, 'succeeded', $2)",
          [purpose, users.member],
        );
      expect(await insertUsage("opportunity_assessment")).toBeNull();
      expect(await insertUsage("outra_finalidade")).toBe("23514");

      const session = await client.query("insert into public.research_sessions (created_by, research_type, query) values ($1, 'segment', 'Dentistas') returning id", [users.member]);
      const company = await client.query("insert into public.companies (name, normalized_name, created_by) values ('Nova', 'nova', $1) returning id", [users.member]);
      const opportunity = await client.query("insert into public.opportunities (company_id, created_by) values ($1, $2) returning id", [company.rows[0].id, users.member]);
      const values = [session.rows[0].id, opportunity.rows[0].id, company.rows[0].id];
      expect(
        await errorCode(
          `insert into public.research_session_results (research_session_id, opportunity_id, company_id, source_name, match_reason, rank, possible_duplicate_url)
           values ($1, $2, $3, 'OpenStreetMap', 'x', 1, 'javascript:alert(1)')`,
          values,
        ),
      ).toBe("23514");
      const { rows } = await client.query(
        `insert into public.research_session_results (research_session_id, opportunity_id, company_id, source_name, match_reason, rank, possible_duplicate_url)
         values ($1, $2, $3, 'OpenStreetMap', 'x', 1, 'https://www.openstreetmap.org/node/1') returning is_new_company`,
        values,
      );
      expect(rows[0].is_new_company).toBe(false);
    });
  });

  describe("revisão de duplicidades (etapa 7)", () => {
    async function setup(users: Users) {
      await as(users.member);
      const company = await client.query(
        "insert into public.companies (name, normalized_name, created_by, city) values ('Ótica Visão', 'otica visao', $1, 'Joinville') returning id",
        [users.member],
      );
      const candidate = {
        name: "Ótica Visão",
        normalized_name: "otica visao",
        segment: "Ótica",
        phone: "(47) 3433-0000",
        phone_normalized: "4734330000",
        city: "Outra Cidade",
        latitude: -26.3,
        longitude: -48.84,
        field_provenance: { name: { status: "source_declared", source: "OpenStreetMap", observedAt: "2026-10-23T00:00:00Z" } },
      };
      const insertReview = (recordId: string) =>
        client.query(
          `insert into public.duplicate_reviews (company_id, source_name, source_record_id, source_url, candidate, reasons)
           values ($1, 'OpenStreetMap', $2, 'https://www.openstreetmap.org/node/1', $3, '{name}') returning id`,
          [company.rows[0].id, recordId, JSON.stringify(candidate)],
        );
      return { companyId: company.rows[0].id as string, insertReview };
    }

    it("mesma empresa: liga o registro e só completa campos vazios, com histórico", async () => {
      await inTransaction(async (users) => {
        const { companyId, insertReview } = await setup(users);
        const review = await insertReview("node/1");
        // O mesmo registro não entra duas vezes na fila.
        expect(await errorCode(
          `insert into public.duplicate_reviews (company_id, source_name, source_record_id, candidate) values ($1, 'OpenStreetMap', 'node/1', '{"name":"X"}')`,
          [companyId],
        )).toBe("23505");
        // A decisão não pode ser gravada diretamente.
        expect(await errorCode("update public.duplicate_reviews set status = 'same_company' where id = $1", [review.rows[0].id])).toBe("42501");

        const { rows } = await client.query("select public.resolve_duplicate_review($1, 'same_company', 'Mesmo endereço') as id", [review.rows[0].id]);
        expect(rows[0].id).toBe(companyId);
        const company = await client.query("select segment, phone_normalized, city, latitude, location_status, field_provenance from public.companies where id = $1", [companyId]);
        expect(company.rows[0]).toMatchObject({ segment: "Ótica", phone_normalized: "4734330000", city: "Joinville", latitude: -26.3, location_status: "source_declared" });
        expect(company.rows[0].field_provenance.segment.source).toBe("OpenStreetMap");
        expect(company.rows[0].field_provenance.city).toBeUndefined();
        const source = await client.query("select company_id from public.company_sources where source_name = 'OpenStreetMap' and source_record_id = 'node/1'");
        expect(source.rows).toEqual([{ company_id: companyId }]);
        const decided = await client.query("select status, decided_by, decision_note from public.duplicate_reviews where id = $1", [review.rows[0].id]);
        expect(decided.rows[0]).toEqual({ status: "same_company", decided_by: users.member, decision_note: "Mesmo endereço" });
        expect(await errorCode("select public.resolve_duplicate_review($1, 'different_company', null)", [review.rows[0].id])).toBe("55000");
      });
    });

    it("empresas diferentes: cadastra a da fonte; inativo e anônimo não acessam", async () => {
      await inTransaction(async (users) => {
        const { companyId, insertReview } = await setup(users);
        const review = await insertReview("node/2");
        expect(await errorCode("select public.resolve_duplicate_review($1, 'pending', null)", [review.rows[0].id])).toBe("22023");

        await as(users.inactive);
        expect(await count("duplicate_reviews")).toBe(0);
        expect(await errorCode("select public.resolve_duplicate_review($1, 'different_company', null)", [review.rows[0].id])).toBe("42501");
        await as(null);
        expect(await errorCode("select * from public.duplicate_reviews")).toBe("42501");

        await as(users.admin);
        const { rows } = await client.query("select public.resolve_duplicate_review($1, 'different_company', null) as id", [review.rows[0].id]);
        expect(rows[0].id).not.toBe(companyId);
        const created = await client.query("select name, city, created_by, location_status from public.companies where id = $1", [rows[0].id]);
        expect(created.rows[0]).toEqual({ name: "Ótica Visão", city: "Outra Cidade", created_by: users.admin, location_status: "source_declared" });
        const source = await client.query("select company_id from public.company_sources where source_record_id = 'node/2'");
        expect(source.rows).toEqual([{ company_id: rows[0].id }]);
      });
    });

    it("recálculo de pontuação fica no histórico da oportunidade", async () => {
      await inTransaction(async (users) => {
        const { companyId } = await setup(users);
        const opportunity = await client.query("insert into public.opportunities (company_id, created_by) values ($1, $2) returning id", [companyId, users.member]);
        // Não é possível inserir esse tipo de atividade diretamente.
        expect(await errorCode(
          "insert into public.commercial_activities (opportunity_id, user_id, activity_type, note) values ($1, $2, 'score_recalculated', 'x')",
          [opportunity.rows[0].id, users.member],
        )).toBe("42501");
        await client.query("select public.record_score_recalculation($1, 'Nota: 60')", [opportunity.rows[0].id]);
        const { rows } = await client.query("select activity_type, user_id, note from public.commercial_activities where opportunity_id = $1", [opportunity.rows[0].id]);
        expect(rows).toEqual([{ activity_type: "score_recalculated", user_id: users.member, note: "Nota: 60" }]);
      });
    });
  });

  describe("invariantes de segurança do banco (etapa 8)", () => {
    const one = async (sql: string) => (await client.query(sql)).rows.map((row) => Object.values(row)[0]);

    it("toda tabela pública tem RLS e o anon não tem privilégio algum", async () => {
      await asSuperuser();
      expect(await one("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity")).toEqual([]);
      expect(await one("select table_name from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'")).toEqual([]);
      expect(
        await one("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')"),
      ).toEqual([]);
    });

    it("funções privilegiadas têm search_path fixo e views respeitam o RLS de quem consulta", async () => {
      await asSuperuser();
      expect(
        await one(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname in ('public', 'private') and p.prosecdef
                     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`),
      ).toEqual([]);
      expect(
        await one(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relkind = 'v'
                     and not coalesce((select bool_or(o in ('security_invoker=true', 'security_invoker=on')) from unnest(c.reloptions) o), false)`),
      ).toEqual([]);
    });

    it("nenhum papel da API apaga dados (RN-10)", async () => {
      await asSuperuser();
      expect(
        await one("select table_name from information_schema.role_table_grants where grantee in ('anon', 'authenticated') and table_schema = 'public' and privilege_type in ('DELETE', 'TRUNCATE')"),
      ).toEqual([]);
    });
  });
});
