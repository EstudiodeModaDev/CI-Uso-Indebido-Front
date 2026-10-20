import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import {
  generarCodigoPasswordRequest,
  restablecerPasswordRequest,
  validarCodigoPasswordRequest,
} from '../services/password-recovery.service'

export const CODE_LENGTH = 6
const RESEND_SECONDS = 30
const MIN_PASSWORD_LENGTH = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type RecoveryStep = 'email' | 'code' | 'password'

export interface RecoveryErrors {
  email?: string
  code?: string
  password?: string
  confirmPassword?: string
}

interface UseRecuperarPasswordOptions {
  initialEmail?: string
  onSuccess: () => void
}

export function useRecuperarPassword({ initialEmail = '', onSuccess }: UseRecuperarPasswordOptions) {
  const [step, setStep] = useState<RecoveryStep>('email')
  const [email, setEmailValue] = useState(initialEmail)
  const [code, setCodeValue] = useState('')
  const [password, setPasswordValue] = useState('')
  const [confirmPassword, setConfirmPasswordValue] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<RecoveryErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  // Token de recuperacion que entrega el backend al verificar el codigo
  const [tokenHash, setTokenHash] = useState<string | null>(null)

  useEffect(() => {
    if (resendIn <= 0) {
      return
    }
    const timer = setTimeout(() => setResendIn((prev) => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const setEmail = useCallback((value: string) => {
    setEmailValue(value)
    setErrors({})
  }, [])

  // Solo se permiten digitos en el codigo
  const setCode = useCallback((value: string) => {
    setCodeValue(value.replace(/\D/g, ''))
    setErrors({})
  }, [])

  const setPassword = useCallback((value: string) => {
    setPasswordValue(value)
    setErrors((prev) => ({ ...prev, password: undefined }))
  }, [])

  const setConfirmPassword = useCallback((value: string) => {
    setConfirmPasswordValue(value)
    setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
  }, [])

  const toggleShowPassword = useCallback(() => setShowPassword((prev) => !prev), [])

  // Devuelve true si el backend acepto la solicitud
  const sendCode = useCallback(async (): Promise<boolean> => {
    setIsSubmitting(true)
    try {
      const response = await generarCodigoPasswordRequest(email.trim())
      toast.success(response.message)
      setResendIn(RESEND_SECONDS)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar el codigo.')
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [email])

  const handleEmailSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!email) {
        setErrors({ email: 'Ingresa tu correo electronico' })
        return
      }
      if (!EMAIL_PATTERN.test(email.trim())) {
        setErrors({ email: 'Ingresa un correo electronico valido' })
        return
      }

      setErrors({})
      if (await sendCode()) {
        setStep('code')
      }
    },
    [email, sendCode],
  )

  const handleCodeSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (code.length !== CODE_LENGTH) {
        setErrors({ code: `El codigo debe tener ${CODE_LENGTH} digitos` })
        return
      }

      setIsSubmitting(true)
      try {
        const response = await validarCodigoPasswordRequest({ email: email.trim(), code })
        setTokenHash(response.tokenHash)
        setErrors({})
        setStep('password')
      } catch (err) {
        setErrors({
          code: err instanceof Error ? err.message : 'No se pudo verificar el codigo.',
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [code, email],
  )

  const handlePasswordSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const nextErrors: RecoveryErrors = {}
      if (!password || password.length < MIN_PASSWORD_LENGTH) {
        nextErrors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
      }
      if (password !== confirmPassword) {
        nextErrors.confirmPassword = 'Las contraseñas no coinciden'
      }

      setErrors(nextErrors)
      if (Object.keys(nextErrors).length > 0) {
        return
      }

      if (!tokenHash) {
        toast.error('Verifica el codigo antes de cambiar la contraseña.')
        setStep('code')
        return
      }

      setIsSubmitting(true)
      try {
        await restablecerPasswordRequest({ tokenHash, password })
        toast.success('Contraseña restablecida. Ya puedes iniciar sesion.')
        onSuccess()
      } catch (err) {
        // El token es de un solo uso: si fallo, hay que pedir un codigo nuevo
        setTokenHash(null)
        setCodeValue('')
        setStep('email')
        toast.error(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [confirmPassword, onSuccess, password, tokenHash],
  )

  const handleBack = useCallback(() => {
    setErrors({})
    setCodeValue('')
    setTokenHash(null)
    setStep('email')
  }, [])

  return {
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
  }
}
