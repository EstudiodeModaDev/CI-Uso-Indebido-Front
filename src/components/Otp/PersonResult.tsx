import type { PersonData } from '../../models/auth'
import { IconCheck, IconId, IconMail, IconPhone } from './OtpIcons'

interface PersonResultProps {
  person: PersonData | null
}

function getInitials(nombres: string, apellidos: string) {
  const first = nombres?.trim().charAt(0) ?? ''
  const last = apellidos?.trim().charAt(0) ?? ''
  return `${first}${last}`.toUpperCase() || '?'
}

function PersonResult({ person }: PersonResultProps) {
  if (!person) {
    return null
  }

  return (
    <div className="otp__person">
      <div className="otp__person-header">
        <span className="otp__person-avatar" aria-hidden="true">
          {getInitials(person.nombres, person.apellidos)}
        </span>
        <div className="otp__person-heading">
          <p className="otp__person-name">
            {person.nombres} {person.apellidos}
          </p>
          <span className="otp__person-badge">
            <IconCheck />
            Persona encontrada
          </span>
        </div>
      </div>

      <div className="otp__person-details">
        <div className="otp__person-row">
          <span className="otp__person-icon">
            <IconId />
          </span>
          {person.numero_documento}
        </div>
        <div className="otp__person-row">
          <span className="otp__person-icon">
            <IconMail />
          </span>
          {person.correo}
        </div>
        <div className="otp__person-row">
          <span className="otp__person-icon">
            <IconPhone />
          </span>
          {person.telefono}
        </div>
      </div>
    </div>
  )
}

export default PersonResult
