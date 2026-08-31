// Edge Function: crea/actualiza usuarios en Supabase Auth + las tablas "PERSONAS",
// "USUARIOS" y "USUARIOS_ROLES" a partir de las filas de un Excel subido desde el
// frontend (ver src/components/Admin/CargaUsuarios.tsx).
//
// Invocación: POST desde el cliente autenticado (supabase.functions.invoke), protegida
// por el JWT normal de Supabase (esta función SÍ requiere verify_jwt, a diferencia de
// migrate-sharepoint-users) más una verificación adicional de que quien llama tiene el
// rol CONTROL_INTERNO activo.
//
// Deploy: supabase functions deploy bulk-create-users
// (sin --no-verify-jwt: el gateway de Supabase debe rechazar solicitudes sin un JWT
// válido antes de que el código de la función se ejecute)

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

type RowStatus = "created" | "updated" | "error";

interface UserRow {
  tipo_documento?: string;
  numero_documento?: string;
  nombres?: string;
  apellidos?: string;
  correo?: string;
  telefono?: string;
  estado?: string;
}

interface RowResult {
  fila: number;
  correo: string;
  status: RowStatus;
  message: string;
}

interface RequestBody {
  rows?: UserRow[];
}

// El Excel puede traer distintos valores de "tipo_persona" (proveedores, socios
// comerciales, aliados, etc.), pero para esta carga masiva el rol asignado en la
// tabla "ROLES" siempre es SOCIO, sin importar lo que diga esa columna.
const FIXED_ROLE = "SOCIO";
const DEFAULT_ESTADO = "ACTIVO";

// Límite defensivo por invocación: cada fila hace varias llamadas secuenciales contra
// Auth/Postgres, así que un archivo enorme podría acercarse al timeout de la Edge
// Function. Si hace falta cargar más, se sube en varios archivos.
const MAX_ROWS = 900;

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// Mismo criterio que migrate-sharepoint-users: SUPABASE_SERVICE_ROLE_KEY quedó
// deprecado a favor de SUPABASE_SECRET_KEYS / SB_STATIC_SECRET_KEY.
function getSupabaseSecretKey(): string {
  const staticKey = Deno.env.get("SB_STATIC_SECRET_KEY");
  if (staticKey) return staticKey;

  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysRaw) {
    const secretKeys = JSON.parse(secretKeysRaw) as Record<string, string>;
    const [firstKey] = Object.values(secretKeys);
    if (firstKey) return firstKey;
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  throw new Error(
    "No se encontró ninguna key válida (SB_STATIC_SECRET_KEY, SUPABASE_SECRET_KEYS o SUPABASE_SERVICE_ROLE_KEY)",
  );
}

// Indexa todos los usuarios de Auth por email (paginando admin.listUsers) una sola vez
// por invocación, para no hacer una consulta por cada fila del Excel.
async function buildAuthUserIndex(
  supabaseAdmin: SupabaseClient,
): Promise<Map<string, { id: string }>> {
  const byEmail = new Map<string, { id: string }>();
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`No se pudo listar usuarios de Auth: ${error.message}`);
    }
    for (const u of data.users) {
      if (u.email) byEmail.set(u.email.toLowerCase(), { id: u.id });
    }
    if (data.users.length < perPage) break;
    page++;
  }

  return byEmail;
}

async function getFixedRoleId(supabaseAdmin: SupabaseClient): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("ROLES")
    .select("id")
    .eq("nombre", FIXED_ROLE)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer la tabla "ROLES": ${error.message}`);
  }
  if (!data) {
    throw new Error(`No se encontró en "ROLES" el rol "${FIXED_ROLE}"`);
  }
  return (data as { id: number }).id;
}

interface UsuarioRolRow {
  ROLES: { nombre: string } | { nombre: string }[] | null;
}

// Verifica, con el mismo patrón de consulta que usa el frontend en AuthContext.tsx,
// que quien invoca esta función tiene el rol CONTROL_INTERNO activo.
async function callerHasControlInternoRole(
  supabaseAdmin: SupabaseClient,
  authUserId: string,
): Promise<boolean> {
  const { data: usuario, error: usuarioError } = await supabaseAdmin
    .from("USUARIOS")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (usuarioError) {
    throw new Error(`No se pudo verificar el usuario que hace la solicitud: ${usuarioError.message}`);
  }
  if (!usuario) return false;

  const { data: roleRows, error: rolesError } = await supabaseAdmin
    .from("USUARIOS_ROLES")
    .select(`
      ROLES!usuarios_roles_id_rol_fkey ( nombre )
    `)
    .eq("id_usuario", usuario.id)
    .eq("estado", "ACTIVO");

  if (rolesError) {
    throw new Error(`No se pudieron verificar los roles del usuario: ${rolesError.message}`);
  }

  const roleNames = ((roleRows ?? []) as UsuarioRolRow[]).flatMap((row) => {
    const related = row.ROLES;
    if (!related) return [];
    return Array.isArray(related) ? related.map((r) => r.nombre) : [related.nombre];
  });

  return roleNames.some((nombre) => String(nombre).toUpperCase() === "CONTROL_INTERNO");
}

function normalizeRow(raw: UserRow) {
  return {
    tipo_documento: raw.tipo_documento?.toString().trim() || null,
    numero_documento: raw.numero_documento?.toString().trim() || "",
    nombres: raw.nombres?.toString().trim() || null,
    apellidos: raw.apellidos?.toString().trim() || null,
    correo: raw.correo?.toString().trim().toLowerCase() || "",
    telefono: raw.telefono?.toString().trim() || null,
    estado: raw.estado?.toString().trim().toUpperCase() || DEFAULT_ESTADO,
  };
}

async function processRow(
  supabaseAdmin: SupabaseClient,
  authUsersByEmail: Map<string, { id: string }>,
  rolId: number,
  raw: UserRow,
  fila: number,
): Promise<RowResult> {
  const row = normalizeRow(raw);

  if (!row.correo) {
    return { fila, correo: "(sin correo)", status: "error", message: "Falta el correo" };
  }
  if (!row.numero_documento) {
    return {
      fila,
      correo: row.correo,
      status: "error",
      message: "Falta el número de documento (se usa como contraseña inicial)",
    };
  }

  try {
    let userId: string;
    let authUserCreated = false;
    const existingAuthUser = authUsersByEmail.get(row.correo);

    if (existingAuthUser) {
      userId = existingAuthUser.id;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: row.correo,
        password: row.numero_documento,
        email_confirm: true,
      });
      if (error) throw new Error(`No se pudo crear el usuario en Auth: ${error.message}`);

      userId = data.user.id;
      authUsersByEmail.set(row.correo, { id: userId });
      authUserCreated = true;
    }

    const { data: existingUsuario, error: usuarioLookupError } = await supabaseAdmin
      .from("USUARIOS")
      .select("id, id_persona")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (usuarioLookupError) {
      throw new Error(`No se pudo consultar "USUARIOS": ${usuarioLookupError.message}`);
    }

    const personaFields = {
      tipo_documento: row.tipo_documento,
      numero_documento: row.numero_documento,
      nombres: row.nombres,
      apellidos: row.apellidos,
      correo: row.correo,
      telefono: row.telefono,
      estado: row.estado,
    };

    let usuarioId: number;

    if (existingUsuario) {
      const { error: personaUpdateError } = await supabaseAdmin
        .from("PERSONAS")
        .update(personaFields)
        .eq("id", existingUsuario.id_persona);
      if (personaUpdateError) {
        throw new Error(`No se pudo actualizar "PERSONAS": ${personaUpdateError.message}`);
      }

      const { error: usuarioUpdateError } = await supabaseAdmin
        .from("USUARIOS")
        .update({
          correo: row.correo,
          estado: row.estado,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", existingUsuario.id);
      if (usuarioUpdateError) {
        throw new Error(`No se pudo actualizar "USUARIOS": ${usuarioUpdateError.message}`);
      }

      usuarioId = existingUsuario.id;
    } else {
      const { data: persona, error: personaInsertError } = await supabaseAdmin
        .from("PERSONAS")
        .insert(personaFields)
        .select("id")
        .single();
      if (personaInsertError) {
        throw new Error(`No se pudo insertar en "PERSONAS": ${personaInsertError.message}`);
      }

      const { data: usuario, error: usuarioInsertError } = await supabaseAdmin
        .from("USUARIOS")
        .insert({
          id_persona: (persona as { id: number }).id,
          auth_user_id: userId,
          correo: row.correo,
          estado: row.estado,
          requiere_cambio_password: true,
        })
        .select("id")
        .single();
      if (usuarioInsertError) {
        throw new Error(`No se pudo insertar en "USUARIOS": ${usuarioInsertError.message}`);
      }

      usuarioId = (usuario as { id: number }).id;
    }

    // Solo se asigna SOCIO si el usuario no tiene ningún rol activo todavía; si ya
    // tiene otro rol (TIENDA, EMPLEADO, CONTROL_INTERNO), se deja como está.
    const { data: activeRoles, error: roleLookupError } = await supabaseAdmin
      .from("USUARIOS_ROLES")
      .select("id_usuario_rol")
      .eq("id_usuario", usuarioId)
      .eq("estado", "ACTIVO");
    if (roleLookupError) {
      throw new Error(`No se pudo consultar "USUARIOS_ROLES": ${roleLookupError.message}`);
    }

    let roleAssigned = false;
    if (!activeRoles || activeRoles.length === 0) {
      const { error: roleInsertError } = await supabaseAdmin
        .from("USUARIOS_ROLES")
        .insert({ id_usuario: usuarioId, id_rol: rolId, estado: "ACTIVO" });
      if (roleInsertError) {
        throw new Error(`No se pudo asignar el rol: ${roleInsertError.message}`);
      }
      roleAssigned = true;
    }

    const status: RowStatus = existingUsuario ? "updated" : "created";
    const message = authUserCreated
      ? "Usuario creado en Auth y en las tablas de la app"
      : existingUsuario
      ? roleAssigned
        ? "Datos actualizados; no tenía rol activo, se le asignó SOCIO"
        : "Datos actualizados"
      : "El usuario ya existía en Auth; se crearon sus filas en PERSONAS/USUARIOS";

    return { fila, correo: row.correo, status, message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { fila, correo: row.correo, status: "error", message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido, use POST" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ error: "No autorizado" }, 401);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'Body inválido, se esperaba JSON con la forma {"rows": [...]}' }, 400);
  }

  const rows: UserRow[] | null = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows || rows.length === 0) {
    return json({ error: 'Falta "rows" (arreglo no vacío)' }, 400);
  }
  if (rows.length > MAX_ROWS) {
    return json(
      { error: `Máximo ${MAX_ROWS} filas por carga, este archivo tiene ${rows.length}. Divídelo en varios archivos.` },
      400,
    );
  }

  let supabaseAdmin: SupabaseClient;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = getSupabaseSecretKey();
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error inicializando el cliente de Supabase:", message);
    return json({ error: message }, 500);
  }

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !callerData?.user) {
    return json({ error: "Sesión inválida o expirada" }, 401);
  }

  try {
    const isAuthorized = await callerHasControlInternoRole(supabaseAdmin, callerData.user.id);
    if (!isAuthorized) {
      return json({ error: "No tienes permisos para crear usuarios" }, 403);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error verificando permisos:", message);
    return json({ error: message }, 500);
  }

  try {
    const [authUsersByEmail, rolId] = await Promise.all([
      buildAuthUserIndex(supabaseAdmin),
      getFixedRoleId(supabaseAdmin),
    ]);

    const results: RowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      // Fila 2 en el Excel: la 1 es el encabezado.
      const result = await processRow(supabaseAdmin, authUsersByEmail, rolId, rows[i], i + 2);
      results.push(result);
    }

    const creados = results.filter((r) => r.status === "created").length;
    const actualizados = results.filter((r) => r.status === "updated").length;
    const errores = results.filter((r) => r.status === "error").length;

    return json({
      total: rows.length,
      creados,
      actualizados,
      errores,
      detalle: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error fatal en la carga masiva:", message);
    return json({ error: message }, 500);
  }
});
