import { describe, expect, it } from "vitest";

import {
  normalizeBrazilianPhone,
  normalizeCnpj,
  normalizeCompanyName,
  normalizeWebsiteDomain,
  sanitizeWebsiteUrl,
} from "@/domain/rules/normalization";

describe("normalizeCompanyName", () => {
  it("remove acentos, pontuação e sufixos societários", () => {
    expect(normalizeCompanyName("Oficina São José Ltda.")).toBe("oficina sao jose");
    expect(normalizeCompanyName("AUTO PEÇAS & CIA S/A")).toBe("auto pecas e");
    expect(normalizeCompanyName("  Comércio   Joinville - ME ")).toBe("comercio joinville");
  });

  it("mantém um nome composto apenas por sufixo", () => {
    expect(normalizeCompanyName("ME")).toBe("me");
  });
});

describe("normalizeBrazilianPhone", () => {
  it("aceita números com DDD e remove o código do país", () => {
    expect(normalizeBrazilianPhone("(47) 3433-0000")).toBe("4734330000");
    expect(normalizeBrazilianPhone("+55 47 99999-0000")).toBe("47999990000");
    expect(normalizeBrazilianPhone("047 3433-0000")).toBe("4734330000");
  });

  it("não completa números sem DDD", () => {
    expect(normalizeBrazilianPhone("3433-0000")).toBeNull();
    expect(normalizeBrazilianPhone("")).toBeNull();
  });
});

describe("sanitizeWebsiteUrl / normalizeWebsiteDomain", () => {
  it("aceita http/https e adiciona https quando falta o protocolo", () => {
    expect(sanitizeWebsiteUrl("exemplo.com.br")).toBe("https://exemplo.com.br/");
    expect(sanitizeWebsiteUrl("http://exemplo.com.br/contato#topo")).toBe("http://exemplo.com.br/contato");
  });

  it("rejeita protocolos perigosos, credenciais e hosts inválidos", () => {
    expect(sanitizeWebsiteUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeWebsiteUrl("ftp://exemplo.com")).toBeNull();
    expect(sanitizeWebsiteUrl("https://user:pass@exemplo.com")).toBeNull();
    expect(sanitizeWebsiteUrl("localhost")).toBeNull();
    expect(sanitizeWebsiteUrl("   ")).toBeNull();
  });

  it("normaliza o domínio sem www", () => {
    expect(normalizeWebsiteDomain("https://WWW.Exemplo.com.br/loja")).toBe("exemplo.com.br");
  });
});

describe("normalizeCnpj", () => {
  it("aceita CNPJ com dígitos verificadores válidos", () => {
    // CNPJ de exemplo, gerado apenas para validar o algoritmo.
    expect(normalizeCnpj("11.222.333/0001-81")).toBe("11222333000181");
  });

  it("rejeita dígitos inválidos, repetidos ou tamanho incorreto", () => {
    expect(normalizeCnpj("11.222.333/0001-82")).toBeNull();
    expect(normalizeCnpj("00000000000000")).toBeNull();
    expect(normalizeCnpj("123")).toBeNull();
  });
});
