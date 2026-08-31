import { useCallback, useState } from 'react'
import type { CrearReportePayload, ReporteCodigo } from '../../../models/reporte'
import { crearReporteRequest } from '../services/reportes.service'
import type { ApiResponse, GraphMailPayload } from '../../../models/mail'
import { toast } from 'react-hot-toast'

interface UseCrearReporteResult {
  isReporting: boolean
  error: string | null
  crearReporte: (payload: CrearReportePayload) => Promise<ReporteCodigo | null>
  notifyReport: (payload: GraphMailPayload) => Promise<{error?: string}>
}

export function useCrearReporte(): UseCrearReporteResult {
  const [isReporting, setIsReporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const crearReporte = useCallback(async (payload: CrearReportePayload) => {
    setIsReporting(true)
    setError(null)

    try {
      return await crearReporteRequest(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el reporte.')
      return null
    } finally {
      setIsReporting(false)
    }
  }, [])

  const notifyReport = useCallback(async (payload: GraphMailPayload): Promise<{ error?: string }> => {
      try {
        const response = await fetch(
          "https://api-envio-correos-bchfaebqdhfcbdgw.canadacentral-01.azurewebsites.net/mail/send",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        )

        const data: ApiResponse = await response.json();

        if(!data.ok){
          toast.error(data.message)
          return {error: data.message}
        }  

        return {};
      } catch (e) {
        return { error: "Error enviando el correo" };
      }
    },
    []
  );

  return { isReporting, error, crearReporte, notifyReport}
}
