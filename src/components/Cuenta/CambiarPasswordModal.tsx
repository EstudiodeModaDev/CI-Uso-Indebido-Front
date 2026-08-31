import { useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import './CambiarPasswordModal.css'
import { useAuth } from '../../Funcionalidades/authentication/hooks/useAuthentication'

interface CambiarPasswordModalProps {
  onClose: () => void
}

interface PasswordErrors {
  password?: string
  confirmPassword?: string
}

const MIN_PASSWORD_LENGTH = 8

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="5"
        y="11"
        width="14"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconEye({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      {off && (
        <path
          d="M4 4l16 16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

function CambiarPasswordModal({ onClose }: CambiarPasswordModalProps) {
  const { changePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: PasswordErrors = {}

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `La contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Las contrasenas no coinciden'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    const { error } = await changePassword(password)
    setIsSubmitting(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Contrasena actualizada correctamente.')
    onClose()
  }

  return (
    <div className="cambiar-password-modal__overlay" role="presentation" onClick={onClose}>
      <div
        className="cambiar-password-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cambiar-password-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cambiar-password-modal__header">
          <h2 id="cambiar-password-modal-title">Cambiar contrasena</h2>
          <button
            type="button"
            className="cambiar-password-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={isSubmitting}
          >
            ×
          </button>
        </header>

        <form className="cambiar-password-modal__form" onSubmit={handleSubmit} noValidate>
          <div className="cambiar-password-modal__field">
            <label htmlFor="new-password">Nueva contrasena</label>
            <div className="cambiar-password-modal__input-group">
              <span className="cambiar-password-modal__input-icon">
                <IconLock />
              </span>
              <input
                id="new-password"
                name="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="........"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setErrors((prev) => ({ ...prev, password: undefined }))
                }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'new-password-error' : undefined}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="cambiar-password-modal__eye-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
              >
                <IconEye off={showPassword} />
              </button>
            </div>
            {errors.password && (
              <span className="cambiar-password-modal__field-error" id="new-password-error">
                {errors.password}
              </span>
            )}
          </div>

          <div className="cambiar-password-modal__field">
            <label htmlFor="confirm-password">Confirmar contrasena</label>
            <div className="cambiar-password-modal__input-group">
              <span className="cambiar-password-modal__input-icon">
                <IconLock />
              </span>
              <input
                id="confirm-password"
                name="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="........"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                }}
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                disabled={isSubmitting}
              />
            </div>
            {errors.confirmPassword && (
              <span className="cambiar-password-modal__field-error" id="confirm-password-error">
                {errors.confirmPassword}
              </span>
            )}
          </div>

          <div className="cambiar-password-modal__actions">
            <button
              type="button"
              className="cambiar-password-modal__cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button type="submit" className="cambiar-password-modal__submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar contrasena'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CambiarPasswordModal
