import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import './Historial.css'
import type { HistorialCodigo } from '../../models/code'
import PersonResult from '../Otp/PersonResult'
import HistorialList from './HistorialList'
import ReportarModal from './ReportarModal'
import AuthLayout from '../common/AuthLayout'
import { useHistorialOtp } from '../../Funcionalidades/code/hooks/useHistorialOtp'
import { useCrearReporte } from '../../Funcionalidades/reportes/hooks/useCrearReporte'
import { useAuth } from '../../Funcionalidades/authentication/hooks/useAuthentication'
import type { GraphMailPayload } from '../../models/mail'
import React from 'react'

function Historial() {
  const { session, person, loading, roles } = useAuth()
  const [hasLoadedHistorial, setHasLoadedHistorial] = useState(false)
  const [historial, setHistorial] = useState<HistorialCodigo[] | null>(null)
  const [codigoAReportar, setCodigoAReportar] = useState<HistorialCodigo | null>(null)

  const { isLoadingHistorial, obtenerHistorial } = useHistorialOtp()
  const { isReporting, crearReporte, notifyReport } = useCrearReporte()

  useEffect(() => {
    if (loading || hasLoadedHistorial || !person) {
      return
    }

    if (!person.numero_documento || !person.correo) {
      toast.error('Tu perfil no tiene cédula o correo configurado para consultar el historial.')
      setHasLoadedHistorial(true)
      return
    }

    let active = true

    const cargarHistorial = async () => {
      const historialEncontrado = await obtenerHistorial(person.numero_documento, person.correo)

      if (!active) {
        return
      }

      if (!historialEncontrado) {
        toast.error('No se pudo obtener el historial de codigos.')
        setHasLoadedHistorial(true)
        return
      }

      setHistorial(historialEncontrado)
      setHasLoadedHistorial(true)
    }

    void cargarHistorial()

    return () => {
      active = false
    }
  }, [hasLoadedHistorial, loading, obtenerHistorial, person])

  
  React.useEffect(() => {
    console.log("Empezando")
    console.log(roles)
  }, [roles, loading])

  const handleReportar = async (razon: string, payload: GraphMailPayload) => {
    if (!codigoAReportar || !person || !session?.user) return

    const reporte = await crearReporte({
      codigo_otp_id: Number(codigoAReportar.id) ?? null,
      descripcion: razon,
      fecha_reporte: new Date(),
      persona_id: person.id,
      tipo_reporte: "Uso indebido"
    })

    if (!reporte) {
      toast.error('No se pudo registrar el reporte.')
      return
    } 
    
    const response = await notifyReport(payload)

    if(response.error){
      return
    }


    toast.success('Reporte enviado correctamente.')
    setCodigoAReportar(null)
  }

  return (
    <AuthLayout
      eyebrow="Historial de codigos"
      title="Consulta los codigos generados y su valor."
      description="Consulta automaticamente los codigos OTP del usuario autenticado y reportalos si detectas un uso indebido."
    >
      <div className="historial__card">
        <header className="historial__header">
          <h1>Historial de codigos</h1>
          <p>Los codigos se cargan automaticamente con la cedula y el correo del usuario loggeado.</p>
        </header>

        <PersonResult person={person} />

        {loading && <p className="historial__loading">Cargando informacion del usuario...</p>}

        {isLoadingHistorial && <p className="historial__loading">Cargando historial...</p>}

        {!loading && !person && (
          <p className="historial__empty">
            No se encontro informacion de la persona asociada al usuario autenticado.
          </p>
        )}

        {historial && (
          <>
            <div className="historial__divider" />
            <HistorialList historial={historial} onReportar={setCodigoAReportar} />
          </>
        )}

        <p className="historial__footer">
          © {new Date().getFullYear()} Estudio de Moda. Todos los derechos reservados.
        </p>
      </div>

      {codigoAReportar && person && (
        <ReportarModal
          codigo={codigoAReportar}
          persona={person}
          isSubmitting={isReporting}
          onClose={() => setCodigoAReportar(null)}
          onSubmit={handleReportar}
        />
      )}
    </AuthLayout>
  )
}

export default Historial
