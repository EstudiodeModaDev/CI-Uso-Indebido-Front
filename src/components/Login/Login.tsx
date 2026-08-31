import { useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import './Login.css'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../Funcionalidades/authentication/hooks/useAuthentication'
import AuthLayout from '../common/AuthLayout'

type LoginErrors = {
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<LoginErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: LoginErrors = {}
    if (!email) {
      nextErrors.email = 'Ingresa tu correo electronico'
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = 'Ingresa un correo electronico valido'
    }
    if (!password) {
      nextErrors.password = 'Ingresa tu contrasena'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Revisa los campos marcados antes de continuar.')
      return
    }

    setIsSubmitting(true)
    const { error } = await signIn({
      email,
      password,
    })

    if (error) {
      setIsSubmitting(false)
      toast.error(error.message)
      return
    }

    toast.success('Inicio de sesion exitoso.')
    navigate('/login-confirmado', { replace: true })
  }

  return (
    <AuthLayout
      eyebrow="Acceso corporativo"
      title="Trazabilidad completa del uso de beneficios."
      description="Gestiona la validacion y redencion de codigos con control total sobre cada transaccion."
    >
      <div className="login__card">
        <header className="login__header">
          <h1>Bienvenido de nuevo</h1>
          <p>Ingresa tus credenciales para acceder a tu cuenta</p>
        </header>

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <div className="login__field">
            <label htmlFor="email">Correo electronico</label>
            <div className="login__input-group">
              <span className="login__input-icon">
                <IconMail />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                disabled={isSubmitting}
              />
            </div>
            {errors.email && (
              <span className="login__field-error" id="email-error">
                {errors.email}
              </span>
            )}
          </div>

          <div className="login__field">
            <label htmlFor="password">Contrasena</label>
            <div className="login__input-group">
              <span className="login__input-icon">
                <IconLock />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="........"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="login__eye-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
              >
                <IconEye off={showPassword} />
              </button>
            </div>
            {errors.password && (
              <span className="login__field-error" id="password-error">
                {errors.password}
              </span>
            )}
          </div>

          <div className="login__row">
            <a className="login__link" href="#">
              Olvidaste tu contrasena?
            </a>
          </div>

          <button className="login__submit" type="submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'Verificando...' : 'Iniciar sesion'}</span>
            {!isSubmitting && <IconArrow />}
          </button>
        </form>

        <p className="login__footer">
          © {new Date().getFullYear()} Estudio de Moda. Todos los derechos
          reservados.
        </p>
      </div>
    </AuthLayout>
  )
}

export default Login
