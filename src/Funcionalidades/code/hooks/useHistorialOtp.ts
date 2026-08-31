import { useCallback, useState } from 'react'
import type { HistorialCodigo } from '../../../models/code'
import { historialOtpRequest } from '../services/otp.service'

interface UseHistorialOtpResult {
  isLoadingHistorial: boolean
  error: string | null
  obtenerHistorial: (document: string, email: string) => Promise<HistorialCodigo[] | null>
}

export function useHistorialOtp(): UseHistorialOtpResult {
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const obtenerHistorial = useCallback(async (document: string, email: string) => {
    setIsLoadingHistorial(true)
    setError(null)

    try {
      return await historialOtpRequest(document, email)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo obtener el historial de codigos.',
      )
      return null
    } finally {
      setIsLoadingHistorial(false)
    }
  }, [])

  return { isLoadingHistorial, error, obtenerHistorial }
}
