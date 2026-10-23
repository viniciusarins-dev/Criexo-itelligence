// Servidor que imita Overpass, BrasilAPI e Nominatim nos testes E2E (sem rede).
// Os testes definem as respostas por POST em /__mock/*.
import { createServer } from "node:http";

const port = Number(process.env.MOCK_SOURCES_PORT ?? 4010);
const initial = () => ({ overpass: { status: 200, body: { elements: [] } }, cnpj: {}, nominatim: { status: 200, body: [] }, lastOverpassQuery: null });
let state = initial();

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let data = "";
  for await (const chunk of req) data += chunk;
  return data;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const body = req.method === "POST" ? await readBody(req) : "";

  if (url.pathname === "/health") return send(res, 200, { ok: true });
  if (url.pathname === "/__mock/reset") {
    state = initial();
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/__mock/overpass") {
    state.overpass = JSON.parse(body);
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/__mock/cnpj") {
    const { cnpj, ...rest } = JSON.parse(body);
    state.cnpj[cnpj] = rest;
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/__mock/nominatim") {
    state.nominatim = JSON.parse(body);
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/__mock/last") return send(res, 200, { query: state.lastOverpassQuery });

  if (url.pathname === "/api/interpreter" && req.method === "POST") {
    state.lastOverpassQuery = new URLSearchParams(body).get("data");
    return send(res, state.overpass.status, state.overpass.body);
  }
  const cnpj = url.pathname.match(/^\/api\/cnpj\/v1\/(\w+)$/);
  if (cnpj) {
    const fixture = state.cnpj[cnpj[1]];
    return fixture ? send(res, fixture.status, fixture.body) : send(res, 404, { message: "CNPJ não encontrado" });
  }
  if (url.pathname === "/search") return send(res, state.nominatim.status, state.nominatim.body);
  send(res, 404, { message: "rota desconhecida" });
}).listen(port, () => console.log(`mock-sources em http://localhost:${port}`));
