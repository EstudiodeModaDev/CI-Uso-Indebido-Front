// src/contexts/auth-context.ts
// El contexto vive aparte del AuthProvider para que Fast Refresh funcione
// (un archivo .tsx solo debe exportar componentes).

import { createContext } from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import type { PersonData, UserProfile, UserRole } from "../models/auth";

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthContextValue {
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
