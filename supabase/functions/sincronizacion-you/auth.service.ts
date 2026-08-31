import type { EnvConfig, NormalizedSharePointRecord, PublicStatus } from "./types.ts";
import { SupabaseAuthError } from "./types.ts";
import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2";

export class AuthService {
  private readonly usersByEmail = new Map<string, User>();
  private readonly usersById = new Map<string, User>();
  private readonly scannedEmails = new Set<string>();
  private nextPageToScan = 1;
  private fullyScanned = false;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly config: EnvConfig,
  ) {}

  async loadUserIndex(): Promise<void> {
    while (!this.fullyScanned) {
      await this.scanNextUsersPage();
    }
  }

  async findUserByEmail(email: string | null): Promise<User | null> {
    if (!email) {
      return null;
    }
    const normalizedEmail = email.toLowerCase();
    const cached = this.usersByEmail.get(normalizedEmail);
    if (cached) {
      return cached;
    }

    if (this.scannedEmails.has(normalizedEmail) || this.fullyScanned) {
      return null;
    }

    while (!this.fullyScanned) {
      await this.scanNextUsersPage();
      const discovered = this.usersByEmail.get(normalizedEmail);
      if (discovered) {
        return discovered;
      }
    }

    this.scannedEmails.add(normalizedEmail);
    return null;
  }

  async getUserById(id: string | null): Promise<User | null> {
    if (!id) {
      return null;
    }

    const cached = this.usersById.get(id);
    if (cached) {
      return cached;
    }

    const { data, error } = await this.supabase.auth.admin.getUserById(id);
    if (error) {
      if (error.message.toLowerCase().includes("user not found")) {
        return null;
      }
      throw new SupabaseAuthError(`No se pudo consultar el usuario ${id}: ${error.message}`);
    }

    this.rememberUser(data.user);
    return data.user;
  }

  async createUser(record: NormalizedSharePointRecord): Promise<User> {
    const { data, error } = await this.supabase.auth.admin.createUser({
      email: record.email ?? undefined,
      password: record.cedula ?? undefined,
      email_confirm: true,
      user_metadata: {
        nombres: record.nombres,
        apellidos: record.apellidos,
        numero_documento: record.cedula,
        origen: "SHAREPOINT_YOU",
        estado: "ACTIVO",
        requiere_cambio_password: true,
      },
    });

    if (error || !data.user) {
      throw new SupabaseAuthError(error?.message ?? "No se pudo crear el usuario en Auth");
    }

    this.rememberUser(data.user);
    return data.user;
  }

  async updateUser(
    userId: string,
    payload: {
      email?: string;
      userMetadata?: Record<string, unknown>;
      banDuration?: string;
    },
  ): Promise<User> {
    const updatePayload: {
      email?: string;
      user_metadata?: Record<string, unknown>;
      ban_duration?: string;
    } = {};

    if (payload.email !== undefined) {
      updatePayload.email = payload.email;
    }
    if (payload.userMetadata !== undefined) {
      updatePayload.user_metadata = payload.userMetadata;
    }
    if (payload.banDuration !== undefined) {
      updatePayload.ban_duration = payload.banDuration;
    }

    const { data, error } = await this.supabase.auth.admin.updateUserById(userId, updatePayload);
    if (error || !data.user) {
      throw new SupabaseAuthError(error?.message ?? "No se pudo actualizar el usuario en Auth");
    }

    this.rememberUser(data.user);
    return data.user;
  }

  async disableUser(user: User, record: NormalizedSharePointRecord): Promise<User> {
    return await this.updateUser(user.id, {
      banDuration: "876000h",
      userMetadata: this.buildManagedMetadata(user, record, "INACTIVO", {
        deshabilitado_por: "SINCRONIZACION_YOU",
      }),
    });
  }

  async reactivateUser(user: User, record: NormalizedSharePointRecord): Promise<User> {
    return await this.updateUser(user.id, {
      banDuration: "none",
      userMetadata: this.buildManagedMetadata(user, record, "ACTIVO", {
        deshabilitado_por: null,
      }),
    });
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.deleteUser(userId);
    if (error) {
      throw new SupabaseAuthError(`No se pudo eliminar el usuario de Auth: ${error.message}`);
    }
    this.usersById.delete(userId);
    for (const [email, user] of this.usersByEmail.entries()) {
      if (user.id === userId) {
        this.usersByEmail.delete(email);
      }
    }
  }

  isBanned(user: User | null): boolean {
    if (!user?.banned_until) {
      return false;
    }
    const bannedUntil = new Date(user.banned_until);
    return !Number.isNaN(bannedUntil.getTime()) && bannedUntil.getTime() > Date.now();
  }

  buildManagedMetadata(
    user: User | null,
    record: NormalizedSharePointRecord,
    estado: PublicStatus,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const existingMetadata =
      user?.user_metadata && typeof user.user_metadata === "object"
        ? { ...(user.user_metadata as Record<string, unknown>) }
        : {};

    return {
      ...existingMetadata,
      nombres: record.nombres,
      apellidos: record.apellidos,
      numero_documento: record.cedula,
      origen: "SHAREPOINT_YOU",
      estado,
      requiere_cambio_password: true,
      ...extra,
    };
  }

  metadataDocument(user: User | null): string | null {
    const raw = this.getUserMetadataValue(user, "numero_documento");
    return raw === null || raw === undefined ? null : String(raw).trim() || null;
  }

  getUserMetadataValue(user: User | null, key: string): unknown {
    if (!user?.user_metadata || typeof user.user_metadata !== "object") {
      return null;
    }
    return (user.user_metadata as Record<string, unknown>)[key] ?? null;
  }

  private rememberUser(user: User): void {
    this.usersById.set(user.id, user);
    if (user.email) {
      this.usersByEmail.set(user.email.toLowerCase(), user);
    }
  }

  private async scanNextUsersPage(): Promise<void> {
    if (this.fullyScanned) {
      return;
    }

    const perPage = 200;
    const { data, error } = await this.supabase.auth.admin.listUsers({
      page: this.nextPageToScan,
      perPage,
    });

    if (error) {
      throw new SupabaseAuthError(`No se pudieron listar usuarios de Auth: ${error.message}`);
    }

    for (const user of data.users) {
      this.rememberUser(user);
    }

    if (data.users.length < perPage) {
      this.fullyScanned = true;
    } else {
      this.nextPageToScan += 1;
    }
  }

  getConfig(): EnvConfig {
    return this.config;
  }
}
