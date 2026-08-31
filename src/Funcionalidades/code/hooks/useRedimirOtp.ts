import { useCallback, useState } from 'react'
import type { CodigoOtp } from '../../../models/code'
import { redimirOtpRequest } from '../services/otp.service'

interface UseRedimirOtpResult {
  isRedeeming: boolean
  error: string | null
  redimirOtp: (code: string, document: string, purchaseValue: number, invoiceNumber: number) => Promise<CodigoOtp | null>
}

export function useRedimirOtp(): UseRedimirOtpResult {
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redimirOtp = useCallback(async (code: string, document: string, purchaseValue: number, invoiceNumber: number) => {
    setIsRedeeming(true)
    setError(null)

    try {
      return await redimirOtpRequest(code, document, purchaseValue, invoiceNumber)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'El codigo ya fue redimido o no es valido.',
      )
      return null
    } finally {
      setIsRedeeming(false)
    }
  }, [])

  return { isRedeeming, error, redimirOtp }
}
