import type {
  PersonaRow,
  UsuarioRolRow,
  UsuarioRow,
} from "./types.ts";
import { DatabaseError } from "./types.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export class DatabaseService {
  constructor(private readonly supabase: SupabaseClient) {}

  async findPersonaByDocument(numeroDocumento: string): Promise<PersonaRow | null> {
    const { data, error } = await this.supabase
      .from("PERSONAS")
      .select("*")
      .eq("numero_documento", numeroDocumento)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`No se pudo consultar PERSONAS: ${error.message}`);
    }

    return data as PersonaRow | null;
  }

  async findPersonaById(personaId: string): Promise<PersonaRow | null> {
    const { data, error } = await this.supabase
      .from("PERSONAS")
      .select("*")
      .eq("id", personaId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`No se pudo consultar PERSONAS por id: ${error.message}`);
    }

    return data as PersonaRow | null;
  }

  async createPersona(payload: Record<string, unknown>): Promise<PersonaRow> {
    const { data, error } = await this.supabase.from("PERSONAS").insert(payload).select("*").single();
    if (error) {
      throw new DatabaseError(`No se pudo crear PERSONAS: ${error.message}`);
    }
    return data as PersonaRow;
  }

  async updatePersona(id: string, payload: Record<string, unknown>): Promise<PersonaRow> {
    const { data, error } = await this.supabase
      .from("PERSONAS")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new DatabaseError(`No se pudo actualizar PERSONAS: ${error.message}`);
    }
    return data as PersonaRow;
  }

  async deletePersona(id: string): Promise<void> {
    const { error } = await this.supabase.from("PERSONAS").delete().eq("id", id);
    if (error) {
      throw new DatabaseError(`No se pudo eliminar PERSONAS: ${error.message}`);
    }
  }

  async findUsuarioByPersonaId(personaId: string): Promise<UsuarioRow | null> {
    const { data, error } = await this.supabase
      .from("USUARIOS")
      .select("*")
      .eq("id_persona", personaId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`No se pudo consultar USUARIOS por persona: ${error.message}`);
    }
    return data as UsuarioRow | null;
  }

  async findUsuarioByAuthUserId(authUserId: string): Promise<UsuarioRow | null> {
    const { data, error } = await this.supabase
      .from("USUARIOS")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`No se pudo consultar USUARIOS por auth_user_id: ${error.message}`);
    }
    return data as UsuarioRow | null;
  }

  async createUsuario(payload: Record<string, unknown>): Promise<UsuarioRow> {
    const { data, error } = await this.supabase.from("USUARIOS").insert(payload).select("*").single();
    if (error) {
      throw new DatabaseError(`No se pudo crear USUARIOS: ${error.message}`);
    }
    return data as UsuarioRow;
  }

  async updateUsuario(id: number, payload: Record<string, unknown>): Promise<UsuarioRow> {
    const { data, error } = await this.supabase
      .from("USUARIOS")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new DatabaseError(`No se pudo actualizar USUARIOS: ${error.message}`);
    }
    return data as UsuarioRow;
  }

  async deleteUsuario(id: number): Promise<void> {
    const { error } = await this.supabase.from("USUARIOS").delete().eq("id", id);
    if (error) {
      throw new DatabaseError(`No se pudo eliminar USUARIOS: ${error.message}`);
    }
  }

  async findRoleAssignment(idUsuario: number, idRol: number): Promise<UsuarioRolRow | null> {
    const { data, error } = await this.supabase
      .from("USUARIOS_ROLES")
      .select("*")
      .eq("id_usuario", idUsuario)
      .eq("id_rol", idRol)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`No se pudo consultar USUARIOS_ROLES: ${error.message}`);
    }
    return data as UsuarioRolRow | null;
  }

  async createRoleAssignment(payload: Record<string, unknown>): Promise<UsuarioRolRow> {
    const { data, error } = await this.supabase
      .from("USUARIOS_ROLES")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new DatabaseError(`No se pudo crear USUARIOS_ROLES: ${error.message}`);
    }
    return data as UsuarioRolRow;
  }

  async updateRoleAssignment(idUsuarioRol: number, payload: Record<string, unknown>): Promise<UsuarioRolRow> {
    const { data, error } = await this.supabase
      .from("USUARIOS_ROLES")
      .update(payload)
      .eq("id_usuario_rol", idUsuarioRol)
      .select("*")
      .single();

    if (error) {
      throw new DatabaseError(`No se pudo actualizar USUARIOS_ROLES: ${error.message}`);
    }
    return data as UsuarioRolRow;
  }

  async insertLog(payload: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.from("LOG").insert(payload);
    if (error) {
      throw new DatabaseError(`No se pudo escribir en LOG: ${error.message}`);
    }
  }

  async getCursorOffset(): Promise<number> {
    const { data, error } = await this.supabase
      .from("migration_cursor")
      .select("next_offset")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`No se pudo consultar migration_cursor: ${error.message}`);
    }

    return typeof data?.next_offset === "number" && data.next_offset >= 0 ? data.next_offset : 0;
  }

  async setCursorOffset(nextOffset: number): Promise<void> {
    const { error } = await this.supabase
      .from("migration_cursor")
      .upsert({
        id: 1,
        next_offset: nextOffset,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new DatabaseError(`No se pudo actualizar migration_cursor: ${error.message}`);
    }
  }
}
