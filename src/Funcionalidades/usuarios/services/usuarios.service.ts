import * as XLSX from 'xlsx'
import { supabase } from '../../../services/supabase.service'
import type { BulkCreateSummary, ExcelUserRow } from '../../../models/bulkUsers'
import type { PersonaExportRow } from '../../../models/personas'

// Mapea encabezados normalizados (minúsculas, sin acentos/espacios) a las columnas
// que espera el backend. Así el Excel puede traer "Tipo Documento", "N° Documento",
// "Correo Electronico", etc. sin que el usuario deba ajustar el archivo.
const COLUMN_ALIASES: Record<string, keyof ExcelUserRow> = {
  tipodocumento: 'tipo_documento',
  numerodocumento: 'numero_documento',
  ndocumento: 'numero_documento',
  documento: 'numero_documento',
  cedula: 'numero_documento',
  nombres: 'nombres',
  nombre: 'nombres',
  apellidos: 'apellidos',
  apellido: 'apellidos',
  correo: 'correo',
  email: 'correo',
  correoelectronico: 'correo',
  telefono: 'telefono',
  celular: 'telefono',
  estado: 'estado',
  tipopersona: 'tipo_persona',
  tipodepersona: 'tipo_persona',
  rol: 'tipo_persona',
  empresapertenece: 'empresa_pertenece',
  empresa: 'empresa_pertenece',
  "empresa pertenece": 'empresa_pertenece',
}

const EMPTY_ROW: ExcelUserRow = {
  tipo_documento: '',
  numero_documento: '',
  nombres: '',
  apellidos: '',
  correo: '',
  telefono: '',
  estado: '',
  tipo_persona: '',
  empresa_pertenece: '',
}

// Rango Unicode de diacríticos combinantes (0x0300-0x036f), expresado como códigos
// numéricos para no depender de escribir el caracter combinante literal en el fuente.
const COMBINING_DIACRITICS_START = 0x0300
const COMBINING_DIACRITICS_END = 0x036f

function normalizeHeader(header: string): string {
  let withoutDiacritics = ''
  for (const char of header.normalize('NFD')) {
    const code = char.codePointAt(0) ?? 0
    if (code < COMBINING_DIACRITICS_START || code > COMBINING_DIACRITICS_END) {
      withoutDiacritics += char
    }
  }

  return withoutDiacritics
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export async function parseExcelFile(file: File): Promise<ExcelUserRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new Error('El archivo no tiene hojas con datos.')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const rows = rawRows.map((rawRow) => {
    const row: ExcelUserRow = { ...EMPTY_ROW }

    for (const [header, value] of Object.entries(rawRow)) {
      const key = COLUMN_ALIASES[normalizeHeader(header)]
      if (key) {
        row[key] = String(value ?? '').trim()
      }
    }

    return row
  })

  return rows.filter((row) => Object.values(row).some((value) => value !== ''))
}

export async function bulkCreateUsersRequest(rows: ExcelUserRow[]): Promise<BulkCreateSummary> {
  const { data, error } = await supabase.functions.invoke<BulkCreateSummary>('bulk-create-users', {
    body: { rows },
  })

  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const body = await context.clone().json()
        if (body?.error) {
          throw new Error(body.error)
        }
      } catch {
        // sin body JSON legible, se usa el mensaje genérico de abajo
      }
    }
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('La función no devolvió resultados.')
  }

  return data
}

interface PersonaQueryRow {
  tipo_documento: string | null
  numero_documento: string
  nombres: string | null
  apellidos: string | null
  correo: string
  telefono: string | null
  estado: string | null
  empresa_pertenece: string | null
}

interface UsuarioQueryRow {
  estado: string
  PERSONAS: PersonaQueryRow | PersonaQueryRow[] | null
}

interface PersonaRolQueryRow {
  ROLES: { nombre: string } | { nombre: string }[] | null
  USUARIOS: UsuarioQueryRow | UsuarioQueryRow[] | null
}

// Trae, para cada usuario con rol ACTIVO, sus datos de PERSONAS + el nombre del rol.
// Si "rol" es null trae todos los roles; si viene, filtra por ese rol exacto.
export async function fetchPersonasByRol(rol: string | null): Promise<PersonaExportRow[]> {
  let query = supabase
    .from('USUARIOS_ROLES')
    .select(
      `
      ROLES!usuarios_roles_id_rol_fkey!inner ( nombre ),
      USUARIOS!inner (
        estado,
        PERSONAS!usuarios_id_persona_fkey ( tipo_documento, numero_documento, nombres, apellidos, correo, telefono, estado, empresa_pertenece )
      )
    `,
    )
    .eq('estado', 'ACTIVO')

  if (rol) {
    query = query.eq('ROLES.nombre', rol)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`No se pudieron consultar los usuarios: ${error.message}`)
  }

  return ((data ?? []) as PersonaRolQueryRow[]).flatMap((row) => {
    const rolNombre = Array.isArray(row.ROLES) ? row.ROLES[0]?.nombre : row.ROLES?.nombre
    const usuario = Array.isArray(row.USUARIOS) ? row.USUARIOS[0] : row.USUARIOS
    const persona = usuario ? (Array.isArray(usuario.PERSONAS) ? usuario.PERSONAS[0] : usuario.PERSONAS) : null

    if (!rolNombre || !usuario || !persona) return []

    return [
      {
        tipo_documento: persona.tipo_documento ?? '',
        numero_documento: persona.numero_documento ?? '',
        nombres: persona.nombres ?? '',
        apellidos: persona.apellidos ?? '',
        correo: persona.correo ?? '',
        telefono: persona.telefono ?? '',
        estado_persona: persona.estado ?? '',
        estado_usuario: usuario.estado ?? '',
        rol: rolNombre,
        empresa_pertenece: persona.empresa_pertenece ?? '',
      },
    ]
  })
}

export function exportPersonasToExcel(rows: PersonaExportRow[], rol: string | null): void {
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      'Tipo documento': row.tipo_documento,
      'Numero documento': row.numero_documento,
      Nombres: row.nombres,
      Apellidos: row.apellidos,
      Correo: row.correo,
      Telefono: row.telefono,
      'Estado persona': row.estado_persona,
      'Estado usuario': row.estado_usuario,
      Rol: row.rol,
      'Empresa a la que pertenece': row.empresa_pertenece,
    })),
  )

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios')

  const sufijo = rol ? rol.toLowerCase() : 'todos'
  const fecha = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `usuarios-${sufijo}-${fecha}.xlsx`)
}
