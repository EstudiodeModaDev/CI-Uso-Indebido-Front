import './OlvidePasswordModal.css'
import {
  CODE_LENGTH,
  useRecuperarPassword,
} from '../../Funcionalidades/authentication/hooks/useRecuperarPassword'
import type { RecoveryStep } from '../../Funcionalidades/authentication/hooks/useRecuperarPassword'

interface OlvidePasswordModalProps {
  onClose: () => void
  initialEmail?: string
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 6.5h17v11h-17z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M4 7l8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M11.5 12H20M17 12v3M20 12v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

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

const STEP_TITLES: Record<RecoveryStep, string> = {
  email: 'Recuperar contrasena',
  code: 'Verifica tu correo',
  password: 'Nueva contrasena',
}

function OlvidePasswordModal({ onClose, initialEmail = '' }: OlvidePasswordModalProps) {
  const {
    step,
    email,
    code,
    password,
    confirmPassword,
    showPassword,
    errors,
    isSubmitting,
    resendIn,
    setEmail,
    setCode,
    setPassword,
    setConfirmPassword,
    toggleShowPassword,
    sendCode,
    handleEmailSubmit,
    handleCodeSubmit,
    handlePasswordSubmit,
    handleBack,
  } = useRecuperarPassword({ initialEmail, onSuccess: onClose })

  return (
    <div className="olvide-password-modal__overlay" role="presentation" onClick={onClose}>
      <div
        className="olvide-password-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="olvide-password-modal-title"
        aria-describedby="olvide-password-modal-description"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="olvide-password-modal__header">
          <h2 id="olvide-password-modal-title">{STEP_TITLES[step]}</h2>
          <button
            type="button"
            className="olvide-password-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={isSubmitting}
          >
            ×
          </button>
        </header>

        <ol className="olvide-password-modal__steps" aria-label="Progreso">
          {(['email', 'code', 'password'] as RecoveryStep[]).map((item, index) => (
            <li
              key={item}
              className="olvide-password-modal__step"
              data-active={item === step}
              aria-current={item === step ? 'step' : undefined}
            >
              {index + 1}
            </li>
          ))}
        </ol>

        {step === 'email' && (
          <>
            <p className="olvide-password-modal__description" id="olvide-password-modal-description">
              Ingresa el correo asociado a tu cuenta y te enviaremos un codigo de verificacion.
            </p>
            <form className="olvide-password-modal__form" onSubmit={handleEmailSubmit} noValidate>
              <div className="olvide-password-modal__field">
                <label htmlFor="recovery-email">Correo electronico</label>
                <div className="olvide-password-modal__input-group">
                  <span className="olvide-password-modal__input-icon">
                    <IconMail />
                  </span>
                  <input
                    id="recovery-email"
                    name="recovery-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nombre@empresa.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'recovery-email-error' : undefined}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
                {errors.email && (
                  <span className="olvide-password-modal__field-error" id="recovery-email-error">
                    {errors.email}
                  </span>
                )}
              </div>

              <div className="olvide-password-modal__actions">
                <button
                  type="button"
                  className="olvide-password-modal__cancel"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="olvide-password-modal__submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando...' : 'Enviar codigo'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <p className="olvide-password-modal__description" id="olvide-password-modal-description">
              Escribe el codigo de {CODE_LENGTH} digitos que enviamos a <strong>{email}</strong>.
            </p>
            <form className="olvide-password-modal__form" onSubmit={handleCodeSubmit} noValidate>
              <div className="olvide-password-modal__field">
                <label htmlFor="recovery-code">Codigo de verificacion</label>
                <div className="olvide-password-modal__input-group">
                  <span className="olvide-password-modal__input-icon">
                    <IconKey />
                  </span>
                  <input
                    id="recovery-code"
                    name="recovery-code"
                    className="olvide-password-modal__code-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={CODE_LENGTH}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    aria-invalid={Boolean(errors.code)}
                    aria-describedby={errors.code ? 'recovery-code-error' : 'recovery-code-hint'}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
                {errors.code ? (
                  <span className="olvide-password-modal__field-error" id="recovery-code-error">
                    {errors.code}
                  </span>
                ) : (
                  <span className="olvide-password-modal__hint" id="recovery-code-hint">
                    Si no lo ves, revisa tu carpeta de correo no deseado.
                  </span>
                )}
              </div>

              <div className="olvide-password-modal__links">
                <button
                  type="button"
                  className="olvide-password-modal__link"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  Cambiar correo
                </button>
                <button
                  type="button"
                  className="olvide-password-modal__link"
                  onClick={() => void sendCode()}
                  disabled={isSubmitting || resendIn > 0}
                >
                  {resendIn > 0 ? `Reenviar codigo en ${resendIn}s` : 'Reenviar codigo'}
                </button>
              </div>

              <div className="olvide-password-modal__actions">
                <button
                  type="button"
                  className="olvide-password-modal__cancel"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="olvide-password-modal__submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Verificando...' : 'Verificar codigo'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'password' && (
          <>
            <p className="olvide-password-modal__description" id="olvide-password-modal-description">
              Codigo verificado. Define tu nueva contrasena.
            </p>
            <form className="olvide-password-modal__form" onSubmit={handlePasswordSubmit} noValidate>
              <div className="olvide-password-modal__field">
                <label htmlFor="recovery-new-password">Nueva contrasena</label>
                <div className="olvide-password-modal__input-group">
                  <span className="olvide-password-modal__input-icon">
                    <IconLock />
                  </span>
                  <input
                    id="recovery-new-password"
                    name="recovery-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="........"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'recovery-new-password-error' : undefined}
                    disabled={isSubmitting}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="olvide-password-modal__eye-toggle"
                    onClick={toggleShowPassword}
                    aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    <IconEye off={showPassword} />
                  </button>
                </div>
                {errors.password && (
                  <span className="olvide-password-modal__field-error" id="recovery-new-password-error">
                    {errors.password}
                  </span>
                )}
              </div>

              <div className="olvide-password-modal__field">
                <label htmlFor="recovery-confirm-password">Confirmar contrasena</label>
                <div className="olvide-password-modal__input-group">
                  <span className="olvide-password-modal__input-icon">
                    <IconLock />
                  </span>
                  <input
                    id="recovery-confirm-password"
                    name="recovery-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="........"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={
                      errors.confirmPassword ? 'recovery-confirm-password-error' : undefined
                    }
                    disabled={isSubmitting}
                  />
                </div>
                {errors.confirmPassword && (
                  <span
                    className="olvide-password-modal__field-error"
                    id="recovery-confirm-password-error"
                  >
                    {errors.confirmPassword}
                  </span>
                )}
              </div>

              <div className="olvide-password-modal__actions">
                <button
                  type="button"
                  className="olvide-password-modal__cancel"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="olvide-password-modal__submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar contrasena'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default OlvidePasswordModal
