import type { FormEvent } from 'react'
import { OTP_LENGTH } from '../../Funcionalidades/code/utils/otp.utils'
import { IconCheck } from './OtpIcons'

function formatPurchaseValue(digits: string): string {
  if (!digits) return ''
  return Number(digits).toLocaleString('es-CO')
}

interface OtpValidateBlockProps {
  codigo: string
  onCodigoChange: (value: string) => void
  onValidar: (event: FormEvent<HTMLFormElement>) => void
  isValidating: boolean
  canValidar: boolean
  isValid: boolean
  purchaseValue: string
  onPurchaseValueChange: (value: string) => void
  onInvoiceNumberChange: (value: string) => void
  isRedeeming: boolean
  invoiceNumber: string
}

function OtpValidateBlock({
  codigo,
  onCodigoChange,
  onValidar,
  isValidating,
  canValidar,
  isValid,
  purchaseValue,
  onPurchaseValueChange,
  onInvoiceNumberChange,
  isRedeeming,
  invoiceNumber
}: OtpValidateBlockProps) {
  const isProcessing = isValidating || isRedeeming

  return (
    <div className="otp__validate-block">
      <form className="otp__form" onSubmit={onValidar} noValidate>
        <div className="otp__field">
          <label htmlFor="purchase-value">Valor de la compra *</label>
          <div className="otp__input-group">
            <input
              id="purchase-value"
              name="purchase-value"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ingresa el valor de la compra"
              value={formatPurchaseValue(purchaseValue)}
              onChange={(event) =>
                onPurchaseValueChange(event.target.value.replace(/\D/g, ''))
              }
              required
              disabled={isProcessing || isValid}
            />
          </div>
        </div>

        <div className="otp__field">
          <label htmlFor="purchase-value">Número de la factura *</label>
          <div className="otp__input-group">
            <input
              id="purchase-value"
              name="purchase-value"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Numero de la factura"
              value={(invoiceNumber)}
              onChange={(event) =>
                onInvoiceNumberChange(event.target.value.replace(/\D/g, ''))
              }
              required
              disabled={isProcessing || isValid}
              maxLength={6}
            />
          </div>
        </div>

        <div className="otp__field">
          <label htmlFor="codigo-validar">Codigo recibido</label>
          <div className="otp__input-group">
            <input
              id="codigo-validar"
              name="codigo-validar"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ingresa el codigo OTP"
              value={codigo}
              onChange={(event) =>
                onCodigoChange(event.target.value.replace(/\D/g, ''))
              }
              maxLength={OTP_LENGTH}
              disabled={isProcessing}
            />
          </div>
        </div>

        <button
          className="otp__submit"
          type="submit"
          disabled={!canValidar || isProcessing}
        >
          {isRedeeming ? (
            <>
              <IconCheck />
              <span>Redimiendo...</span>
            </>
          ) : isValidating ? (
            'Validando...'
          ) : (
            'Validar y redimir codigo'
          )}
        </button>
      </form>
    </div>
  )
}

export default OtpValidateBlock
