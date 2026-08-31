import type { NormalizedSharePointRecord, PublicStatus } from "./types.ts";

export const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-migration-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export function buildJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: CORS_HEADERS,
  });
}

export function buildEmptyResponse(status = 204): Response {
  return new Response(null, {
    status,
    headers: CORS_HEADERS,
  });
}

export function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeEmail(value: unknown): string | null {
  const normalized = normalizeNullableString(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function normalizeCedula(value: unknown): string | null {
  return normalizeNullableString(value);
}

export function normalizePhone(value: unknown): string | null {
  return normalizeNullableString(value);
}

export function joinLastNames(
  firstLastName: string | null,
  secondLastName: string | null,
): string | null {
  const parts = [firstLastName, secondLastName]
    .map((part) => normalizeNullableString(part))
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" ") : null;
}

export function removeDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeComparableText(value: unknown): string | null {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return null;
  }
  return removeDiacritics(normalized).toLowerCase().replace(/\s+/g, " ").trim();
}

export function isActiveContract(estadoContrato: unknown): boolean | null {
  const normalized = normalizeComparableText(estadoContrato);
  if (!normalized) {
    return null;
  }

  const activeValues = new Set(["activo", "active", "habilitado", "true", "1", "si"]);
  const inactiveValues = new Set([
    "inactivo",
    "inactive",
    "deshabilitado",
    "false",
    "0",
    "no",
    "terminado",
    "retirado",
  ]);

  if (activeValues.has(normalized)) {
    return true;
  }
  if (inactiveValues.has(normalized)) {
    return false;
  }
  return null;
}

export function maskDocument(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= 4) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function areSameNullable(a: unknown, b: unknown): boolean {
  return normalizeNullableString(a) === normalizeNullableString(b);
}

export function areSameEmail(a: unknown, b: unknown): boolean {
  return normalizeEmail(a) === normalizeEmail(b);
}

export function normalizePublicStatus(value: unknown): PublicStatus | null {
  const normalized = normalizeComparableText(value);
  if (normalized === "activo") {
    return "ACTIVO";
  }
  if (normalized === "inactivo") {
    return "INACTIVO";
  }
  return null;
}

export function normalizeSharePointRecord(item: { id: string; fields: Record<string, unknown> }): NormalizedSharePointRecord {
  const primerApellido = normalizeNullableString(item.fields.primer_apellido);
  const segundoApellido = normalizeNullableString(item.fields.segundo_apellido);
  const active = isActiveContract(item.fields.estado_contrato);

  return {
    sourceId: item.id,
    cedula: normalizeCedula(item.fields.cedula),
    nombres: normalizeNullableString(item.fields.nombres),
    primerApellido,
    segundoApellido,
    apellidos: joinLastNames(primerApellido, segundoApellido),
    telefono: normalizePhone(item.fields.telefono),
    email: normalizeEmail(item.fields.email),
    estadoContratoRaw: item.fields.estado_contrato,
    isActiveContract: active,
    publicStatus: active === true ? "ACTIVO" : active === false ? "INACTIVO" : null,
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createAbortSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

export function getBearerToken(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() ?? null;
}

export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function toSerializableMessage(message: string | Record<string, unknown>): string {
  return typeof message === "string" ? message : JSON.stringify(message);
}
