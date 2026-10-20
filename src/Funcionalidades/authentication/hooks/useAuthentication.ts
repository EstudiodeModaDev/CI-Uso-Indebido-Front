// src/hooks/useAuth.ts

import { useContext } from "react";
import { AuthContext } from "../../../contexts/auth-context";

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de un AuthProvider.",
    );
  }

  return context;
}