import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import type { HistorialAdminFiltros } from '../../../models/code'
import { exportHistorialAdminToExcel, fetchAllHistorialAdminOtp } from '../services/otp.service'

interface UseExportarHistorialAdminResult {
  isExporting: boolean
  exportar: (filtros: Omit<HistorialAdminFiltros, 'page' | 'pageSize'>) => Promise<void>
}

export function useExportarHistorialAdmin(): UseExportarHistorialAdminResult {
  const [isExporting, setIsExporting] = useState(false)

  const exportar = useCallback(async (filtros: Omit<HistorialAdminFiltros, 'page' | 'pageSize'>) => {
    setIsExporting(true)

    try {
      const rows = await fetchAllHistorialAdminOtp(filtros)

      if (rows.length === 0) {
        toast.error('No hay codigos que coincidan con esos filtros.')
        return
      }

      exportHistorialAdminToExcel(rows)
      toast.success(`${rows.length} codigo(s) exportado(s).`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo exportar el archivo.')
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { isExporting, exportar }
}
