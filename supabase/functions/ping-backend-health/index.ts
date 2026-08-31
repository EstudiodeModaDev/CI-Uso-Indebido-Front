const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ping-secret",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

const DEFAULT_TARGET_URL =
  "https://uso-indebido-descuento-empleado-backend.onrender.com/api/health/";

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
  const headerSecret = request.headers.get("x-ping-secret");
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
    const pingSecret = getRequiredEnv("PING_HEALTH_SECRET");
    const targetUrl = Deno.env.get("PING_HEALTH_TARGET_URL") ?? DEFAULT_TARGET_URL;

    authorize(request, pingSecret);

    const startedAt = new Date().toISOString();
    const upstreamResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      },
    });

    const responseText = await upstreamResponse.text();

    return buildResponse(
      {
        success: upstreamResponse.ok,
        startedAt,
        targetUrl,
        upstreamStatus: upstreamResponse.status,
        upstreamOk: upstreamResponse.ok,
        responsePreview: responseText.slice(0, 500),
      },
      upstreamResponse.ok ? 200 : 502,
    );
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
