import { RequestValidationError } from "./types.ts";
import { isValidEmail, normalizeCedula, normalizeEmail, normalizeNullableString } from "./utils.ts";
import type { SyncRequestBody } from "./types.ts";

function parsePositiveInteger(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new RequestValidationError(`${fieldName} debe ser un entero positivo`);
  }
  return Number(value);
}

function parseNonNegativeInteger(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new RequestValidationError(`${fieldName} debe ser un entero no negativo`);
  }
  return Number(value);
}

export async function parseRequestBody(request: Request): Promise<SyncRequestBody> {
  const contentLength = request.headers.get("content-length");
  if (contentLength === "0") {
    return {
      dryRun: false,
      email: null,
      cedula: null,
      sharePointItemId: null,
      limit: null,
      offset: null,
      roleId: null,
    };
  }

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new RequestValidationError("El body JSON es invalido");
    }
    return {
      dryRun: false,
      email: null,
      cedula: null,
      sharePointItemId: null,
      limit: null,
      offset: null,
      roleId: null,
    };
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new RequestValidationError("El body debe ser un objeto JSON");
  }

  const body = raw as Record<string, unknown>;
  const dryRun = body.dryRun === undefined ? false : body.dryRun;
  if (typeof dryRun !== "boolean") {
    throw new RequestValidationError("dryRun debe ser boolean");
  }

  const email = body.email === undefined ? null : normalizeEmail(body.email);
  if (body.email !== undefined && body.email !== null && (!email || !isValidEmail(email))) {
    throw new RequestValidationError("email debe tener un formato valido");
  }

  const cedula = body.cedula === undefined ? null : normalizeCedula(body.cedula);
  if (body.cedula !== undefined && body.cedula !== null && !cedula) {
    throw new RequestValidationError("cedula no puede estar vacia");
  }

  const sharePointItemId =
    body.sharePointItemId === undefined ? null : normalizeNullableString(body.sharePointItemId);
  if (body.sharePointItemId !== undefined && body.sharePointItemId !== null && !sharePointItemId) {
    throw new RequestValidationError("sharePointItemId no puede estar vacio");
  }

  return {
    dryRun,
    email,
    cedula,
    sharePointItemId,
    limit: parsePositiveInteger(body.limit, "limit"),
    offset: parseNonNegativeInteger(body.offset, "offset"),
    roleId: parsePositiveInteger(body.roleId, "roleId"),
  };
}

export function validatePasswordAgainstPolicy(
  password: string,
  minimumLength: number,
  passwordRequirements: string,
): string | null {
  if (password.length < minimumLength) {
    return "La cedula no cumple con la longitud minima requerida para la contrasena";
  }

  if (passwordRequirements === "letters_digits") {
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return "La cedula no cumple con la politica de contrasena configurada";
    }
  }

  if (passwordRequirements === "lower_upper_letters_digits") {
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return "La cedula no cumple con la politica de contrasena configurada";
    }
  }

  if (passwordRequirements === "lower_upper_letters_digits_symbols") {
    if (
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return "La cedula no cumple con la politica de contrasena configurada";
    }
  }

  return null;
}
