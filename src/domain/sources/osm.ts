import { z } from "zod";

import type { CompanyDraft } from "@/domain/companies/company";
import { termMatches } from "@/domain/research/research";
import {
  normalizeBrazilianPhone,
  normalizeCompanyName,
  normalizeWebsiteDomain,
  sanitizeWebsiteUrl,
} from "@/domain/rules/normalization";

/**
 * OpenStreetMap via Overpass API (DP-15). Funções puras: montar a consulta,
 * validar a resposta e converter cada estabelecimento em candidato.
 * Dados do OSM: © colaboradores do OpenStreetMap, licença ODbL.
 */
export const OSM_SOURCE_NAME = "OpenStreetMap";
export const OSM_ATTRIBUTION = "© colaboradores do OpenStreetMap (ODbL)";
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";
/**
 * Política da instância pública: menos de 10.000 consultas/dia no total, e
 * cerca de 1/100 disso para uso regular. Uma consulta por busca.
 */
export const OSM_DAILY_QUERY_LIMIT = 100;

/** Limite diário efetivo: o padrão da política, ou um valor menor/maior definido no ambiente (ex.: instância própria). */
export function osmDailyLimit(envValue: string | undefined): number {
  const parsed = Number(envValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : OSM_DAILY_QUERY_LIMIT;
}
export const OSM_MAX_ELEMENTS = 500;

/** Rótulos em português para as categorias mais comuns (tradução, não classificação comercial). */
export const OSM_CATEGORY_LABELS: Record<string, Record<string, string>> = {
  shop: {
    hardware: "Loja de ferragens",
    doityourself: "Material de construção",
    trade: "Material de construção",
    car_repair: "Oficina mecânica",
    car_parts: "Autopeças",
    car: "Concessionária de veículos",
    motorcycle: "Loja de motos",
    bicycle: "Loja de bicicletas",
    electronics: "Loja de eletrônicos",
    mobile_phone: "Loja de celulares",
    computer: "Loja de informática",
    clothes: "Loja de roupas",
    shoes: "Loja de calçados",
    jewelry: "Joalheria",
    optician: "Ótica",
    gift: "Loja de presentes",
    toys: "Loja de brinquedos",
    stationery: "Papelaria",
    books: "Livraria",
    furniture: "Loja de móveis",
    houseware: "Utilidades domésticas",
    interior_decoration: "Decoração",
    florist: "Floricultura",
    garden_centre: "Garden center",
    pet: "Pet shop",
    bakery: "Padaria",
    butcher: "Açougue",
    supermarket: "Supermercado",
    convenience: "Loja de conveniência",
    beauty: "Salão de beleza",
    hairdresser: "Cabeleireiro",
    cosmetics: "Cosméticos",
    tattoo: "Estúdio de tatuagem",
    copyshop: "Copiadora e gráfica rápida",
    craft: "Artesanato",
    music: "Loja de música",
    musical_instrument: "Instrumentos musicais",
    sports: "Artigos esportivos",
    outdoor: "Artigos de aventura",
    games: "Loja de jogos",
    video_games: "Loja de videogames",
    tools: "Loja de ferramentas",
    paint: "Loja de tintas",
    electrical: "Material elétrico",
    lighting: "Iluminação",
    medical_supply: "Produtos médicos",
    variety_store: "Variedades",
    department_store: "Loja de departamentos",
  },
  amenity: {
    dentist: "Clínica odontológica",
    clinic: "Clínica",
    doctors: "Consultório médico",
    hospital: "Hospital",
    pharmacy: "Farmácia",
    veterinary: "Clínica veterinária",
    restaurant: "Restaurante",
    cafe: "Cafeteria",
    fast_food: "Lanchonete",
    bar: "Bar",
    pub: "Bar",
    ice_cream: "Sorveteria",
    school: "Escola",
    kindergarten: "Educação infantil",
    college: "Faculdade",
    university: "Universidade",
    driving_school: "Autoescola",
    language_school: "Escola de idiomas",
    music_school: "Escola de música",
    training: "Centro de treinamento",
    car_wash: "Lava-car",
    car_rental: "Locadora de veículos",
    fuel: "Posto de combustível",
    bank: "Banco",
    coworking_space: "Coworking",
    events_venue: "Espaço de eventos",
    library: "Biblioteca",
    arts_centre: "Centro cultural",
    childcare: "Creche",
  },
  craft: {
    carpenter: "Marcenaria",
    electrician: "Eletricista",
    plumber: "Encanador",
    metal_construction: "Serralheria",
    sign_maker: "Comunicação visual",
    printer: "Gráfica",
    shoemaker: "Sapateiro",
    tailor: "Alfaiataria",
    jeweller: "Joalheiro",
    upholsterer: "Estofaria",
    photographer: "Fotógrafo",
    electronics_repair: "Conserto de eletrônicos",
    handicraft: "Artesanato",
    brewery: "Cervejaria",
    confectionery: "Confeitaria",
  },
  office: {
    company: "Escritório de empresa",
    accountant: "Contabilidade",
    lawyer: "Advocacia",
    architect: "Arquitetura",
    engineer: "Engenharia",
    estate_agent: "Imobiliária",
    insurance: "Seguradora",
    it: "Tecnologia da informação",
    advertising_agency: "Agência de publicidade",
    telecommunication: "Telecomunicações",
    educational_institution: "Instituição de ensino",
    association: "Associação",
    ngo: "Organização sem fins lucrativos",
    coworking: "Coworking",
  },
  healthcare: {
    dentist: "Clínica odontológica",
    clinic: "Clínica",
    doctor: "Consultório médico",
    physiotherapist: "Fisioterapia",
    laboratory: "Laboratório",
    optometrist: "Optometria",
    psychotherapist: "Psicologia",
    podiatrist: "Podologia",
  },
  leisure: {
    fitness_centre: "Academia",
    sports_centre: "Centro esportivo",
    dance: "Escola de dança",
  },
};

const OSM_KEYS = Object.keys(OSM_CATEGORY_LABELS);
const AMENITY_VALUES = Object.keys(OSM_CATEGORY_LABELS.amenity);
const LEISURE_VALUES = Object.keys(OSM_CATEGORY_LABELS.leisure);

/** Consulta Overpass: estabelecimentos com nome dentro do raio. */
export function buildOverpassQuery(center: { latitude: number; longitude: number }, radiusKm: number, timeoutSeconds = 25): string {
  if (!(radiusKm > 0 && radiusKm <= 50)) throw new RangeError("Raio inválido para a busca no OpenStreetMap.");
  const radius = Math.round(radiusKm * 1000);
  const around = `around:${radius},${center.latitude.toFixed(6)},${center.longitude.toFixed(6)}`;
  const filters = [
    `nwr(${around})["name"]["shop"];`,
    `nwr(${around})["name"]["amenity"~"^(${AMENITY_VALUES.join("|")})$"];`,
    `nwr(${around})["name"]["craft"];`,
    `nwr(${around})["name"]["office"];`,
    `nwr(${around})["name"]["healthcare"];`,
    `nwr(${around})["name"]["leisure"~"^(${LEISURE_VALUES.join("|")})$"];`,
  ];
  return `[out:json][timeout:${timeoutSeconds}];(${filters.join("")});out center tags ${OSM_MAX_ELEMENTS};`;
}

const elementSchema = z.object({
  type: z.enum(["node", "way", "relation"]),
  id: z.number().int().positive(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tags: z.record(z.string(), z.string()).default({}),
});

export const overpassResponseSchema = z.object({
  elements: z.array(z.unknown()),
  remark: z.string().optional(),
});

/** Candidato no mesmo formato do cadastro de empresas, com a localização declarada pela fonte. */
export type OsmCandidate = CompanyDraft & {
  sourceRecordId: string;
  sourceUrl: string;
  /** Texto usado para comparar com os termos da pesquisa. */
  searchText: string;
  latitude: number;
  longitude: number;
};

function category(tags: Record<string, string>): { label: string | null; raw: string[] } {
  const raw: string[] = [];
  let label: string | null = null;
  for (const key of OSM_KEYS) {
    const value = tags[key];
    if (!value) continue;
    raw.push(value.replace(/_/g, " "));
    label ??= OSM_CATEGORY_LABELS[key][value] ?? null;
  }
  return { label, raw };
}

/** Converte um elemento do Overpass; devolve `null` quando falta nome ou posição. */
export function osmElementToCandidate(value: unknown): OsmCandidate | null {
  const parsed = elementSchema.safeParse(value);
  if (!parsed.success) return null;
  const element = parsed.data;
  const name = element.tags.name?.trim();
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!name || latitude === undefined || longitude === undefined) return null;

  const tags = element.tags;
  const { label, raw } = category(tags);
  const websiteTag = tags.website ?? tags["contact:website"];
  const website = websiteTag ? sanitizeWebsiteUrl(websiteTag) : null;
  const phoneTag = (tags.phone ?? tags["contact:phone"])?.split(";")[0]?.trim();
  // Só aceita telefone completo com DDD; nunca completa o número.
  const phoneNormalized = phoneTag ? normalizeBrazilianPhone(phoneTag) : null;
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ");
  const postal = tags["addr:postcode"]?.replace(/\D/g, "");
  const state = tags["addr:state"]?.trim().toUpperCase();

  return {
    sourceRecordId: `${element.type}/${element.id}`,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    name: name.slice(0, 200),
    normalizedName: normalizeCompanyName(name),
    cnpj: null,
    segment: label,
    searchText: [label, ...raw, tags.cuisine?.replace(/[_;]/g, " "), tags.description].filter(Boolean).join(" "),
    website,
    websiteDomain: website ? normalizeWebsiteDomain(website) : null,
    phone: phoneNormalized ? phoneTag! : null,
    phoneNormalized,
    address: street || null,
    neighborhood: tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? null,
    city: tags["addr:city"] ?? null,
    state: state && /^[A-Z]{2}$/.test(state) ? state : null,
    postalCode: postal && postal.length === 8 ? postal : null,
    latitude,
    longitude,
    locationStatus: "source_declared",
  };
}

export type OsmMatch = OsmCandidate & { reason: string; strength: number };

/** Estabelecimentos do OSM que correspondem aos termos (categoria vale mais que nome). */
export function matchOsmCandidates(candidates: OsmCandidate[], terms: string[]): OsmMatch[] {
  const matches: OsmMatch[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.sourceRecordId)) continue;
    seen.add(candidate.sourceRecordId);
    const categoryTerm = terms.find((term) => termMatches(term, candidate.searchText));
    const nameTerm = categoryTerm ? undefined : terms.find((term) => termMatches(term, candidate.name));
    if (!categoryTerm && !nameTerm) continue;
    matches.push({
      ...candidate,
      strength: categoryTerm ? 2 : 1,
      reason: categoryTerm
        ? `Categoria no OpenStreetMap${candidate.segment ? ` (“${candidate.segment}”)` : ""} corresponde à pesquisa`
        : `Nome do estabelecimento contém “${nameTerm}”`,
    });
  }
  return matches;
}
