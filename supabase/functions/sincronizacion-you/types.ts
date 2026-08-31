import type { User } from "npm:@supabase/supabase-js@2";

export type PublicStatus = "ACTIVO" | "INACTIVO";
export type LogResult = "EXITOSO" | "ERROR" | "OMITIDO" | "SIN_CAMBIOS" | "SIMULADO";
export type LogEntity =
  | "SINCRONIZACION_YOU"
  | "SHAREPOINT"
  | "AUTH_USERS"
  | "PERSONAS"
  | "USUARIOS"
  | "USUARIOS_ROLES";
export type LogAction =
  | "SINCRONIZACION_INICIADA"
  | "SINCRONIZACION_FINALIZADA"
  | "USUARIO_CREADO"
  | "USUARIO_ACTUALIZADO"
  | "USUARIO_DESHABILITADO"
  | "USUARIO_REACTIVADO"
  | "ROL_ASIGNADO"
  | "ROL_ACTUALIZADO"
  | "REGISTRO_REPARADO"
  | "REGISTRO_OMITIDO"
  | "ERROR_VALIDACION"
  | "ERROR_SHAREPOINT"
  | "ERROR_AUTH"
  | "ERROR_BASE_DATOS"
  | "COMPENSACION_EJECUTADA"
  | "ERROR_COMPENSACION";

export interface EnvConfig {
  msTenantId: string;
  msClientId: string;
  msClientSecret: string;
  msSiteId: string;
  msListId: string;
  migrationSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  defaultRoleId: number;
  graphTimeoutMs: number;
  authMinimumPasswordLength: number;
  authPasswordRequirements: string;
}

export interface SyncRequestBody {
  dryRun: boolean;
  email: string | null;
  cedula: string | null;
  sharePointItemId: string | null;
  limit: number | null;
  offset: number | null;
  roleId: number | null;
}

export interface SharePointListItemFields {
  cedula?: unknown;
  nombres?: unknown;
  primer_apellido?: unknown;
  segundo_apellido?: unknown;
  telefono?: unknown;
  email?: unknown;
  estado_contrato?: unknown;
  [key: string]: unknown;
}

export interface SharePointItem {
  id: string;
  fields: SharePointListItemFields;
}

export interface GraphListResponse {
  value: Array<{
    id: string;
    fields?: SharePointListItemFields;
  }>;
  "@odata.nextLink"?: string;
}

export interface GraphTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface NormalizedSharePointRecord {
  sourceId: string;
  cedula: string | null;
  nombres: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  apellidos: string | null;
  telefono: string | null;
  email: string | null;
  estadoContratoRaw: unknown;
  isActiveContract: boolean | null;
  publicStatus: PublicStatus | null;
}

export interface PersonaRow {
  id: string;
  tipo_documento: string | null;
  numero_documento: string;
  nombres: string | null;
  apellidos: string | null;
  correo: string;
  telefono: string | null;
  estado: string | null;
  created_at: string;
  fecha_actualizacion: string | null;
}

export interface UsuarioRow {
  id: number;
  id_persona: string;
  correo: string;
  estado: string | null;
  requiere_cambio_password: boolean | null;
  intentos_fallidos: number | null;
  ultimo_ingreso: string | null;
  fecha_creacion: string | null;
  fecha_actualizacion: string | null;
  auth_user_id: string;
}

export interface UsuarioRolRow {
  id_usuario_rol: number;
  id_usuario: number | null;
  id_rol: number | null;
  estado: string | null;
  fecha_asignacion: string | null;
}

export interface LogWriteInput {
  usuario: number | null;
  accion: LogAction;
  entidad: LogEntity;
  resultado: LogResult;
  mensaje: string | Record<string, unknown>;
}

export interface ProcessingIssue {
  sourceId: string;
  numeroDocumento: string | null;
  email: string | null;
  message: string;
}

export interface SyncSummary {
  sharePointRecords: number | null;
  processed: number;
  created: number;
  updated: number;
  disabled: number;
  reactivated: number;
  repaired: number;
  unchanged: number;
  skipped: number;
  errors: number;
}

export interface SyncResponseBody {
  success: boolean;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  filters: {
    email: string | null;
    cedula: string | null;
    sharePointItemId: string | null;
    limit: number | null;
    offset: number | null;
    roleId: number;
  };
  cursor: {
    source: "default" | "manual" | "stored";
    offsetUsed: number;
    nextOffset: number;
    hasMore: boolean;
    batchSize: number;
  };
  summary: SyncSummary;
  partialErrors: boolean;
  errors: ProcessingIssue[];
}

export interface LocatedIdentity {
  persona: PersonaRow | null;
  usuario: UsuarioRow | null;
  authUser: User | null;
  authUserByEmail: User | null;
}

export interface ProcessRecordResult {
  kind: "created" | "updated" | "disabled" | "reactivated" | "repaired" | "unchanged" | "skipped" | "error";
  issue?: ProcessingIssue;
}

export interface SyncRunOptions {
  dryRun: boolean;
  filters: SyncRequestBody;
  startedAt: string;
  roleId: number;
}

export interface GraphBatchResult {
  items: SharePointItem[];
  totalAvailable: number | null;
  hasMore: boolean;
  nextOffset: number;
  offsetUsed: number;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 500, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export class ConfigError extends AppError {
  constructor(variableName: string) {
    super(variableName, 500, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "No autorizado") {
    super(message, 401, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

export class RequestValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "REQUEST_VALIDATION_ERROR");
    this.name = "RequestValidationError";
  }
}

export class MicrosoftOAuthError extends AppError {
  constructor(message = "No se pudo obtener el token de Microsoft Graph") {
    super(message, 502, "MICROSOFT_OAUTH_ERROR");
    this.name = "MicrosoftOAuthError";
  }
}

export class MicrosoftGraphError extends AppError {
  constructor(message = "No se pudo consultar SharePoint") {
    super(message, 502, "MICROSOFT_GRAPH_ERROR");
    this.name = "MicrosoftGraphError";
  }
}

export class SupabaseAuthError extends AppError {
  constructor(message = "Error en Supabase Auth") {
    super(message, 500, "SUPABASE_AUTH_ERROR");
    this.name = "SupabaseAuthError";
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Error en base de datos") {
    super(message, 500, "DATABASE_ERROR");
    this.name = "DatabaseError";
  }
}

export class CompensationError extends AppError {
  constructor(message = "Error de compensacion") {
    super(message, 500, "COMPENSATION_ERROR");
    this.name = "CompensationError";
  }
}
