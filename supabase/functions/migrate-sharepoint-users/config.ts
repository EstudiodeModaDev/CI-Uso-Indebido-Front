// Configuración de la migración SharePoint -> Supabase.
// Todo lo que cambia de un entorno/lista a otro vive aquí, separado de la lógica en index.ts.

import type { SharePointItem } from "./graph.ts";

// Un origen puede ser:
//  - el nombre interno de un campo de SharePoint (string), copiado tal cual, o
//  - una función que recibe el item completo y devuelve el valor ya calculado/combinado
//    (útil para concatenar varios campos, formatear fechas, normalizar texto, etc).
export type FieldSource = string | ((item: SharePointItem) => unknown);
export type SharePointFieldMap = Record<string, FieldSource>;

export interface TableMappingConfig {
  table: string;
  conflictColumn: string;
  // destino -> nombre interno del campo en SharePoint (item.fields[...])
  fieldMap: SharePointFieldMap;
  // Columna primary key a capturar tras un insert (para tablas sin FK propio,
  // ej. PERSONAS, cuyo id autogenerado necesita otra tabla como FK).
  primaryKeyColumn?: string;
  // Columna FK hacia PERSONAS.id (solo la usa la tabla que depende de personas).
  personaIdColumn?: string;
}

export const CONFIG = {
  sharepoint: {
    emailField: "email",
    cedulaField: "cedula",
    activeField: "estado_contrato",
    activeTruthyValues: ["Activo"],
  },

  auth: {
    strategy: "password" as const,
  },

  tables: {
    personas: {
      table: "PERSONAS",
      conflictColumn: "",
      primaryKeyColumn: "id",
      fieldMap: {
        numero_documento: "cedula",
        nombres: "nombres",
        apellidos: (item) => [item.fields["primer_apellido"], item.fields["segundo_apellido"]].filter((v) => typeof v === "string" && v.trim()).join(" "),
        correo: "email",
        telefono: "celular",
        estado: (item) => {
          const value = item.fields["estado_contrato"];
          return typeof value === "string" ? value.toUpperCase() : null;
        },
      },
    } satisfies TableMappingConfig,

    usuarios: {
      table: "USUARIOS",
      conflictColumn: "auth_user_id",
      personaIdColumn: "id_persona",
      primaryKeyColumn: "id",
      fieldMap: {
        correo: "email",
        estado: (item) => {
          const value = item.fields["estado_contrato"];
          return typeof value === "string" ? value.toUpperCase() : null;
        }
      },
    } satisfies TableMappingConfig,
  },

  // Rol por defecto que se asigna una única vez, solo cuando se crea el usuario
  // por primera vez en Auth (no en cada corrida). Sin control de duplicados.
  usuariosRoles: {
    table: "USUARIOS_ROLES",
    defaultRolId: 2,
    estadoActivo: "ACTIVO",
  },

  logs: {
    table: "LOG",
  },

  cursor: {
    table: "migration_cursor",
  },

  batch: {
    // Cantidad de items a procesar por invocación cuando no se especifica "limit" en el body.
    defaultLimit: 350,
    // Presupuesto de tiempo interno (ms) para cortar el loop antes del límite real de la Edge Function
    // y devolver un "nextOffset" para continuar en la siguiente invocación/cron tick.
    maxRuntimeMs: 50_000,
  },
};

export function mapFields(
  item: SharePointItem,
  fieldMap: SharePointFieldMap,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [destColumn, source] of Object.entries(fieldMap)) {
    row[destColumn] = typeof source === "function"
      ? source(item) ?? null
      : item.fields[source] ?? null;
  }
  return row;
}

export function getEmail(item: SharePointItem): string | null {
  const value = item.fields[CONFIG.sharepoint.emailField];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getCedula(item: SharePointItem): string | null {
  const value = item.fields[CONFIG.sharepoint.cedulaField];
  return value != null && String(value).trim() ? String(value).trim() : null;
}

export function isActive(item: SharePointItem): boolean {
  const value = item.fields[CONFIG.sharepoint.activeField];
  if (typeof value === "boolean") return value;
  if (value == null) return false;
  return CONFIG.sharepoint.activeTruthyValues.includes(String(value));
}
