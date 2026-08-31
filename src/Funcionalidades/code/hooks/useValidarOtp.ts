import { useCallback, useState } from 'react'
import type { validateOtpResponse } from '../../../models/code'
import { validarOtpRequest } from '../services/otp.service'

interface UseValidarOtpResult {
  isValidating: boolean
  error: string | null
  validarOtp: (idPersona: string, codigo: string) => Promise<validateOtpResponse | null>
}

export function useValidarOtp(): UseValidarOtpResult {
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validarOtp = useCallback(async (idPersona: string, codigo: string) => {
    setIsValidating(true)
    setError(null)

    try {
      return await validarOtpRequest(idPersona, codigo)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'El codigo es invalido, ya fue usado o esta vencido.',
      )
      return null
    } finally {
      setIsValidating(false)
    }
  }, [])

  return { isValidating, error, validarOtp }
}
