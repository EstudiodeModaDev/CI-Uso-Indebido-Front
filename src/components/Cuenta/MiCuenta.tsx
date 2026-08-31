import { useState } from 'react'
import './MiCuenta.css'
import AuthLayout from '../common/AuthLayout'
import { useAuth } from '../../Funcionalidades/authentication/hooks/useAuthentication'
import CambiarPasswordModal from './CambiarPasswordModal'
import { IconId, IconMail, IconPhone } from '../Otp/OtpIcons'

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7.5V12l3.2 1.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getInitials(nombres?: string, apellidos?: string) {
  const first = nombres?.trim().charAt(0) ?? ''
  const last = apellidos?.trim().charAt(0) ?? ''
  return `${first}${last}`.toUpperCase() || '?'
}

function formatFechaHora(value: string | null | undefined) {
  if (!value) return 'Sin registro'

  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ESTADO_LABEL: Record<string, string> = {
  ACTIVO: 'Activa',
  INACTIVO: 'Inactiva',
  BLOQUEADO: 'Bloqueada',
}

function MiCuenta() {
  const { profile, person, roles, loading } = useAuth()
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  return (
    <AuthLayout
      eyebrow="Mi cuenta"
      title="Consulta tu informacion y gestiona tu acceso."
      description="Revisa tus datos personales y de cuenta. Si necesitas actualizarlos, comunicate con el administrador."
    >
      <div className="mi-cuenta__card">
        <header className="mi-cuenta__header">
          <h1>Mi cuenta</h1>
          <p>Informacion asociada a tu usuario. Estos datos no son editables.</p>
        </header>

        {loading && <p className="mi-cuenta__loading">Cargando informacion...</p>}

        {!loading && (
          <>
            <div className="mi-cuenta__profile">
              <span className="mi-cuenta__avatar" aria-hidden="true">
                {getInitials(person?.nombres, person?.apellidos)}
              </span>
              <div className="mi-cuenta__profile-info">
                <p className="mi-cuenta__name">
                  {person ? `${person.nombres} ${person.apellidos}` : 'Sin nombre registrado'}
                </p>
                <div className="mi-cuenta__badges">
                  {profile && (
                    <span
                      className={`mi-cuenta__badge mi-cuenta__badge--${profile.estado.toLowerCase()}`}
                    >
                      {ESTADO_LABEL[profile.estado] ?? profile.estado}
                    </span>
                  )}
                  {roles.map((role) => (
                    <span key={role.id} className="mi-cuenta__badge mi-cuenta__badge--rol">
                      {role.nombre}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mi-cuenta__divider" />

            <section className="mi-cuenta__section">
              <h2>Datos personales</h2>
              <div className="mi-cuenta__grid">
                <div className="mi-cuenta__field">
                  <span className="mi-cuenta__field-icon">
                    <IconId />
                  </span>
                  <div>
                    <span className="mi-cuenta__field-label">Documento</span>
                    <p className="mi-cuenta__field-value">
                      {person ? `${person.tipo_documento} ${person.numero_documento}` : '—'}
                    </p>
                  </div>
                </div>

                <div className="mi-cuenta__field">
                  <span className="mi-cuenta__field-icon">
                    <IconMail />
                  </span>
                  <div>
                    <span className="mi-cuenta__field-label">Correo personal</span>
                    <p className="mi-cuenta__field-value">{person?.correo ?? '—'}</p>
                  </div>
                </div>

                <div className="mi-cuenta__field">
                  <span className="mi-cuenta__field-icon">
                    <IconPhone />
                  </span>
                  <div>
                    <span className="mi-cuenta__field-label">Telefono</span>
                    <p className="mi-cuenta__field-value">{person?.telefono ?? '—'}</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="mi-cuenta__divider" />

            <section className="mi-cuenta__section">
              <h2>Datos de la cuenta</h2>
              <div className="mi-cuenta__grid">
                <div className="mi-cuenta__field">
                  <span className="mi-cuenta__field-icon">
                    <IconMail />
                  </span>
                  <div>
                    <span className="mi-cuenta__field-label">Correo de acceso</span>
                    <p className="mi-cuenta__field-value">{profile?.correo ?? '—'}</p>
                  </div>
                </div>

                <div className="mi-cuenta__field">
                  <span className="mi-cuenta__field-icon">
                    <IconClock />
                  </span>
                  <div>
                    <span className="mi-cuenta__field-label">Ultimo ingreso</span>
                    <p className="mi-cuenta__field-value">
                      {formatFechaHora(profile?.ultimo_ingreso)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="mi-cuenta__divider" />

            <div className="mi-cuenta__actions">
              <button
                type="button"
                className="mi-cuenta__change-password"
                onClick={() => setShowPasswordModal(true)}
              >
                Cambiar contrasena
              </button>
            </div>
          </>
        )}

        <p className="mi-cuenta__footer">
          © {new Date().getFullYear()} Estudio de Moda. Todos los derechos reservados.
        </p>
      </div>

      {showPasswordModal && (
        <CambiarPasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </AuthLayout>
  )
}

export default MiCuenta
