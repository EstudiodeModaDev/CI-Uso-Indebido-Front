import { createClient } from "npm:@supabase/supabase-js@2";
import { AuthService } from "./auth.service.ts";
import { loadConfig } from "./config.ts";
import { DatabaseService } from "./database.service.ts";
import { GraphService } from "./graph.service.ts";
import { LogService } from "./log.service.ts";
import { SyncService } from "./sync.service.ts";
import {
  AppError,
  AuthorizationError,
  RequestValidationError,
} from "./types.ts";
import { buildEmptyResponse, buildJsonResponse, getBearerToken, sanitizeErrorMessage } from "./utils.ts";
import { parseRequestBody } from "./validators.ts";

function authorize(request: Request, expectedSecret: string): void {
  const bearerToken = getBearerToken(request.headers.get("authorization"));
  const headerSecret = request.headers.get("x-migration-secret");
  const providedSecret = bearerToken ?? headerSecret;

  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new AuthorizationError();
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return buildEmptyResponse();
  }

  if (request.method !== "POST") {
    return buildJsonResponse({ success: false, error: "Metodo no permitido" }, 405);
  }

  try {
    const config = loadConfig();
    authorize(request, config.migrationSecret);

    const body = await parseRequestBody(request);
    const roleId = body.roleId ?? config.defaultRoleId;

    if (!Number.isInteger(roleId) || roleId <= 0) {
      throw new RequestValidationError("roleId debe ser un entero positivo");
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const databaseService = new DatabaseService(supabase);
    const logService = new LogService(databaseService);
    const authService = new AuthService(supabase, config);
    const graphService = new GraphService(config);
    const syncService = new SyncService(graphService, authService, databaseService, logService);

    const startedAt = new Date().toISOString();
    const response = await syncService.run({
      dryRun: body.dryRun,
      filters: body,
      startedAt,
      roleId,
    });

    return buildJsonResponse(response, 200);
  } catch (error) {
    if (error instanceof AppError) {
      const responseBody = {
        success: false,
        error: error.message,
        code: error.code,
      };
      return buildJsonResponse(responseBody, error.status);
    }

    const message = sanitizeErrorMessage(error);
    return buildJsonResponse(
      {
        success: false,
        error: message,
      },
      500,
    );
  }
});
