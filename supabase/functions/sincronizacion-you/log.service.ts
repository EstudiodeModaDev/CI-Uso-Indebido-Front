import type { DatabaseService } from "./database.service.ts";
import type { LogWriteInput } from "./types.ts";
import { toSerializableMessage } from "./utils.ts";

export class LogService {
  constructor(private readonly database: DatabaseService) {}

  async writeLog(input: LogWriteInput): Promise<void> {
    try {
      await this.database.insertLog({
        usuario: input.usuario,
        accion: input.accion,
        entidad: input.entidad,
        resultado: input.resultado,
        mensaje: toSerializableMessage(input.mensaje),
      });
    } catch (error) {
      console.error("No se pudo escribir en LOG:", error instanceof Error ? error.message : String(error));
    }
  }

  async getLastCursorOffset(): Promise<number | null> {
    try {
      return await this.database.getCursorOffset();
    } catch (error) {
      console.error(
        "No se pudo leer el cursor desde migration_cursor:",
        error instanceof Error ? error.message : String(error),
      );
    }
    return null;
  }

  async setCursorOffset(nextOffset: number): Promise<void> {
    try {
      await this.database.setCursorOffset(nextOffset);
    } catch (error) {
      console.error(
        "No se pudo actualizar el cursor en migration_cursor:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
