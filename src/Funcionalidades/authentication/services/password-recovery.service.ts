import { api } from '../../../services/api.service'
import { supabase } from '../../../services/supabase.service'
import type {
  GeneratePasswordOtpResponse,
  ValidatePasswordOtpResponse,
} from '../../../models/auth'

export function generarCodigoPasswordRequest(email: string): Promise<GeneratePasswordOtpResponse> {
  return api.post<GeneratePasswordOtpResponse>('/otp/generate-password', { email })
}

// El backend verifica el codigo y devuelve un token de recuperacion de Supabase Auth
export function validarCodigoPasswordRequest(payload: {
  email: string
  code: string
}): Promise<ValidatePasswordOtpResponse> {
  return api.post<ValidatePasswordOtpResponse>('/otp/validate-password', payload)
}

/*
 * Canjea el token de recuperacion por una sesion temporal, actualiza la
 * contrasena y cierra la sesion para que la persona ingrese con la nueva.
 */
export async function restablecerPasswordRequest(payload: {
  tokenHash: string
  password: string
}): Promise<void> {
  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: payload.tokenHash,
    type: 'recovery',
  })

  if (verifyError || !data.user) {
    throw new Error('El enlace de recuperacion expiro. Solicita un nuevo codigo.')
  }

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: payload.password,
    })

    if (updateError) {
      throw new Error(updateError.message)
    }

    // Si tenia pendiente el cambio obligatorio de contrasena, ya quedo resuelto
    await supabase
      .from('USUARIOS')
      .update({
        requiere_cambio_password: false,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq('auth_user_id', data.user.id)
  } finally {
    await supabase.auth.signOut()
  }
}
