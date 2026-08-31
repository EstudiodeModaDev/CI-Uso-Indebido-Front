import { useCallback, useState } from 'react'
import type { generateOtpResponse } from '../../../models/code'
import { generarOtpRequest } from '../services/otp.service'

interface UseGenerarOtpResult {
  isGenerating: boolean
  error: string | null
  generarOtp: (idPersona: string) => Promise<generateOtpResponse | null>
}

export function useGenerarOtp(): UseGenerarOtpResult {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generarOtp = useCallback(async (idPersona: string) => {
    setIsGenerating(true)
    setError(null)

    try {
      return await generarOtpRequest(idPersona)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el codigo OTP.')
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [])

  return { isGenerating, error, generarOtp }
}
