import { useCallback, useEffect, useState } from 'react'
import type { HistorialAdminFiltros, HistorialCodigoAdmin } from '../../../models/code'
import { historialAdminOtpRequest } from '../services/otp.service'

const PAGE_SIZE = 20

interface UseHistorialAdminResult {
  items: HistorialCodigoAdmin[]
  total: number
  page: number
  pageSize: number
  isLoading: boolean
  error: string | null
  document: string
  setDocument: (value: string) => void
  generationStoreId: number | null
  setGenerationStoreId: (value: number | null) => void
  redemptionStoreId: number | null
  setRedemptionStoreId: (value: number | null) => void
  goToPage: (page: number) => void
  buscar: () => void
  appliedFilters: Omit<HistorialAdminFiltros, 'page' | 'pageSize'>
}

export function useHistorialAdmin(): UseHistorialAdminResult {
  const [document, setDocument] = useState('')
  const [generationStoreId, setGenerationStoreId] = useState<number | null>(null)
  const [redemptionStoreId, setRedemptionStoreId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [appliedFilters, setAppliedFilters] = useState<Omit<HistorialAdminFiltros, 'page' | 'pageSize'>>({})

  const [items, setItems] = useState<HistorialCodigoAdmin[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setIsLoading(true)
      setError(null)

      try {
        const resultado = await historialAdminOtpRequest({
          ...appliedFilters,
          page,
          pageSize: PAGE_SIZE,
        })
        if (!cancelled) {
          setItems(resultado.items)
          setTotal(resultado.total)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo obtener el listado de codigos.')
          setItems([])
          setTotal(0)
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
  }, [appliedFilters, page])

  const buscar = useCallback(() => {
    const filtros: Omit<HistorialAdminFiltros, 'page' | 'pageSize'> = {
      document: document.trim() || undefined,
      generationStoreId: generationStoreId ?? undefined,
      redemptionStoreId: redemptionStoreId ?? undefined,
    }
    setAppliedFilters(filtros)
    setPage(1)
  }, [document, generationStoreId, redemptionStoreId])

  const goToPage = useCallback((nextPage: number) => {
    setPage(nextPage)
  }, [])

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    isLoading,
    error,
    document,
    setDocument,
    generationStoreId,
    setGenerationStoreId,
    redemptionStoreId,
    setRedemptionStoreId,
    goToPage,
    buscar,
    appliedFilters,
  }
}
