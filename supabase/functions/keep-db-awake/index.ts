import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-keep-awake-secret",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

function buildResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

function authorize(request: Request, expectedSecret: string): void {
  const bearer = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-keep-awake-secret");
  const bearerSecret = bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : null;
  const providedSecret = bearerSecret ?? headerSecret;

  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new Error("No autorizado");
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return buildResponse(
      {
        success: false,
        error: "Metodo no permitido",
      },
      405,
    );
  }

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseServiceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const keepAwakeSecret = getRequiredEnv("KEEP_AWAKE_SECRET");

    authorize(request, keepAwakeSecret);

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const startedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("LOG")
      .select("*")
      .limit(1);

    if (error) {
      throw new Error(`No se pudo consultar LOG: ${error.message}`);
    }

    return buildResponse({
      success: true,
      message: "Base de datos consultada correctamente",
      startedAt,
      checkedTable: "LOG",
      rowsRead: data?.length ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    const status = message === "No autorizado" ? 401 : 500;

    return buildResponse(
      {
        success: false,
        error: message,
      },
      status,
    );
  }
});
