// Utilidades determinísticas do motor: gerador pseudoaleatório com semente,
// CNPJ, datas MMAAAA, normalização de texto e hash simples.

// mulberry32: rápido, determinístico, suficiente para simulação.
export function prng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sementeDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const soDigitos = (s: string) => (s ?? "").replace(/\D/g, "");

// Dígitos verificadores do CNPJ (módulo 11).
function dvCnpj(base: string): string {
  const calc = (nums: string, pesos: number[]) => {
    const soma = nums.split("").reduce((t, d, i) => t + Number(d) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${d1}${d2}`;
}

export function cnpjValido(cnpj: string): boolean {
  const d = soDigitos(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  return dvCnpj(d.slice(0, 12)) === d.slice(12);
}

// Monta um CNPJ válido a partir da raiz (8) e do complemento (4).
export function montarCnpj(raiz: string, complemento = "0001"): string {
  const base = raiz.padStart(8, "0").slice(0, 8) + complemento.padStart(4, "0").slice(0, 4);
  return base + dvCnpj(base);
}

export function formatarCnpj(cnpj: string): string {
  const d = soDigitos(cnpj).padStart(14, "0");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export const raizCnpj = (cnpj: string) => soDigitos(cnpj).slice(0, 8);

// Remove acentos e caracteres fora do ASCII (arquivo texto de largura fixa).
export function semAcento(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, " ");
}

// MMAAAA a partir de um Date
export function mmaaaa(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;
}
// "MM/AAAA" ↔ "MMAAAA"
export const competenciaParaMmaaaa = (c: string) => c.replace("/", "");
export const mmaaaaParaCompetencia = (m: string) => (m.length === 6 ? `${m.slice(0, 2)}/${m.slice(2)}` : m);

export function mesesAtras(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() - n, 1);
}

// Hash curto (hex) para trilha de auditoria e idempotência (não criptográfico).
export function hashCurto(texto: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0")).toUpperCase();
}

export function correlationId(prefixo = "CRH"): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, "0");
  return `${prefixo}-${t}-${r}`;
}

export const brlInt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(v));
