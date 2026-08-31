// src/contexts/AuthContext.tsx

import {createContext, useCallback, useEffect, useMemo, useState, type ReactNode,} from "react";
import type {AuthError, Session, User, } from "@supabase/supabase-js";
import { supabase } from "../services/supabase.service";
import type { PersonData, UserProfile, UserRole } from "../models/auth";

interface SignInCredentials {
  email: string;
  password: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  roles: UserRole[];
  loading: boolean;
  profileError: string | null;
  person: PersonData | null

  signIn: (credentials: SignInCredentials,) => Promise<{ error: AuthError | null }>;

  signOut: () => Promise<{ error: AuthError | null }>;

  changePassword: (newPassword: string,) => Promise<{ error: Error | AuthError | null }>;

  refreshProfile: () => Promise<void>;

  hasRole: (role: string) => boolean;
}

export const AuthContext =
  createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({children,}: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState<PersonData | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  /**Función que carga el perfil haciendo consultas a la tabla usuario (Datos del usuario)
   * y consulta a la tabla usuario_roles (Roles asingados a el usuario)
  */
const loadProfile = useCallback(
  async (authUserId: string) => {
    setProfileError(null);

    const {
      data: userProfileData,
      error: profileQueryError,
    } = await supabase
      .from("USUARIOS")
      .select(`
        id,
        id_persona,
        correo,
        estado,
        requiere_cambio_password,
        intentos_fallidos,
        ultimo_ingreso,
        fecha_creacion,
        fecha_actualizacion,
        auth_user_id,

        PERSONAS!usuarios_id_persona_fkey (
          id,
          tipo_documento,
          numero_documento,
          nombres,
          apellidos,
          correo,
          telefono,
          estado
        )
      `)
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (profileQueryError) {
      setProfile(null);
      setPerson(null);
      setRoles([]);
      setProfileError(profileQueryError.message);
      return;
    }

    if (!userProfileData) {
      setProfile(null);
      setPerson(null);
      setRoles([]);
      setProfileError(
        "No se encontró el perfil del usuario.",
      );
      return;
    }

    const queryResult = userProfileData;

    const {
      PERSONAS: relatedPerson,
      ...userProfile
    } = queryResult;

    setProfile(userProfile);

    if (Array.isArray(relatedPerson)) {
      setPerson(relatedPerson[0] ?? null);
    } else {
      setPerson(relatedPerson);
    }

    const {
      data: userRoles,
      error: rolesQueryError,
    } = await supabase
      .from("USUARIOS_ROLES")
      .select(`
        ROLES!usuarios_roles_id_rol_fkey (
          id,
          nombre
        )
      `)
      .eq("id_usuario", userProfile.id)
      .eq("estado", "ACTIVO");

    if (rolesQueryError) {
      setRoles([]);
      setProfileError(rolesQueryError.message);
      return;
    }

    const normalizedRoles: UserRole[] = (
      userRoles ?? []
    ).flatMap((item) => {
      const role = item.ROLES;

      if (!role) {
        return [];
      }

      if (Array.isArray(role)) {
        return role as UserRole[];
      }

      return [role as UserRole];
    });

    setRoles(normalizedRoles);
  },
  [],
);

  /*Función que limpia la sesión*/
  const clearAuthData = useCallback(() => {
    setProfile(null);
    setRoles([]);
    setProfileError(null);
  }, []);

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      try {
        //Obtiene la session activa
        const {data: { session: initialSession },} = await supabase.auth.getSession();

        if (!active) return;

        setSession(initialSession);

        if (initialSession?.user) {
          await loadProfile(initialSession.user.id);
        } else {
          clearAuthData();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initializeAuth();

    const {data: { subscription },} = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);

        // Se difiere la consulta para evitar hacer operaciones
        // adicionales dentro del callback de autenticación.
        window.setTimeout(() => {
          async function syncProfile() {
            if (newSession?.user) {
              await loadProfile(newSession.user.id);
            } else {
              clearAuthData();
            }

            setLoading(false);
          }

          void syncProfile();
        }, 0);
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [clearAuthData, loadProfile]);

  //Funcion de inicio de sesion
  const signIn = useCallback(async ({ email, password }: SignInCredentials) => {
      setLoading(true);
      setProfileError(null);

      const { error } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (error) {
        setLoading(false);
      }

      return { error };
    },
    [],
  );

  //Funcion de cierre de sesion
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (!error) {
      setSession(null);
      clearAuthData();
    }

    return { error };
  }, [clearAuthData]);

  //Función de cambio de contraseña
  const changePassword = useCallback(async (newPassword: string) => {
      if (!session?.user) {
        return {
          error: new Error("No existe una sesión activa."),
        };
      }

      const { error: passwordError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (passwordError) {
        return { error: passwordError };
      }

      const { error: profileUpdateError } = await supabase
        .from("USUARIOS")
        .update({
          requiere_cambio_password: false,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("auth_user_id", session.user.id);

      if (profileUpdateError) {
        return {
          error: new Error(profileUpdateError.message),
        };
      }

      await loadProfile(session.user.id);

      return { error: null };
    },
    [loadProfile, session],
  );

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      clearAuthData();
      return;
    }

    await loadProfile(session.user.id);
  }, [clearAuthData, loadProfile, session]);

  //Función para buscar un rol
  const hasRole = useCallback((role: string) =>
      roles.some(
        (currentRole) =>
          currentRole.nombre.toUpperCase() ===
          role.toUpperCase(),
      ),
    [roles],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      loading,
      profileError,
      signIn,
      signOut,
      changePassword,
      refreshProfile,
      hasRole,
      person
    }),
    [
      session,
      profile,
      roles,
      loading,
      profileError,
      signIn,
      signOut,
      changePassword,
      refreshProfile,
      hasRole,
      person
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}