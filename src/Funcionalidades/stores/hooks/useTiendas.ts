import { useEffect, useState } from 'react'
import type { Tienda } from '../../../models/code'
import { listarTiendasRequest } from '../services/stores.service'

interface UseTiendasResult {
  tiendas: Tienda[]
  isLoading: boolean
  error: string | null
}

export function useTiendas(): UseTiendasResult {
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setIsLoading(true)
      setError(null)

      try {
        const resultado = await listarTiendasRequest()
        if (!cancelled) {
          setTiendas(resultado)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo obtener el listado de tiendas.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void cargar()

    return () => {
      cancelled = true
    }
  }, [])

  return { tiendas, isLoading, error }
}
