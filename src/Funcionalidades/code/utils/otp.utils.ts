export const OTP_LENGTH = 6

export function formatFechaHistorial(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatValorCompra(value: number) {
  if(!value) return "No canjeado"

   return value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })
}
