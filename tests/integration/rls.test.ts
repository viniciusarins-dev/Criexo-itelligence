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
      const company = await client.query(
        "insert into public.companies (name, normalized_name) values ('Empresa View', 'empresa view') returning id",
      );
      await client.query("insert into public.opportunities (company_id) values ($1)", [company.rows[0].id]);
      const visible = await client.query("select total from public.opportunity_status_counts where commercial_status = 'nova'");
      expect(visible.rows).toEqual([{ total: 1 }]);

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
      await client.query("insert into public.research_sessions (research_type, query) values ('segment', 'Oficinas')");
      const { rows } = await client.query("select created_by from public.research_sessions");
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
});
