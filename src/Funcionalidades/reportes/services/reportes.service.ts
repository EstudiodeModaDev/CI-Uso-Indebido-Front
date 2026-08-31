import { supabase } from '../../../services/supabase.service'
import type { CrearReportePayload, ReporteCodigo } from '../../../models/reporte'

export async function crearReporteRequest(payload: CrearReportePayload): Promise<ReporteCodigo> {
  const { data, error } = await supabase
    .from('REPORTES_USO_INDEBIDO')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
