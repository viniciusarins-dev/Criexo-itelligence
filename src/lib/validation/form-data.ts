/** Leitura tolerante de campos de formulário (aceita vírgula decimal). */

export function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function readNumberOrNull(formData: FormData, name: string): number | null {
  const text = readText(formData, name).replace(/\s/g, "").replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function readChecked(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

export function readEnumOrNull<T extends string>(formData: FormData, name: string, values: readonly T[]): T | null {
  const text = readText(formData, name);
  return (values as readonly string[]).includes(text) ? (text as T) : null;
}

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Muda a cada envio, para o cliente reagir mesmo com a mesma mensagem. */
  submittedAt?: number;
  /**
   * Valores enviados, devolvidos em caso de erro. O React reinicia o
   * formulário após a action; sem isso, o usuário perderia o que digitou.
   */
  values?: FormValues;
};

export type FormValues = Record<string, string | string[]>;

export function formValues(formData: FormData): FormValues {
  const values: FormValues = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = formData.getAll(key).filter((item): item is string => typeof item === "string");
    values[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return values;
}

/** Valor padrão de um campo: o que foi enviado (após erro) ou o valor salvo. */
export function pick(values: FormValues | undefined, name: string, fallback: string | number | null | undefined): string {
  const sent = values?.[name];
  if (typeof sent === "string") return sent;
  return fallback === null || fallback === undefined ? "" : String(fallback);
}

/** Estado de checkbox: o que foi enviado (após erro) ou o valor salvo. */
export function pickChecked(values: FormValues | undefined, name: string, fallback: boolean, value = "on"): boolean {
  if (!values) return fallback;
  const sent = values[name];
  return Array.isArray(sent) ? sent.includes(value) : sent === value;
}

export const IDLE: ActionState = { status: "idle" };
