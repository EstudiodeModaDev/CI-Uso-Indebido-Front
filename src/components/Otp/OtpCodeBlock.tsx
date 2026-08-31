import { IconRefresh } from './OtpIcons'

interface OtpCodeBlockProps {
  maskedEmail: string | null
  expiresAt: string | null
  canGenerate: boolean
  isGenerating: boolean
  onGenerate: () => void
}

function OtpCodeBlock({
  maskedEmail,
  expiresAt,
  canGenerate,
  isGenerating,
  onGenerate,
}: OtpCodeBlockProps) {
  return (
    <div className="otp__otp-block">
      {maskedEmail && (
        <p className="otp__code-sent">
          Codigo enviado a <strong>{maskedEmail}</strong>
          {expiresAt &&
            ` · vence ${new Date(expiresAt).toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
            })}`}
        </p>
      )}

      <button
        className="otp__generate"
        type="button"
        onClick={onGenerate}
        disabled={!canGenerate || isGenerating}
      >
        <IconRefresh />
        <span>
          {isGenerating ? 'Generando...' : maskedEmail ? 'Regenerar OTP' : 'Generar OTP'}
        </span>
      </button>
    </div>
  )
}

export default OtpCodeBlock
