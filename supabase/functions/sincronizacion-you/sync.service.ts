import type { User } from "npm:@supabase/supabase-js@2";
import type { AuthService } from "./auth.service.ts";
import type { DatabaseService } from "./database.service.ts";
import type { GraphService } from "./graph.service.ts";
import type { LogService } from "./log.service.ts";
import type {
  LocatedIdentity,
  NormalizedSharePointRecord,
  PersonaRow,
  ProcessRecordResult,
  ProcessingIssue,
  SyncSummary,
  SyncResponseBody,
  SyncRunOptions,
  UsuarioRow,
} from "./types.ts";
import { CompensationError } from "./types.ts";
import {
  areSameEmail,
  areSameNullable,
  isValidEmail,
  maskDocument,
  normalizePublicStatus,
  normalizeSharePointRecord,
  nowIso,
  sanitizeErrorMessage,
} from "./utils.ts";
import { validatePasswordAgainstPolicy } from "./validators.ts";

interface ChangeSet {
  persona: Record<string, unknown>;
  usuario: Record<string, unknown>;
  authEmail?: string;
  authMetadata?: Record<string, unknown>;
  authBanDuration?: string;
  changedFields: string[];
}

interface RepairContext {
  persona: PersonaRow | null;
  usuario: UsuarioRow | null;
  authUser: User | null;
  repaired: string[];
  createdAuthUserId: string | null;
  createdPersonaId: string | null;
  createdUsuarioId: number | null;
}

export class SyncService {
  private readonly maxReturnedErrors = 200;
  private readonly defaultBatchSize = 200;

  constructor(
    private readonly graphService: GraphService,
    private readonly authService: AuthService,
    private readonly databaseService: DatabaseService,
    private readonly logService: LogService,
  ) {}

  async run(options: SyncRunOptions): Promise<SyncResponseBody> {
    const started = new Date(options.startedAt).getTime();
    const offsetUsed = await this.resolveOffset(options);
    const batchSize = options.filters.sharePointItemId ? 1 : options.filters.limit ?? this.defaultBatchSize;
    const cursorSource: "default" | "manual" | "stored" = options.filters.sharePointItemId
      ? "manual"
      : options.filters.offset !== null
      ? "manual"
      : offsetUsed > 0
      ? "stored"
      : "default";
    const errors: ProcessingIssue[] = [];
    const summary: SyncSummary = {
      sharePointRecords: null,
      processed: 0,
      created: 0,
      updated: 0,
      disabled: 0,
      reactivated: 0,
      repaired: 0,
      unchanged: 0,
      skipped: 0,
      errors: 0,
    };

    await this.logService.writeLog({
      usuario: null,
      accion: "SINCRONIZACION_INICIADA",
      entidad: "SINCRONIZACION_YOU",
      resultado: options.dryRun ? "SIMULADO" : "EXITOSO",
      mensaje: {
        dryRun: options.dryRun,
        filters: options.filters,
        roleId: options.roleId,
        offsetUsed,
        batchSize,
      },
    });

    const graphBatch = await this.graphService.fetchItemsBatch(
      options.filters.sharePointItemId,
      offsetUsed,
      batchSize,
    );
    summary.sharePointRecords = graphBatch.totalAvailable;

    const normalizedRecords = graphBatch.items
      .map((item) => normalizeSharePointRecord(item))
      .filter((record) => this.matchesFilters(record, options.filters.email, options.filters.cedula));

    const duplicateConflicts = this.detectSharePointDuplicateConflicts(normalizedRecords);

    for (const record of normalizedRecords) {
      summary.processed += 1;
      const duplicateConflict = duplicateConflicts.get(record.sourceId);
      if (duplicateConflict) {
        summary.errors += 1;
        errors.push({
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
          message: duplicateConflict,
        });

        await this.logService.writeLog({
          usuario: null,
          accion: "ERROR_VALIDACION",
          entidad: "SHAREPOINT",
          resultado: "ERROR",
          mensaje: {
            sourceId: record.sourceId,
            numeroDocumento: record.cedula,
            email: record.email,
            message: duplicateConflict,
          },
        });
        continue;
      }

      const result = await this.processRecord(record, options);
      if (result.issue) {
        errors.push(result.issue);
      }

      switch (result.kind) {
        case "created":
          summary.created += 1;
          break;
        case "updated":
          summary.updated += 1;
          break;
        case "disabled":
          summary.disabled += 1;
          break;
        case "reactivated":
          summary.reactivated += 1;
          break;
        case "repaired":
          summary.repaired += 1;
          break;
        case "unchanged":
          summary.unchanged += 1;
          break;
        case "skipped":
          summary.skipped += 1;
          break;
        case "error":
          summary.errors += 1;
          break;
      }
    }

    const finishedAt = nowIso();
    const response: SyncResponseBody = {
      success: true,
      dryRun: options.dryRun,
      startedAt: options.startedAt,
      finishedAt,
      durationMs: new Date(finishedAt).getTime() - started,
      filters: {
        email: options.filters.email,
        cedula: options.filters.cedula,
        sharePointItemId: options.filters.sharePointItemId,
        limit: batchSize,
        offset: offsetUsed,
        roleId: options.roleId,
      },
      cursor: {
        source: cursorSource,
        offsetUsed: graphBatch.offsetUsed,
        nextOffset: graphBatch.nextOffset,
        hasMore: graphBatch.hasMore,
        batchSize,
      },
      summary,
      partialErrors: summary.errors > 0,
      errors: errors.slice(0, this.maxReturnedErrors),
    };

    await this.logService.writeLog({
      usuario: null,
      accion: "SINCRONIZACION_FINALIZADA",
      entidad: "SINCRONIZACION_YOU",
      resultado: options.dryRun ? "SIMULADO" : summary.errors > 0 ? "ERROR" : "EXITOSO",
      mensaje: {
        summary,
        partialErrors: response.partialErrors,
        cursor: response.cursor,
      },
    });

    if (!options.dryRun && options.filters.sharePointItemId === null && options.filters.offset === null) {
      await this.logService.setCursorOffset(response.cursor.nextOffset);
    }

    return response;
  }

  private async resolveOffset(options: SyncRunOptions): Promise<number> {
    if (options.filters.sharePointItemId) {
      return 0;
    }
    if (options.filters.offset !== null) {
      return options.filters.offset;
    }
    return await this.logService.getLastCursorOffset() ?? 0;
  }

  private matchesFilters(
    record: NormalizedSharePointRecord,
    emailFilter: string | null,
    cedulaFilter: string | null,
  ): boolean {
    if (emailFilter && record.email !== emailFilter) {
      return false;
    }
    if (cedulaFilter && record.cedula !== cedulaFilter) {
      return false;
    }
    return true;
  }

  private detectSharePointDuplicateConflicts(records: NormalizedSharePointRecord[]): Map<string, string> {
    const conflicts = new Map<string, string>();
    const activeByCedula = new Map<string, string[]>();
    const activeByEmail = new Map<string, string[]>();

    for (const record of records) {
      if (record.isActiveContract !== true) {
        continue;
      }
      if (record.cedula) {
        const itemIds = activeByCedula.get(record.cedula) ?? [];
        itemIds.push(record.sourceId);
        activeByCedula.set(record.cedula, itemIds);
      }
      if (record.email) {
        const itemIds = activeByEmail.get(record.email) ?? [];
        itemIds.push(record.sourceId);
        activeByEmail.set(record.email, itemIds);
      }
    }

    for (const [cedula, ids] of activeByCedula.entries()) {
      if (ids.length > 1) {
        for (const id of ids) {
          conflicts.set(id, `Conflicto en SharePoint: cedula duplicada activa ${cedula}`);
        }
      }
    }

    for (const [email, ids] of activeByEmail.entries()) {
      if (ids.length > 1) {
        for (const id of ids) {
          conflicts.set(id, `Conflicto en SharePoint: email duplicado activo ${email}`);
        }
      }
    }

    return conflicts;
  }

  private async processRecord(
    record: NormalizedSharePointRecord,
    options: SyncRunOptions,
  ): Promise<ProcessRecordResult> {
    const validationError = this.validateRecord(record);
    if (validationError) {
      await this.logService.writeLog({
        usuario: null,
        accion: "ERROR_VALIDACION",
        entidad: "SHAREPOINT",
        resultado: "ERROR",
        mensaje: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
          message: validationError,
        },
      });

      return {
        kind: "error",
        issue: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
          message: validationError,
        },
      };
    }

    try {
      const located = await this.locateIdentity(record);
      const conflictMessage = this.detectIdentityConflict(record, located);
      if (conflictMessage) {
        await this.logService.writeLog({
          usuario: located.usuario?.id ?? null,
          accion: "ERROR_VALIDACION",
          entidad: "SINCRONIZACION_YOU",
          resultado: "ERROR",
          mensaje: {
            sourceId: record.sourceId,
            numeroDocumento: record.cedula,
            email: record.email,
            message: conflictMessage,
          },
        });

        return {
          kind: "error",
          issue: {
            sourceId: record.sourceId,
            numeroDocumento: record.cedula,
            email: record.email,
            message: conflictMessage,
          },
        };
      }

      if (record.isActiveContract === false) {
        return await this.handleInactiveRecord(record, located, options);
      }

      return await this.handleActiveRecord(record, located, options);
    } catch (error) {
      const message = sanitizeErrorMessage(error);
      await this.logService.writeLog({
        usuario: null,
        accion: "ERROR_BASE_DATOS",
        entidad: "SINCRONIZACION_YOU",
        resultado: "ERROR",
        mensaje: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
          message,
        },
      });
      return {
        kind: "error",
        issue: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
          message,
        },
      };
    }
  }

  private validateRecord(record: NormalizedSharePointRecord): string | null {
    if (!record.cedula) {
      return "La cedula es obligatoria";
    }
    if (!record.email) {
      return "El email es obligatorio";
    }
    if (!isValidEmail(record.email)) {
      return "El email no tiene un formato valido";
    }
    if (record.isActiveContract === null) {
      return "Estado de contrato no reconocido";
    }
    return null;
  }

  private async locateIdentity(record: NormalizedSharePointRecord): Promise<LocatedIdentity> {
    let persona = await this.databaseService.findPersonaByDocument(record.cedula!);
    let usuario = persona ? await this.databaseService.findUsuarioByPersonaId(persona.id) : null;
    let authUser = usuario ? await this.authService.getUserById(usuario.auth_user_id) : null;
    const authUserByEmail = await this.authService.findUserByEmail(record.email);

    if (!persona && authUserByEmail) {
      usuario = await this.databaseService.findUsuarioByAuthUserId(authUserByEmail.id);
      persona = usuario ? await this.databaseService.findPersonaById(usuario.id_persona) : null;
      authUser = authUserByEmail;
    }

    return {
      persona,
      usuario,
      authUser,
      authUserByEmail,
    };
  }

  private detectIdentityConflict(record: NormalizedSharePointRecord, located: LocatedIdentity): string | null {
    if (
      located.persona &&
      located.authUserByEmail &&
      located.usuario &&
      located.authUserByEmail.id !== located.usuario.auth_user_id
    ) {
      return "Conflicto de identidad: el correo ya pertenece a otro usuario de Auth";
    }

    if (
      !located.persona &&
      located.authUserByEmail &&
      this.authService.metadataDocument(located.authUserByEmail) &&
      this.authService.metadataDocument(located.authUserByEmail) !== record.cedula
    ) {
      return "Conflicto de identidad: el correo existe en Auth con otra cedula";
    }

    return null;
  }

  private async handleInactiveRecord(
    record: NormalizedSharePointRecord,
    located: LocatedIdentity,
    options: SyncRunOptions,
  ): Promise<ProcessRecordResult> {
    const roleAssignment = located.usuario
      ? await this.databaseService.findRoleAssignment(located.usuario.id, options.roleId)
      : null;

    if (!located.persona && !located.usuario && !located.authUser) {
      await this.logService.writeLog({
        usuario: null,
        accion: "REGISTRO_OMITIDO",
        entidad: "SINCRONIZACION_YOU",
        resultado: options.dryRun ? "SIMULADO" : "OMITIDO",
        mensaje: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
          message: "Registro inactivo que no existe en Supabase",
        },
      });
      return { kind: "skipped" };
    }

    const personaNeedsUpdate = located.persona && normalizePublicStatus(located.persona.estado) !== "INACTIVO";
    const usuarioNeedsUpdate = located.usuario && normalizePublicStatus(located.usuario.estado) !== "INACTIVO";
    const roleNeedsUpdate = roleAssignment && normalizePublicStatus(roleAssignment.estado) !== "INACTIVO";
    const authNeedsUpdate = located.authUser && !this.authService.isBanned(located.authUser);

    if (!personaNeedsUpdate && !usuarioNeedsUpdate && !roleNeedsUpdate && !authNeedsUpdate) {
      await this.logService.writeLog({
        usuario: located.usuario?.id ?? null,
        accion: "USUARIO_DESHABILITADO",
        entidad: "SINCRONIZACION_YOU",
        resultado: "SIN_CAMBIOS",
        mensaje: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
        },
      });
      return { kind: "unchanged" };
    }

    if (!options.dryRun) {
      if (authNeedsUpdate && located.authUser) {
        await this.authService.disableUser(located.authUser, record);
      }
      if (personaNeedsUpdate && located.persona) {
        await this.databaseService.updatePersona(located.persona.id, {
          estado: "INACTIVO",
          fecha_actualizacion: nowIso(),
        });
      }
      if (usuarioNeedsUpdate && located.usuario) {
        await this.databaseService.updateUsuario(located.usuario.id, {
          estado: "INACTIVO",
          fecha_actualizacion: nowIso(),
        });
      }
      if (roleNeedsUpdate && roleAssignment) {
        await this.databaseService.updateRoleAssignment(roleAssignment.id_usuario_rol, {
          estado: "INACTIVO",
        });
      }
    }

    await this.logService.writeLog({
      usuario: located.usuario?.id ?? null,
      accion: "USUARIO_DESHABILITADO",
      entidad: "SINCRONIZACION_YOU",
      resultado: options.dryRun ? "SIMULADO" : "EXITOSO",
      mensaje: {
        sourceId: record.sourceId,
        numeroDocumento: record.cedula,
        email: record.email,
        changedFields: [
          ...(authNeedsUpdate ? ["AUTH_USERS.estado"] : []),
          ...(personaNeedsUpdate ? ["PERSONAS.estado"] : []),
          ...(usuarioNeedsUpdate ? ["USUARIOS.estado"] : []),
          ...(roleNeedsUpdate ? ["USUARIOS_ROLES.estado"] : []),
        ],
      },
    });

    return { kind: "disabled" };
  }

  private async handleActiveRecord(
    record: NormalizedSharePointRecord,
    located: LocatedIdentity,
    options: SyncRunOptions,
  ): Promise<ProcessRecordResult> {
    if (!located.persona && !located.usuario && !located.authUser && !located.authUserByEmail) {
      return await this.createCompleteUser(record, options);
    }

    const repaired = await this.repairIdentityIfSafe(record, located, options);
    const roleAssignment = repaired.usuario
      ? await this.databaseService.findRoleAssignment(repaired.usuario.id, options.roleId)
      : null;
    const changeSet = this.computeActiveChangeSet(record, repaired.persona, repaired.usuario, repaired.authUser);
    const roleState = roleAssignment ? normalizePublicStatus(roleAssignment.estado) : null;
    const roleNeedsInsert = !roleAssignment;
    const roleNeedsActivation = roleState !== "ACTIVO";
    const authWasBanned = this.authService.isBanned(repaired.authUser);
    const hasDataChanges =
      Object.keys(changeSet.persona).length > 0 ||
      Object.keys(changeSet.usuario).length > 0 ||
      changeSet.authEmail !== undefined ||
      changeSet.authMetadata !== undefined;

    if (!options.dryRun) {
      if (authWasBanned && repaired.authUser) {
        repaired.authUser = await this.authService.reactivateUser(repaired.authUser, record);
      } else if ((changeSet.authEmail !== undefined || changeSet.authMetadata !== undefined) && repaired.authUser) {
        repaired.authUser = await this.authService.updateUser(repaired.authUser.id, {
          email: changeSet.authEmail,
          userMetadata: changeSet.authMetadata,
        });
      }

      if (Object.keys(changeSet.persona).length > 0 && repaired.persona) {
        repaired.persona = await this.databaseService.updatePersona(repaired.persona.id, changeSet.persona);
      }

      if (Object.keys(changeSet.usuario).length > 0 && repaired.usuario) {
        repaired.usuario = await this.databaseService.updateUsuario(repaired.usuario.id, changeSet.usuario);
      }

      if (repaired.usuario) {
        if (roleNeedsInsert) {
          await this.databaseService.createRoleAssignment({
            id_usuario: repaired.usuario.id,
            id_rol: options.roleId,
            estado: "ACTIVO",
            fecha_asignacion: nowIso(),
          });
        } else if (roleNeedsActivation && roleAssignment) {
          await this.databaseService.updateRoleAssignment(roleAssignment.id_usuario_rol, {
            estado: "ACTIVO",
            fecha_asignacion: nowIso(),
          });
        }
      }
    }

    const changedFields = [
      ...changeSet.changedFields,
      ...(roleNeedsInsert ? ["USUARIOS_ROLES.id_rol"] : []),
      ...(roleNeedsActivation && !roleNeedsInsert ? ["USUARIOS_ROLES.estado"] : []),
    ];

    const wasRepaired = repaired.repaired.length > 0;
    const wasReactivated = authWasBanned ||
      normalizePublicStatus(repaired.persona?.estado) === "INACTIVO" ||
      normalizePublicStatus(repaired.usuario?.estado) === "INACTIVO" ||
      roleState === "INACTIVO";

    if (!hasDataChanges && !roleNeedsInsert && !roleNeedsActivation && !wasRepaired && !wasReactivated) {
      await this.logService.writeLog({
        usuario: repaired.usuario?.id ?? null,
        accion: "USUARIO_ACTUALIZADO",
        entidad: "SINCRONIZACION_YOU",
        resultado: "SIN_CAMBIOS",
        mensaje: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
        },
      });
      return { kind: "unchanged" };
    }

    const action = wasReactivated
      ? "USUARIO_REACTIVADO"
      : wasRepaired
      ? "REGISTRO_REPARADO"
      : roleNeedsInsert || roleNeedsActivation
      ? "ROL_ASIGNADO"
      : "USUARIO_ACTUALIZADO";

    await this.logService.writeLog({
      usuario: repaired.usuario?.id ?? null,
      accion: action,
      entidad: "SINCRONIZACION_YOU",
      resultado: options.dryRun ? "SIMULADO" : "EXITOSO",
      mensaje: {
        sourceId: record.sourceId,
        numeroDocumento: record.cedula,
        email: record.email,
        repairedEntities: repaired.repaired,
        changedFields,
      },
    });

    if (wasReactivated) {
      return { kind: "reactivated" };
    }
    if (wasRepaired) {
      return { kind: "repaired" };
    }
    return { kind: "updated" };
  }

  private async createCompleteUser(
    record: NormalizedSharePointRecord,
    options: SyncRunOptions,
  ): Promise<ProcessRecordResult> {
    const passwordValidationMessage = validatePasswordAgainstPolicy(
      record.cedula!,
      this.authService.getConfig().authMinimumPasswordLength,
      this.authService.getConfig().authPasswordRequirements,
    );

    if (passwordValidationMessage) {
      await this.logService.writeLog({
        usuario: null,
        accion: "ERROR_VALIDACION",
        entidad: "AUTH_USERS",
        resultado: "ERROR",
        mensaje: {
          sourceId: record.sourceId,
          numeroDocumento: maskDocument(record.cedula),
          email: record.email,
          message: passwordValidationMessage,
        },
      });

      return {
        kind: "error",
        issue: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
          message: passwordValidationMessage,
        },
      };
    }

    if (options.dryRun) {
      await this.logService.writeLog({
        usuario: null,
        accion: "USUARIO_CREADO",
        entidad: "SINCRONIZACION_YOU",
        resultado: "SIMULADO",
        mensaje: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
          changedFields: [
            "AUTH_USERS.email",
            "PERSONAS.numero_documento",
            "USUARIOS.auth_user_id",
            "USUARIOS_ROLES.id_rol",
          ],
        },
      });
      return { kind: "created" };
    }

    let createdAuthUserId: string | null = null;
    let createdPersonaId: string | null = null;
    let createdUsuarioId: number | null = null;

    try {
      const authUser = await this.authService.createUser(record);
      createdAuthUserId = authUser.id;

      const persona = await this.databaseService.createPersona({
        tipo_documento: "CC",
        numero_documento: record.cedula,
        nombres: record.nombres,
        apellidos: record.apellidos,
        correo: record.email,
        telefono: record.telefono,
        estado: "ACTIVO",
        fecha_actualizacion: nowIso(),
      });
      createdPersonaId = persona.id;

      const usuario = await this.databaseService.createUsuario({
        id_persona: persona.id,
        correo: record.email,
        estado: "ACTIVO",
        requiere_cambio_password: true,
        intentos_fallidos: 0,
        auth_user_id: authUser.id,
        fecha_actualizacion: nowIso(),
      });
      createdUsuarioId = usuario.id;

      await this.databaseService.createRoleAssignment({
        id_usuario: usuario.id,
        id_rol: options.roleId,
        estado: "ACTIVO",
        fecha_asignacion: nowIso(),
      });

      await this.logService.writeLog({
        usuario: usuario.id,
        accion: "USUARIO_CREADO",
        entidad: "SINCRONIZACION_YOU",
        resultado: "EXITOSO",
        mensaje: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
          changedFields: [
            "AUTH_USERS.email",
            "PERSONAS.numero_documento",
            "USUARIOS.auth_user_id",
            "USUARIOS_ROLES.id_rol",
          ],
        },
      });

      return { kind: "created" };
    } catch (error) {
      await this.compensateCreateFailure(record, createdAuthUserId, createdPersonaId, createdUsuarioId);
      return {
        kind: "error",
        issue: {
          sourceId: record.sourceId,
          numeroDocumento: record.cedula,
          email: record.email,
          message: sanitizeErrorMessage(error),
        },
      };
    }
  }

  private async compensateCreateFailure(
    record: NormalizedSharePointRecord,
    authUserId: string | null,
    personaId: string | null,
    usuarioId: number | null,
  ): Promise<void> {
    const operations: Array<() => Promise<void>> = [];
    if (usuarioId !== null) {
      operations.push(async () => await this.databaseService.deleteUsuario(usuarioId));
    }
    if (personaId !== null) {
      operations.push(async () => await this.databaseService.deletePersona(personaId));
    }
    if (authUserId !== null) {
      operations.push(async () => await this.authService.deleteUser(authUserId));
    }

    for (const operation of operations) {
      try {
        await operation();
      } catch (error) {
        await this.logService.writeLog({
          usuario: usuarioId,
          accion: "ERROR_COMPENSACION",
          entidad: "SINCRONIZACION_YOU",
          resultado: "ERROR",
          mensaje: {
            sourceId: record.sourceId,
            numeroDocumento: record.cedula,
            email: record.email,
            message: sanitizeErrorMessage(error),
          },
        });
        throw new CompensationError(sanitizeErrorMessage(error));
      }
    }

    await this.logService.writeLog({
      usuario: usuarioId,
      accion: "COMPENSACION_EJECUTADA",
      entidad: "SINCRONIZACION_YOU",
      resultado: "EXITOSO",
      mensaje: {
        sourceId: record.sourceId,
        numeroDocumento: record.cedula,
        email: record.email,
      },
    });
  }

  private async repairIdentityIfSafe(
    record: NormalizedSharePointRecord,
    located: LocatedIdentity,
    options: SyncRunOptions,
  ): Promise<RepairContext> {
    let persona = located.persona;
    let usuario = located.usuario;
    let authUser = located.authUser ?? located.authUserByEmail;
    const repaired: string[] = [];
    let createdAuthUserId: string | null = null;
    let createdPersonaId: string | null = null;
    let createdUsuarioId: number | null = null;

    if (!authUser && usuario) {
      if (options.dryRun) {
        repaired.push("AUTH_USERS");
      } else {
        authUser = await this.authService.createUser(record);
        createdAuthUserId = authUser.id;
        usuario = await this.databaseService.updateUsuario(usuario.id, {
          auth_user_id: authUser.id,
          correo: record.email,
          estado: "ACTIVO",
          requiere_cambio_password: true,
          fecha_actualizacion: nowIso(),
        });
        repaired.push("AUTH_USERS");
      }
    }

    if (!persona && authUser) {
      if (options.dryRun) {
        repaired.push("PERSONAS");
        persona = {
          id: "dry-run-persona",
          tipo_documento: "CC",
          numero_documento: record.cedula!,
          nombres: record.nombres ?? "",
          apellidos: record.apellidos,
          correo: record.email!,
          telefono: record.telefono,
          estado: "ACTIVO",
          created_at: nowIso(),
          fecha_actualizacion: nowIso(),
        };
      } else {
        persona = await this.databaseService.createPersona({
          tipo_documento: "CC",
          numero_documento: record.cedula,
          nombres: record.nombres,
          apellidos: record.apellidos,
          correo: record.email,
          telefono: record.telefono,
          estado: "ACTIVO",
          fecha_actualizacion: nowIso(),
        });
        createdPersonaId = persona.id;
        repaired.push("PERSONAS");
      }
    }

    if (!usuario && persona && authUser) {
      if (options.dryRun) {
        repaired.push("USUARIOS");
        usuario = {
          id: -1,
          id_persona: persona.id,
          correo: record.email!,
          estado: "ACTIVO",
          requiere_cambio_password: true,
          intentos_fallidos: 0,
          ultimo_ingreso: null,
          fecha_creacion: nowIso(),
          fecha_actualizacion: nowIso(),
          auth_user_id: authUser.id,
        };
      } else {
        usuario = await this.databaseService.createUsuario({
          id_persona: persona.id,
          correo: record.email,
          estado: "ACTIVO",
          requiere_cambio_password: true,
          intentos_fallidos: 0,
          auth_user_id: authUser.id,
          fecha_actualizacion: nowIso(),
        });
        createdUsuarioId = usuario.id;
        repaired.push("USUARIOS");
      }
    }

    try {
      return {
        persona,
        usuario,
        authUser,
        repaired,
        createdAuthUserId,
        createdPersonaId,
        createdUsuarioId,
      };
    } catch (error) {
      await this.compensateCreateFailure(record, createdAuthUserId, createdPersonaId, createdUsuarioId);
      throw error;
    }
  }

  private computeActiveChangeSet(
    record: NormalizedSharePointRecord,
    persona: PersonaRow | null,
    usuario: UsuarioRow | null,
    authUser: User | null,
  ): ChangeSet {
    const personaPayload: Record<string, unknown> = {};
    const usuarioPayload: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (persona && !areSameNullable(persona.nombres, record.nombres)) {
      personaPayload.nombres = record.nombres;
      changedFields.push("PERSONAS.nombres");
    }
    if (persona && !areSameNullable(persona.apellidos, record.apellidos)) {
      personaPayload.apellidos = record.apellidos;
      changedFields.push("PERSONAS.apellidos");
    }
    if (persona && !areSameEmail(persona.correo, record.email)) {
      personaPayload.correo = record.email;
      changedFields.push("PERSONAS.correo");
    }
    if (persona && !areSameNullable(persona.telefono, record.telefono)) {
      personaPayload.telefono = record.telefono;
      changedFields.push("PERSONAS.telefono");
    }
    if (persona && normalizePublicStatus(persona.estado) !== "ACTIVO") {
      personaPayload.estado = "ACTIVO";
      changedFields.push("PERSONAS.estado");
    }
    if (persona && Object.keys(personaPayload).length > 0) {
      personaPayload.fecha_actualizacion = nowIso();
    }

    if (usuario && !areSameEmail(usuario.correo, record.email)) {
      usuarioPayload.correo = record.email;
      changedFields.push("USUARIOS.correo");
    }
    if (usuario && normalizePublicStatus(usuario.estado) !== "ACTIVO") {
      usuarioPayload.estado = "ACTIVO";
      changedFields.push("USUARIOS.estado");
    }
    if (usuario && usuario.requiere_cambio_password !== true) {
      usuarioPayload.requiere_cambio_password = true;
      changedFields.push("USUARIOS.requiere_cambio_password");
    }
    if (usuario && Object.keys(usuarioPayload).length > 0) {
      usuarioPayload.fecha_actualizacion = nowIso();
    }

    let authEmail: string | undefined;
    if (authUser && !areSameEmail(authUser.email, record.email)) {
      authEmail = record.email ?? undefined;
      changedFields.push("AUTH_USERS.email");
    }

    let authMetadata: Record<string, unknown> | undefined;
    if (authUser) {
      const desiredMetadata = this.authService.buildManagedMetadata(authUser, record, "ACTIVO", {
        deshabilitado_por: null,
      });
      const authNombres = this.authService.getUserMetadataValue(authUser, "nombres");
      const authApellidos = this.authService.getUserMetadataValue(authUser, "apellidos");
      const authNumeroDocumento = this.authService.getUserMetadataValue(authUser, "numero_documento");
      const authOrigen = this.authService.getUserMetadataValue(authUser, "origen");
      const authEstado = this.authService.getUserMetadataValue(authUser, "estado");
      const authRequiresPasswordChange = this.authService.getUserMetadataValue(
        authUser,
        "requiere_cambio_password",
      );
      const authDisabledBy = this.authService.getUserMetadataValue(authUser, "deshabilitado_por");

      const metadataChanged =
        !areSameNullable(authNombres, desiredMetadata.nombres) ||
        !areSameNullable(authApellidos, desiredMetadata.apellidos) ||
        !areSameNullable(authNumeroDocumento, desiredMetadata.numero_documento) ||
        !areSameNullable(authOrigen, desiredMetadata.origen) ||
        !areSameNullable(authEstado, desiredMetadata.estado) ||
        authRequiresPasswordChange !== true ||
        authDisabledBy !== null;

      if (metadataChanged) {
        authMetadata = desiredMetadata;
        changedFields.push("AUTH_USERS.user_metadata");
      }
    }

    return {
      persona: personaPayload,
      usuario: usuarioPayload,
      authEmail,
      authMetadata,
      changedFields,
    };
  }
}
