import { ConfigError } from "./types.ts";
import type { EnvConfig } from "./types.ts";

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new ConfigError(name);
  }
  return value;
}

function parsePositiveInt(raw: string, variableName: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ConfigError(variableName);
  }
  return parsed;
}

function getSupabaseServiceRoleKey(): string {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) {
    return direct;
  }

  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeysRaw) {
    throw new ConfigError("SUPABASE_SERVICE_ROLE_KEY");
  }

  try {
    const secretKeys = JSON.parse(secretKeysRaw) as Record<string, string>;
    const firstKey = Object.values(secretKeys)[0];
    if (!firstKey) {
      throw new Error("No default secret key");
    }
    return firstKey;
  } catch {
    throw new ConfigError("SUPABASE_SERVICE_ROLE_KEY");
  }
}

export function loadConfig(): EnvConfig {
  const defaultRoleIdRaw = requireEnv("DEFAULT_ROLE_ID");
  const graphTimeoutMsRaw = Deno.env.get("GRAPH_TIMEOUT_MS");
  const authMinimumPasswordLengthRaw = Deno.env.get("AUTH_MINIMUM_PASSWORD_LENGTH");

  return {
    msTenantId: requireEnv("MS_TENANT_ID"),
    msClientId: requireEnv("MS_CLIENT_ID"),
    msClientSecret: requireEnv("MS_CLIENT_SECRET"),
    msSiteId: requireEnv("MS_SITE_ID"),
    msListId: requireEnv("MS_LIST_ID"),
    migrationSecret: requireEnv("MIGRATION_SECRET"),
    supabaseUrl: requireEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: getSupabaseServiceRoleKey(),
    defaultRoleId: parsePositiveInt(defaultRoleIdRaw, "DEFAULT_ROLE_ID"),
    graphTimeoutMs: graphTimeoutMsRaw ? parsePositiveInt(graphTimeoutMsRaw, "GRAPH_TIMEOUT_MS") : 15000,
    authMinimumPasswordLength: authMinimumPasswordLengthRaw
      ? parsePositiveInt(authMinimumPasswordLengthRaw, "AUTH_MINIMUM_PASSWORD_LENGTH")
      : 6,
    authPasswordRequirements: Deno.env.get("AUTH_PASSWORD_REQUIREMENTS") ?? "",
  };
}
