import type { FormEvent } from 'react'
import { IconId } from './OtpIcons'

interface CedulaFormProps {
  cedula: string
  cedulaError: string | null
  isSearching: boolean
  onCedulaChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function CedulaForm({
  cedula,
  cedulaError,
  isSearching,
  onCedulaChange,
  onSubmit,
}: CedulaFormProps) {
  return (
    <form className="otp__form" onSubmit={onSubmit} noValidate>
      <div className="otp__field">
        <label htmlFor="cedula">Cedula</label>
        <div className="otp__input-group">
          <span className="otp__input-icon">
            <IconId />
          </span>
          <input
            id="cedula"
            name="cedula"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ej. 1032456789"
            value={cedula}
            onChange={(event) =>
              onCedulaChange(event.target.value.replace(/\D/g, ''))
            }
            maxLength={15}
            aria-invalid={Boolean(cedulaError)}
            aria-describedby={cedulaError ? 'cedula-error' : undefined}
            disabled={isSearching}
          />
        </div>
        {cedulaError && (
          <span className="otp__field-error" id="cedula-error">
            {cedulaError}
          </span>
        )}
      </div>

      <button className="otp__submit" type="submit" disabled={isSearching}>
        {isSearching ? 'Consultando...' : 'Consultar'}
      </button>
    </form>
  )
}

export default CedulaForm
