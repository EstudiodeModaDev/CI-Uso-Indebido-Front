import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { lazy, Suspense } from 'react'
import Login from './components/Login/Login'
import Otp from './components/Otp/Otp'
import Historial from './components/Historial/Historial'
import MiCuenta from './components/Cuenta/MiCuenta'
import CambiarPasswordModal from './components/Cuenta/CambiarPasswordModal'
import './App.css'
import { AuthProvider } from './contexts/AuthContext'
import type { ReactNode } from 'react'
import { useAuth } from './Funcionalidades/authentication/hooks/useAuthentication'
import { ROLE_CONTROL_INTERNO, ROLE_TIENDAS } from './models/auth'

// Carga diferida: esta página trae la librería de parseo de Excel (xlsx), que solo
// necesitan los administradores que suben el archivo, no el resto de usuarios.
const CargaUsuarios = lazy(() => import('./components/Admin/CargaUsuarios'))
const TableroControlInterno = lazy(() => import('./components/Admin/TableroControlInterno'))

interface ProtectedRouteProps {
  children: ReactNode
  requireRole?: string   // el usuario DEBE tener este rol
  blockRole?: string     // el usuario NO DEBE tener este rol
}

function ProtectedRoute({ children, requireRole, blockRole }: ProtectedRouteProps) {
  const { session, loading, hasRole, profile } = useAuth()

  if (loading) return null // o un spinner

  if (!session) return <Navigate to="/login" replace />

  if (requireRole && !hasRole(requireRole)) {
    return <Navigate to="/login" replace />
  }

  if (blockRole && hasRole(blockRole)) {
    return <Navigate to="/login" replace />
  }

  // Primer ingreso (o contrasena reseteada): se bloquea la ruta hasta que el usuario
  // cambie su contrasena. Al guardarla, changePassword recarga el perfil con la bandera
  // en false y la ruta se vuelve a renderizar con su contenido normal.
  if (profile?.requiere_cambio_password) {
    return <CambiarPasswordModal forced onClose={() => {}} />
  }

  return <>{children}</>
}

function RoleRedirect() {
  const { hasRole, loading, } = useAuth()


  if (loading) return <p>Validando permisos</p>

  return <Navigate to={hasRole(ROLE_TIENDAS) ? '/otp' : '/historial-codigos'} replace />
}

function App() {

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app">
          <Toaster
            position="top-right"
            gutter={12}
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '12px 14px',
                fontSize: 'var(--font-size-sm)',
              },
              success: {
                iconTheme: {
                  primary: 'var(--color-success)',
                  secondary: 'var(--color-surface)',
                },
                style: {
                  borderColor: 'rgba(22, 163, 74, 0.24)',
                },
              },
              error: {
                iconTheme: {
                  primary: 'var(--color-danger)',
                  secondary: 'var(--color-surface)',
                },
                style: {
                  borderColor: 'rgba(220, 38, 38, 0.22)',
                },
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} /> {/* Todos tienen acceso */}
            <Route path="/otp" element={<ProtectedRoute requireRole={ROLE_TIENDAS}><Otp /></ProtectedRoute>} />
            <Route path="/historial-codigos" element={<ProtectedRoute blockRole={ROLE_TIENDAS}><Historial /></ProtectedRoute>} />
            <Route path="/mi-cuenta" element={<ProtectedRoute blockRole={ROLE_TIENDAS}><MiCuenta /></ProtectedRoute>} />
            <Route
              path="/admin/usuarios"
              element={
                <ProtectedRoute requireRole={ROLE_CONTROL_INTERNO}>
                  <Suspense fallback={null}>
                    <CargaUsuarios />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/codigos"
              element={
                <ProtectedRoute requireRole={ROLE_CONTROL_INTERNO}>
                  <Suspense fallback={null}>
                    <TableroControlInterno />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
            <Route path="/login-confirmado" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
