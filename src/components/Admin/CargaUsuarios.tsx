import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import './CargaUsuarios.css'
import AuthLayout from '../common/AuthLayout'
import { useCargaUsuarios } from '../../Funcionalidades/usuarios/hooks/useCargaUsuarios'
import { useExportarUsuarios } from '../../Funcionalidades/usuarios/hooks/useExportarUsuarios'
import type { BulkCreateRowStatus } from '../../models/bulkUsers'
import { ROLE_CONTROL_INTERNO, ROLE_EMPLEADO, ROLE_SOCIO, ROLE_TIENDAS } from '../../models/auth'

const ROLE_OPTIONS = [
  { value: '', label: 'Todos los roles' },
  { value: ROLE_TIENDAS, label: 'Tienda' },
  { value: ROLE_EMPLEADO, label: 'Empleado' },
  { value: ROLE_SOCIO, label: 'Socio' },
  { value: ROLE_CONTROL_INTERNO, label: 'Control interno' },
]

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.5V4M12 4L7.5 8.5M12 4l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 15.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const STATUS_LABEL: Record<BulkCreateRowStatus, string> = {
  created: 'Creado',
  updated: 'Actualizado',
  error: 'Error',
}

function CargaUsuarios() {
  const inputRef = useRef<HTMLInputElement>(null)
  const { rows, fileName, isParsing, isUploading, summary, handleFile, submit, reset } =
    useCargaUsuarios()
  const { rol, setRol, isExporting, exportar } = useExportarUsuarios()

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void handleFile(file)
    }
    event.target.value = ''
  }

  const handleReset = () => {
    reset()
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <AuthLayout
      eyebrow="Administración"
      title="Carga masiva de usuarios desde Excel."
      description="Sube un archivo con tipo y número de documento, nombres, apellidos, correo, teléfono, estado y tipo de persona para crear o actualizar usuarios."
    >
      <div className="carga-usuarios__page">
      <div className="carga-usuarios__card">
        <header className="carga-usuarios__header">
          <h1>Carga de usuarios</h1>
          <p>
            Columnas esperadas: tipo documento, numero documento, nombres, apellidos, correo,
            telefono, estado y tipo persona (TIENDA o CONTROL_INTERNO).
          </p>
        </header>

        <div className="carga-usuarios__upload">
          <input
            ref={inputRef}
            id="excel-file"
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleInputChange}
            disabled={isParsing || isUploading}
            className="carga-usuarios__file-input"
          />
          <label htmlFor="excel-file" className="carga-usuarios__file-label">
            <IconUpload />
            {fileName ?? 'Seleccionar archivo Excel'}
          </label>
        </div>

        {isParsing && <p className="carga-usuarios__loading">Leyendo archivo...</p>}

        {rows.length > 0 && !isParsing && (
          <>
            <div className="carga-usuarios__divider" />

            <div className="carga-usuarios__preview-header">
              <h2>{rows.length} usuario(s) detectado(s) en el archivo</h2>
            </div>

            <div className="carga-usuarios__table-wrapper">
              <table className="carga-usuarios__table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Nombres</th>
                    <th>Apellidos</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th>Tipo persona</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.correo}-${index}`}>
                      <td>{row.tipo_documento} {row.numero_documento}</td>
                      <td>{row.nombres}</td>
                      <td>{row.apellidos}</td>
                      <td>{row.correo}</td>
                      <td>{row.telefono}</td>
                      <td>{row.estado}</td>
                      <td>{row.tipo_persona}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="carga-usuarios__actions">
              <button
                type="button"
                className="carga-usuarios__cancel"
                onClick={handleReset}
                disabled={isUploading}
              >
                Cambiar archivo
              </button>
              <button
                type="button"
                className="carga-usuarios__submit"
                onClick={() => void submit()}
                disabled={isUploading}
              >
                {isUploading ? 'Creando usuarios...' : `Crear ${rows.length} usuario(s)`}
              </button>
            </div>
          </>
        )}

        {summary && (
          <>
            <div className="carga-usuarios__divider" />

            <div className="carga-usuarios__summary">
              <span className="carga-usuarios__summary-badge carga-usuarios__summary-badge--created">
                {summary.creados} creados
              </span>
              <span className="carga-usuarios__summary-badge carga-usuarios__summary-badge--updated">
                {summary.actualizados} actualizados
              </span>
              <span className="carga-usuarios__summary-badge carga-usuarios__summary-badge--error">
                {summary.errores} con error
              </span>
            </div>

            <div className="carga-usuarios__table-wrapper">
              <table className="carga-usuarios__table">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Correo</th>
                    <th>Resultado</th>
                    <th>Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.detalle.map((item) => (
                    <tr key={`${item.fila}-${item.correo}`}>
                      <td>{item.fila}</td>
                      <td>{item.correo}</td>
                      <td>
                        <span
                          className={`carga-usuarios__status carga-usuarios__status--${item.status}`}
                        >
                          {STATUS_LABEL[item.status]}
                        </span>
                      </td>
                      <td>{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="carga-usuarios__footer">
          © {new Date().getFullYear()} Estudio de Moda. Todos los derechos reservados.
        </p>
      </div>

      <div className="carga-usuarios__card">
        <header className="carga-usuarios__header">
          <h1>Exportar usuarios</h1>
          <p>Descarga en Excel los usuarios registrados, opcionalmente filtrados por rol.</p>
        </header>

        <div className="carga-usuarios__export">
          <select
            className="carga-usuarios__select"
            value={rol}
            onChange={(event) => setRol(event.target.value)}
            disabled={isExporting}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="carga-usuarios__submit"
            onClick={() => void exportar()}
            disabled={isExporting}
          >
            {isExporting ? 'Exportando...' : 'Exportar a Excel'}
          </button>
        </div>
      </div>
      </div>
    </AuthLayout>
  )
}

export default CargaUsuarios
