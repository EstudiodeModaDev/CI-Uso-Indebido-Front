// Edge Function: migra usuarios de una lista de SharePoint hacia Supabase Auth
// + tablas "PERSONAS" / "USUARIOS".
//
// Invocación:
//   - Manual: POST con header "x-migration-secret: <MIGRATION_SECRET>"
//   - Cron: pg_cron + pg_net, o Cron de Supabase (ver README.md de esta función)
//
// Deploy: supabase functions deploy migrate-sharepoint-users --no-verify-jwt
// (--no-verify-jwt porque la protección la hace el header propio, no un JWT de Supabase)

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { fetchAllListItems, getGraphToken, SharePointItem } from "./graph.ts";
import { CONFIG, getCedula, getEmail, isActive, mapFields, TableMappingConfig } from "./config.ts";

type ItemStatus =
  | "created"
  | "existing"
  | "deactivated"
  | "reactivated"
  | "skipped"
  | "error";

interface ItemResult {
  email: string;
  status: ItemStatus;
  message: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Indexa TODOS los usuarios de Auth por email (paginando admin.listUsers) una sola vez
// por invocación, para no hacer una consulta por cada item de SharePoint.
async function buildAuthUserIndex(
  supabaseAdmin: SupabaseClient,
  // deno-lint-ignore no-explicit-any
): Promise<Map<string, any>> {
  // deno-lint-ignore no-explicit-any
  const byEmail = new Map<string, any>();
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`No se pudo listar usuarios de Auth: ${error.message}`);
    }
    for (const u of data.users) {
      if (u.email) byEmail.set(u.email.toLowerCase(), u);
    }
    if (data.users.length < perPage) break;
    page++;
  }

  return byEmail;
}

async function logToDb(
  supabaseAdmin: SupabaseClient,
  runId: string,
  status: ItemStatus,
  message: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from(CONFIG.logs.table).insert({
    accion: "Creación de usuario run ID: " + runId,
    entidad: "user_creation",
    resultado: status,
    mensaje: message,
  });
  if (error) {
    // No abortamos la migración por un fallo de logging, solo lo dejamos en consola.
    console.error(`[${runId}] No se pudo escribir el log:`, error.message);
  }
}

// Devuelve el valor de tableConfig.primaryKeyColumn de la fila resultante (tanto si
// insertó como si actualizó), necesario para poder crear después su fila en usuarios_roles.
async function upsertMappedTable(
  supabaseAdmin: SupabaseClient,
  tableConfig: TableMappingConfig,
  item: SharePointItem,
  extraFields: Record<string, unknown>,
): Promise<unknown> {
  const row = mapFields(item, tableConfig.fieldMap);
  Object.assign(row, extraFields);
  const pkColumn = tableConfig.primaryKeyColumn ?? "id";

  const { data, error } = await supabaseAdmin
    .from(tableConfig.table)
    .upsert(row, { onConflict: tableConfig.conflictColumn })
    .select(pkColumn)
    .single();

  if (error) {
    throw new Error(`Upsert en "${tableConfig.table}" falló: ${error.message}`);
  }

  return (data as Record<string, unknown>)[pkColumn];
}

// Asigna el rol por defecto una única vez, solo cuando el usuario se crea por
// primera vez en Auth. Insert simple, sin control de duplicados (no hace falta:
// solo se llama una vez por usuario, en el momento de su creación).
async function insertUsuarioRol(supabaseAdmin: SupabaseClient, usuarioId: unknown): Promise<void> {
  const { error } = await supabaseAdmin.from(CONFIG.usuariosRoles.table).insert({
    id_usuario: usuarioId,
    id_rol: CONFIG.usuariosRoles.defaultRolId,
    estado: CONFIG.usuariosRoles.estadoActivo,
  });

  if (error) {
    throw new Error(`Insert en "${CONFIG.usuariosRoles.table}" falló: ${error.message}`);
  }
}

// Para tablas sin relación con auth.users (ej. PERSONAS): un insert simple,
// sin control de duplicados. Devuelve el valor de su primary key (tableConfig.primaryKeyColumn),
// necesario para tablas dependientes como USUARIOS (columna id_persona).
async function insertMappedTable(
  supabaseAdmin: SupabaseClient,
  tableConfig: TableMappingConfig,
  item: SharePointItem,
): Promise<unknown> {
  const row = mapFields(item, tableConfig.fieldMap);
  const pkColumn = tableConfig.primaryKeyColumn ?? "id";

  const { data, error } = await supabaseAdmin
    .from(tableConfig.table)
    .insert(row)
    .select(pkColumn)
    .single();

  if (error) {
    throw new Error(`Insert en "${tableConfig.table}" falló: ${error.message}`);
  }

  return (data as Record<string, unknown>)[pkColumn];
}

async function processItem(
  supabaseAdmin: SupabaseClient,
  authUsersByEmail: Map<string, any>,
  item: SharePointItem,
  runId: string,
): Promise<ItemResult> {
  const email = getEmail(item);

  if (!email) {
    const message = `Item ${item.id} de SharePoint no tiene email, se omite`;
    console.warn(`[${runId}] ${message}`);
    await logToDb(supabaseAdmin, runId, "error", message);
    return { email: "(sin email)", status: "error", message };
  }

  try {
    const activeInSharePoint = isActive(item);
    const rawActiveValue = item.fields[CONFIG.sharepoint.activeField];
    console.log(
      `[${runId}] ${email}: campo "${CONFIG.sharepoint.activeField}"=${JSON.stringify(rawActiveValue)} -> activo=${activeInSharePoint}`,
    );
    const existingUser = authUsersByEmail.get(email.toLowerCase());

    let userId: string;
    let status: ItemStatus;
    let message: string;

    if (!existingUser && !activeInSharePoint) {
      // Inactivo en SharePoint y todavía no existe en Auth: no tiene sentido
      // crearlo para tener que desactivarlo al toque, se omite por completo.
      const message = "Usuario inactivo en SharePoint y no existe en Auth: se omite";
      console.log(`[${runId}] Omitido: ${email}`);
      await logToDb(supabaseAdmin, runId, "skipped", message);
      return { email, status: "skipped", message };
    }

    if (!existingUser) {
      // --- Usuario nuevo: crear en Auth con password = cédula ---
      const cedula = getCedula(item);
      if (!cedula) {
        throw new Error("No se encontró la cédula (requerida como contraseña inicial)");
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: cedula,
        email_confirm: true,
      });

      if (error) throw new Error(`createUser falló: ${error.message}`);

      userId = data.user.id;
      authUsersByEmail.set(email.toLowerCase(), data.user);
      status = "created";
      message = "Usuario creado en Supabase Auth";
      console.log(`[${runId}] Creado: ${email}`);
    } else {
      // --- Usuario ya existente: solo sincronizar estado activo/inactivo ---
      userId = existingUser.id;
      const isBanned = !!existingUser.banned_until &&
        new Date(existingUser.banned_until) > new Date();

      if (!activeInSharePoint && !isBanned) {
        // Inactivo en SharePoint -> deshabilitar en Supabase (ban largo, no hay "disable" nativo)
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "87600h", // ~10 años
        });
        if (error) throw new Error(`No se pudo desactivar: ${error.message}`);
        status = "deactivated";
        message = "Usuario inactivo en SharePoint: deshabilitado en Auth";
        console.log(`[${runId}] Desactivado: ${email}`);
      } else if (activeInSharePoint && isBanned) {
        // Estaba deshabilitado y volvió a estar activo en SharePoint -> reactivar
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (error) throw new Error(`No se pudo reactivar: ${error.message}`);
        status = "reactivated";
        message = "Usuario reactivado en SharePoint: reactivado en Auth";
        console.log(`[${runId}] Reactivado: ${email}`);
      } else {
        status = "existing";
        message = "Usuario ya existía en Auth, sin cambio de estado";
      }
    }

    // Repartir el resto de los campos en las dos tablas de Postgres, sin importar
    // si el usuario es nuevo o ya existía (para mantenerlas sincronizadas).
    const personaId = await insertMappedTable(supabaseAdmin, CONFIG.tables.personas, item);

    const usuariosExtra: Record<string, unknown> = {
      [CONFIG.tables.usuarios.conflictColumn]: userId,
    };
    if (CONFIG.tables.usuarios.personaIdColumn) {
      usuariosExtra[CONFIG.tables.usuarios.personaIdColumn] = personaId;
    }
    const usuarioId = await upsertMappedTable(supabaseAdmin, CONFIG.tables.usuarios, item, usuariosExtra);

    if (status === "created") {
      await insertUsuarioRol(supabaseAdmin, usuarioId);
    }

    await logToDb(supabaseAdmin, runId, status, message);
    return { email, status, message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${runId}] Error procesando ${email}:`, message);
    await logToDb(supabaseAdmin, runId, "error", message);
    return { email, status: "error", message };
  }
}

// SUPABASE_SERVICE_ROLE_KEY quedó deprecado a favor de SUPABASE_SECRET_KEYS, un
// diccionario JSON con las secret keys activas del proyecto (soporta rotación sin
// downtime), pero el valor auto-inyectado de SUPABASE_SERVICE_ROLE_KEY puede seguir
// presente aunque ya no sea válido para autenticar contra Auth. Por eso primero se
// busca una key fija configurada a mano (SB_STATIC_SECRET_KEY, ver README), y solo
// si no está seteada se cae a las variables automáticas.
function logKeySource(source: string, value: string): void {
  console.log(
    `Usando key de "${source}" (largo=${value.length}, empieza con "${value.slice(0, 8)}...")`,
  );
}

function getSupabaseSecretKey(): string {
  const staticKey = Deno.env.get("SB_STATIC_SECRET_KEY");
  if (staticKey) {
    logKeySource("SB_STATIC_SECRET_KEY", staticKey);
    return staticKey;
  }

  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysRaw) {
    const secretKeys = JSON.parse(secretKeysRaw) as Record<string, string>;
    const [firstKey] = Object.values(secretKeys);
    if (firstKey) {
      logKeySource("SUPABASE_SECRET_KEYS", firstKey);
      return firstKey;
    }
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) {
    logKeySource("SUPABASE_SERVICE_ROLE_KEY (legacy)", legacy);
    return legacy;
  }

  throw new Error(
    "No se encontró ninguna key válida (SB_STATIC_SECRET_KEY, SUPABASE_SECRET_KEYS o SUPABASE_SERVICE_ROLE_KEY)",
  );
}

async function getCursorOffset(supabaseAdmin: SupabaseClient): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from(CONFIG.cursor.table)
    .select("next_offset")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("No se pudo leer el cursor de migración, se inicia en 0:", error.message);
    return 0;
  }
  return data?.next_offset ?? 0;
}

async function setCursorOffset(supabaseAdmin: SupabaseClient, value: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from(CONFIG.cursor.table)
    .upsert({ id: 1, next_offset: value, updated_at: new Date().toISOString() });

  if (error) {
    console.error("No se pudo guardar el cursor de migración:", error.message);
  }
}

Deno.serve(async (req: Request) => {
  // --- 1. Autenticación por secreto compartido (no depende del JWT de Supabase) ---
  const sharedSecret = Deno.env.get("MIGRATION_SECRET");
  const provided = req.headers.get("x-migration-secret");
  if (!sharedSecret || provided !== sharedSecret) {
    return json({ error: "No autorizado" }, 401);
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido, use POST" }, 405);
  }

  // --- 2. Parámetros opcionales de batching (para invocación manual o debugging) ---
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // body vacío es válido (cron/manual sin payload)
  }

  const explicitOffset = typeof body.offset === "number";
  const limit = typeof body.limit === "number" ? body.limit : CONFIG.batch.defaultLimit;

  const runId = crypto.randomUUID();
  const startedAt = performance.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = getSupabaseSecretKey();
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const offset = explicitOffset ? body.offset : await getCursorOffset(supabaseAdmin);

  const results: ItemResult[] = [];
  let created = 0, existing = 0, deactivated = 0, reactivated = 0, skipped = 0, errors = 0;

  try {
    console.log(`[${runId}] Obteniendo token de Microsoft Graph...`);
    const token = await getGraphToken();

    console.log(`[${runId}] Descargando items de la lista de SharePoint...`);
    const items = await fetchAllListItems(token);
    console.log(`[${runId}] Total items en SharePoint: ${items.length} (offset=${offset}, limit=${limit})`);

    console.log(`[${runId}] Indexando usuarios existentes de Supabase Auth...`);
    const authUsersByEmail = await buildAuthUserIndex(supabaseAdmin);
    console.log(`[${runId}] Usuarios existentes en Auth: ${authUsersByEmail.size}`);

    const slice = items.slice(offset, offset + limit);
    let processed = 0;
    let cutOffset: number | null = null;

    for (let i = 0; i < slice.length; i++) {
      // Presupuesto de tiempo interno: cortamos antes del límite real de la Edge Function
      // y devolvemos "nextOffset" para que el cron / la próxima invocación continúe.
      if (performance.now() - startedAt > CONFIG.batch.maxRuntimeMs) {
        cutOffset = offset + i;
        console.warn(`[${runId}] Presupuesto de tiempo agotado, se corta en offset ${cutOffset}`);
        break;
      }

      const result = await processItem(supabaseAdmin, authUsersByEmail, slice[i], runId);
      results.push(result);
      processed++;

      switch (result.status) {
        case "created": created++; break;
        case "existing": existing++; break;
        case "deactivated": deactivated++; break;
        case "reactivated": reactivated++; break;
        case "skipped": skipped++; break;
        case "error": errors++; break;
      }
    }

    const reachedEndOfSlice = cutOffset === null;
    const nextOffset = !reachedEndOfSlice
      ? cutOffset
      : (offset + slice.length < items.length ? offset + slice.length : null);

    // Si no se pasó un offset explícito, persistimos el cursor para que la próxima
    // invocación (cron) continúe donde quedó, o reinicie en 0 si ya barrió toda la lista.
    if (!explicitOffset) {
      await setCursorOffset(supabaseAdmin, nextOffset ?? 0);
    }

    const summary = {
      runId,
      totalEnSharePoint: items.length,
      offset,
      procesados: processed,
      creados: created,
      existentes: existing,
      desactivados: deactivated,
      reactivados: reactivated,
      omitidos: skipped,
      errores: errors,
      erroresDetalle: results
        .filter((r) => r.status === "error")
        .map((r) => ({ email: r.email, mensaje: r.message })),
      done: nextOffset === null,
      nextOffset,
    };

    console.log(`[${runId}] Resumen final:`, JSON.stringify(summary));
    return json(summary, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${runId}] Error fatal en la migración:`, message);
    await logToDb(supabaseAdmin, runId, "error", message);
    return json({ runId, error: message }, 500);
  }
});
