import { api } from '../../../services/api.service'
import type { Tienda } from '../../../models/code'

export function listarTiendasRequest(): Promise<Tienda[]> {
  return api.get<Tienda[]>('/stores')
}
