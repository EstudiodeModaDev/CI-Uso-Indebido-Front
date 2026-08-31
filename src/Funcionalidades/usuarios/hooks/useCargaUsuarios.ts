import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import type { BulkCreateSummary, ExcelUserRow } from '../../../models/bulkUsers'
import { bulkCreateUsersRequest, parseExcelFile } from '../services/usuarios.service'

interface UseCargaUsuariosResult {
  rows: ExcelUserRow[]
  fileName: string | null
  isParsing: boolean
  isUploading: boolean
  summary: BulkCreateSummary | null
  handleFile: (file: File) => Promise<void>
  submit: () => Promise<void>
  reset: () => void
}

export function useCargaUsuarios(): UseCargaUsuariosResult {
  const [rows, setRows] = useState<ExcelUserRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [summary, setSummary] = useState<BulkCreateSummary | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setIsParsing(true)
    setSummary(null)

    try {
      const parsedRows = await parseExcelFile(file)

      if (parsedRows.length === 0) {
        toast.error('No se encontraron filas con datos en el archivo.')
        setRows([])
        setFileName(null)
        return
      }

      setRows(parsedRows)
      setFileName(file.name)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
      setRows([])
      setFileName(null)
    } finally {
      setIsParsing(false)
    }
  }, [])

  const submit = useCallback(async () => {
    if (rows.length === 0) {
      return
    }

    setIsUploading(true)

    try {
      const result = await bulkCreateUsersRequest(rows)
      setSummary(result)

      if (result.errores === 0) {
        toast.success(`${result.creados} usuarios creados, ${result.actualizados} actualizados.`)
      } else {
        toast.error(`${result.errores} fila(s) con error. Revisa el detalle.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo completar la carga.')
    } finally {
      setIsUploading(false)
    }
  }, [rows])

  const reset = useCallback(() => {
    setRows([])
    setFileName(null)
    setSummary(null)
  }, [])

  return { rows, fileName, isParsing, isUploading, summary, handleFile, submit, reset }
}
