export interface UserProfile {
  id: number;
  id_persona: string | null;
  auth_user_id: string;
  correo: string;
  estado: "ACTIVO" | "INACTIVO" | "BLOQUEADO";
  requiere_cambio_password: boolean;
  intentos_fallidos: number;
  ultimo_ingreso: string | null;
}

export interface UserRole {
  id: number;
  nombre: string;
}

export interface PersonData {
  id: string,
  tipo_documento: string,
  numero_documento: string,
  nombres: string,
  apellidos: string,
  correo: string,
  telefono: string,
  estado: string,
  fecha_actualizacion?: string,
}

export const ROLE_TIENDAS = 'TIENDA'
export const ROLE_CONTROL_INTERNO = 'CONTROL_INTERNO'
export const ROLE_EMPLEADO = 'EMPLEADO'
export const ROLE_SOCIO = 'SOCIO'