import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './AuthLayout.css'
import { useAuth } from '../../Funcionalidades/authentication/hooks/useAuthentication'
import { ROLE_CONTROL_INTERNO } from '../../models/auth'

interface AuthLayoutProps {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  hideBrandPanel?: boolean
}

function AuthLayout({ eyebrow, title, description, children, hideBrandPanel = false }: AuthLayoutProps) {
  const navigate = useNavigate()
  const { user, person, hasRole, signOut,} = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`auth-shell${hideBrandPanel ? ' auth-shell--no-panel' : ''}`}>
      {!hideBrandPanel && (
        <aside className="auth-shell__panel">
          <div className="auth-shell__decor" aria-hidden="true">
            <span className="auth-shell__bar" />
            <span className="auth-shell__ring auth-shell__ring--outer" />
            <span className="auth-shell__ring auth-shell__ring--inner" />
          </div>

          <div className="auth-shell__brand">
            <span className="auth-shell__brand-mark" aria-hidden="true">
              CD
            </span>
            <div className="auth-shell__brand-text">
              <p className="auth-shell__brand-name">Compras y descuentos</p>
              <p className="auth-shell__brand-tagline">Estudio de Moda</p>
            </div>
          </div>

          <div className="auth-shell__message">
            <span className="auth-shell__eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </aside>
      )}

      <main className="auth-shell__content">
        {user && (
          <nav className="auth-shell__account-bar">
            <span className="auth-shell__account-greeting">
              Hola, {person?.nombres ?? user.email}
            </span>
            <div className="auth-shell__account-links">
              {hasRole(ROLE_CONTROL_INTERNO) && (
                <Link to="/admin/usuarios" className="auth-shell__account-link">
                  Cargar usuarios
                </Link>
              )}
              {hasRole(ROLE_CONTROL_INTERNO) && (
                <Link to="/admin/codigos" className="auth-shell__account-link">
                  Tablero de codigos
                </Link>
              )}
              <Link to="/mi-cuenta" className="auth-shell__account-link">
                Mi cuenta
              </Link>
              <button
                type="button"
                className="auth-shell__account-link auth-shell__account-link--button"
                onClick={handleSignOut}
              >
                Cerrar sesion
              </button>
            </div>
          </nav>
        )}
        {children}
      </main>
    </div>
  )
}

export default AuthLayout
