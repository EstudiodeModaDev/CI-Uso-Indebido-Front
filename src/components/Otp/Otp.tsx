import { useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import './Otp.css'
import { supabase } from '../../services/supabase.service'
import type { PersonData } from '../../models/auth'
import type { CodigoOtp, generateOtpResponse, validateOtpResponse } from '../../models/code'
import CedulaForm from './CedulaForm'
import PersonResult from './PersonResult'
import OtpCodeBlock from './OtpCodeBlock'
import OtpValidateBlock from './OtpValidateBlock'
import { useGenerarOtp } from '../../Funcionalidades/code/hooks/useGenerarOtp'
import { useValidarOtp } from '../../Funcionalidades/code/hooks/useValidarOtp'
import { useRedimirOtp } from '../../Funcionalidades/code/hooks/useRedimirOtp'
import { OTP_LENGTH } from '../../Funcionalidades/code/utils/otp.utils'
import AuthLayout from '../common/AuthLayout'

function Otp() {
  const [cedula, setCedula] = useState('')
  const [cedulaError, setCedulaError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [person, setPerson] = useState<PersonData | null>(null)
  const [otpRecord, setOtpRecord] = useState<generateOtpResponse | null>(null)
  const [codigoIngresado, setCodigoIngresado] = useState('')
  const [codigoValidado, setCodigoValidado] = useState<validateOtpResponse | null>(null)
  const [codigoRedimido, setCodigoRedimido] = useState<CodigoOtp | null>(null)
  const [purchaseValue, setPurchaseValue] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')

  const { isGenerating, generarOtp } = useGenerarOtp()
  const { isValidating, validarOtp } = useValidarOtp()
  const { isRedeeming, redimirOtp } = useRedimirOtp()

  const handleConsultar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!cedula) {
      setCedulaError('Ingresa el numero de cedula')
      return
    }

    setCedulaError(null)
    setPerson(null)
    setOtpRecord(null)
    setCodigoIngresado('')
    setCodigoValidado(null)
    setCodigoRedimido(null)
    setPurchaseValue('')
    setIsSearching(true)

    const { data, error } = await supabase
      .from('PERSONAS')
      .select(
        'id, tipo_documento, numero_documento, nombres, apellidos, correo, telefono, estado',
      )
      .eq('numero_documento', cedula)
      .maybeSingle()

    setIsSearching(false)

    if (error) {
      toast.error(error.message)
      return
    }

    if (!data) {
      setCedulaError('No se encontro ninguna persona con esa cedula')
      toast.error('No se encontro ninguna persona con esa cedula.')
      return
    }

    setPerson(data)
    toast.success('Persona encontrada.')
  }

  const handleGenerarOtp = async () => {
    if (!person) return

    const nuevoCodigo = await generarOtp(person.numero_documento)

    if (!nuevoCodigo?.success) {
      toast.error('No se pudo generar el codigo OTP.')
      return
    }

    setOtpRecord(nuevoCodigo)
    setCodigoIngresado('')
    setCodigoValidado(null)
    setCodigoRedimido(null)
    setPurchaseValue('')
    toast.success(`Codigo OTP enviado a ${nuevoCodigo.maskedEmail}.`)
  }

  const handleValidarOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!person) return

    const purchaseValueNumber = Number(purchaseValue)

    if (!purchaseValue || Number.isNaN(purchaseValueNumber)) {
      toast.error('Ingresa un valor de compra valido.')
      return
    }

    if(!invoiceNumber || Number.isNaN(invoiceNumber)){
      toast.error("Ingrese el número de la factura")
      return
    }

    const codigoValido = await validarOtp(person.numero_documento, codigoIngresado)

    if (!codigoValido) {
      toast.error('El codigo ingresado es invalido, ya fue usado o esta vencido.')
      setCodigoValidado(null)
      return
    }

    setCodigoValidado(codigoValido)
    toast.success('Codigo valido.')

    const resultado = await redimirOtp(codigoIngresado, cedula, purchaseValueNumber, Number(invoiceNumber))

    if (!resultado) {
      toast.error('No se pudo redimir el codigo.')
      return
    }

    setCodigoRedimido(resultado)
    setCodigoValidado(null)
    setCodigoIngresado('')
    setPurchaseValue('')
    cleanAll()
    toast.success('Codigo redimido correctamente.')
  }

  const cleanAll = async () => {
    setCedulaError(null)
    setPerson(null)
    setOtpRecord(null)
    setCodigoIngresado('')
    setCodigoValidado(null)
    setCodigoRedimido(null)
    setPurchaseValue('')
    setIsSearching(false)
    setCedula("")
  }

  return (
    <AuthLayout
      eyebrow="Redencion de beneficios"
      title="Valida la identidad y redime el codigo en un solo paso."
      description="Consulta la cedula, genera el codigo OTP y confirma la compra de forma segura."
    >
      <div className="otp__card">
        <header className="otp__header">
          <h1>Generacion de OTP</h1>
          <p>Consulta la cedula de la persona y genera su codigo OTP</p>
        </header>

        <CedulaForm
          cedula={cedula}
          cedulaError={cedulaError}
          isSearching={isSearching}
          onCedulaChange={(value) => {
            setCedula(value)
            setCedulaError(null)
          }}
          onSubmit={handleConsultar}
        />

        <PersonResult person={person} />

        <div className="otp__divider" />

        <OtpCodeBlock
          maskedEmail={otpRecord?.maskedEmail ?? null}
          expiresAt={otpRecord?.expiresAt ?? null}
          canGenerate={Boolean(person)}
          isGenerating={isGenerating}
          onGenerate={handleGenerarOtp}
        />

        {otpRecord?.success && codigoRedimido?.estado !== 'USADO' && (
          <OtpValidateBlock
            codigo={codigoIngresado}
            onCodigoChange={setCodigoIngresado}
            onValidar={handleValidarOtp}
            isValidating={isValidating}
            canValidar={codigoIngresado.length === OTP_LENGTH && purchaseValue.length > 0}
            isValid={Boolean(codigoValidado)}
            purchaseValue={purchaseValue}
            onPurchaseValueChange={setPurchaseValue}
            isRedeeming={isRedeeming}
            onInvoiceNumberChange={setInvoiceNumber} 
            invoiceNumber={invoiceNumber}/>
        )}

        <p className="otp__footer">
          © {new Date().getFullYear()} Estudio de Moda. Todos los derechos
          reservados.
        </p>
      </div>
    </AuthLayout>
  )
}

export default Otp
