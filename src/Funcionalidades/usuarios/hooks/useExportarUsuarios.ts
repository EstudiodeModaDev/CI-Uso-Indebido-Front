import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { exportPersonasToExcel, fetchPersonasByRol } from '../services/usuarios.service'

interface UseExportarUsuariosResult {
  rol: string
  setRol: (rol: string) => void
  isExporting: boolean
  exportar: () => Promise<void>
}

export function useExportarUsuarios(): UseExportarUsuariosResult {
  const [rol, setRol] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const exportar = useCallback(async () => {
    setIsExporting(true)

    try {
      const rows = await fetchPersonasByRol(rol || null)

      if (rows.length === 0) {
        toast.error('No hay usuarios que coincidan con ese filtro.')
        return
      }

      exportPersonasToExcel(rows, rol || null)
      toast.success(`${rows.length} usuario(s) exportado(s).`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo exportar el archivo.')
    } finally {
      setIsExporting(false)
    }
  }, [rol])

  return { rol, setRol, isExporting, exportar }
}
