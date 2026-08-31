import { useState } from 'react'
import type { FormEvent } from 'react'
import './ReportarModal.css'
import type { HistorialCodigo } from '../../models/code'
import type { PersonData } from '../../models/auth'
import { formatFechaHistorial, formatValorCompra } from '../../Funcionalidades/code/utils/otp.utils'
import type { GraphMailPayload } from '../../models/mail'
import { useAuth } from '../../Funcionalidades/authentication/hooks/useAuthentication'

interface ReportarModalProps {
  codigo: HistorialCodigo
  persona: PersonData
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (razon: string, p: GraphMailPayload) => void
}

function ReportarModal({ codigo, persona, isSubmitting, onClose, onSubmit }: ReportarModalProps) {
  const [razon, setRazon] = useState('')
  const [razonError, setRazonError] = useState<string | null>(null)
  const { person, } = useAuth()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!razon.trim()) {
      setRazonError('Escribe la razon del reporte')
      return
    }

    const p: GraphMailPayload = {
      message: {
        attachments: [],
        body: {
          content: 
            `<!DOCTYPE html>
              <html lang="es">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <title>Reporte de uso indebido de código OTP</title>
                </head>

                <body
                  style="
                  margin: 0;
                  padding: 0;
                  background-color: #f4f6f8;
                  font-family: Arial, Helvetica, sans-serif;
                  color: #172033;">
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="background-color: #f4f6f8; padding: 24px 12px;"
                  >
                  <tr>
                    <td align="center">
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          max-width: 680px;
                          background-color: #ffffff;
                          border-radius: 16px;
                          overflow: hidden;
                          border: 1px solid #e3e8ef;
                          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
                        ">
                      <!-- Logo -->
                        <tr>
                          <td
                            align="center"
                            style="padding: 28px 24px 22px 24px;"
                          >
                            <table
                              role="presentation"
                              cellspacing="0"
                              cellpadding="0"
                              border="0"
                            >
                              <tr>
                                <td
                                  align="center"
                                  valign="middle"
                                  style="
                                    width: 42px;
                                    height: 42px;
                                    border: 2px solid #0d3b78;
                                    border-radius: 50%;
                                    color: #0d3b78;
                                    font-size: 22px;
                                    font-weight: bold;
                                    ">
                                    🔒
                                </td>

                                <td
                                  valign="middle"
                                  style="
                                    padding-left: 10px;
                                    color: #0d3b78;
                                    font-size: 26px;
                                    font-weight: 700;
                                  ">
                                    ESTUDIO DE MODA
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Encabezado -->
                        <tr>
                          <td
                            style="
                              padding: 34px 42px;
                              background-color: #0d3b78;
                              background-image: linear-gradient(135deg, #0d3b78, #0755a5);
                            ">
                            <table
                              role="presentation"
                              width="100%"
                              cellspacing="0"
                              cellpadding="0"
                              border="0"
                            >
                            <tr>
                              <td
                                valign="top"
                                style="padding-right: 20px;"
                              >
                                <div
                                  style="
                                  margin-bottom: 16px;
                                  font-size: 34px;
                                  line-height: 1;
                                ">
                                  ⚠️
                                </div>

                                <h1
                                  style="
                                  margin: 0 0 14px 0;
                                  color: #ffffff;
                                  font-size: 30px;
                                  line-height: 1.25;
                                  font-weight: 700;
                                  ">
                                  Reporte de uso indebido de código OTP
                                </h1>

                                <p
                                  style="
                                  margin: 0;
                                  color: #e7f0fb;
                                  font-size: 17px;
                                  line-height: 1.6;">
                                    Se ha reportado un posible uso indebido de un código OTP.
                                    A continuación se muestran los detalles de la operación.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Contenido -->
                      <tr>
                        <td style="padding: 36px 42px;">
                          <p
                            style="
                              margin: 0 0 28px 0;
                              color: #344054;
                              font-size: 16px;
                              line-height: 1.65;
                            ">
                            El reporte fue registrado correctamente. Por favor, verifica
                            la siguiente información para realizar el seguimiento
                            correspondiente.
                          </p>

                          <!-- Tienda -->
                          <table
                            role="presentation"
                            width="100%"
                            cellspacing="0"
                            cellpadding="0"
                            border="0"
                            style="
                              border-bottom: 1px solid #e7ebf0;
                              margin-bottom: 18px;
                              padding-bottom: 18px;
                            "
                          >
                        <tr>
                          <td
                            width="58"
                            valign="top"
                            style="padding-right: 16px;"
                          >
                            <div
                              style="
                                width: 48px;
                                height: 48px;
                                line-height: 48px;
                                text-align: center;
                                background-color: #eaf2ff;
                                border-radius: 12px;
                                font-size: 24px;
                              "
                            >
                              🏬
                            </div>
                          </td>

                          <td valign="top">
                            <p
                              style="
                                margin: 0 0 5px 0;
                                color: #667085;
                                font-size: 14px;
                              "
                            >
                              Tienda
                            </p>

                            <p
                              style="
                                margin: 0;
                                color: #667085;
                                font-size: 14px;
                                line-height: 1.5;
                              "
                            >
                              Generado en: ${codigo.generateIn}<br />
                              Redimido en: ${codigo.redeemIn}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <!-- Código OTP -->
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          border-bottom: 1px solid #e7ebf0;
                          margin-bottom: 18px;
                          padding-bottom: 18px;
                        "
                      >
                        <tr>
                          <td
                            width="58"
                            valign="top"
                            style="padding-right: 16px;"
                          >
                            <div
                              style="
                                width: 48px;
                                height: 48px;
                                line-height: 48px;
                                text-align: center;
                                background-color: #eaf2ff;
                                border-radius: 12px;
                                font-size: 24px;
                              "
                            >
                              🔐
                            </div>
                          </td>

                          <td valign="top">
                            <p
                              style="
                                margin: 0 0 8px 0;
                                color: #667085;
                                font-size: 14px;
                              "
                            >
                              Código OTP
                            </p>

                            <div
                              style="
                                display: inline-block;
                                padding: 12px 18px;
                                background-color: #edf4ff;
                                border: 1px solid #b8d3ff;
                                border-radius: 10px;
                                color: #0d3b78;
                                font-size: 26px;
                                font-weight: 700;
                                letter-spacing: 6px;
                              "
                            >
                              ${codigo.code}
                            </div>
                          </td>
                        </tr>
                      </table>

                      <!-- Usuario -->
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          border-bottom: 1px solid #e7ebf0;
                          margin-bottom: 18px;
                          padding-bottom: 18px;
                        "
                      >
                        <tr>
                          <td
                            width="58"
                            valign="top"
                            style="padding-right: 16px;"
                          >
                            <div
                              style="
                                width: 48px;
                                height: 48px;
                                line-height: 48px;
                                text-align: center;
                                background-color: #eaf2ff;
                                border-radius: 12px;
                                font-size: 24px;
                              "
                            >
                              👤
                            </div>
                          </td>

                          <td valign="top">
                            <p
                              style="
                                margin: 0 0 5px 0;
                                color: #667085;
                                font-size: 14px;
                              "
                            >
                              Usuario
                            </p>

                            <p
                              style="
                                margin: 0 0 5px 0;
                                color: #101828;
                                font-size: 18px;
                                font-weight: 700;
                              "
                            >
                              ${person?.nombres} ${person?.apellidos}
                            </p>

                            <p
                              style="
                                margin: 0;
                                color: #667085;
                                font-size: 14px;
                              "
                            >
                              Cédula: ${person?.numero_documento}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <!-- Valor -->
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="margin-bottom: 30px;"
                      >
                        <tr>
                          <td
                            width="58"
                            valign="top"
                            style="padding-right: 16px;"
                          >
                            <div
                              style="
                                width: 48px;
                                height: 48px;
                                line-height: 48px;
                                text-align: center;
                                background-color: #eaf2ff;
                                border-radius: 12px;
                                font-size: 24px;
                              "
                            >
                              💰
                            </div>
                          </td>

                          <td valign="top">
                            <p
                              style="
                                margin: 0 0 5px 0;
                                color: #667085;
                                font-size: 14px;
                              "
                            >
                              Valor
                            </p>

                            <p
                              style="
                                margin: 0;
                                color: #101828;
                                font-size: 22px;
                                font-weight: 700;
                              "
                            >
                              ${codigo.purchaseValue}
                            </p>
                          </td>
                        </tr>
                      </table>

                                    <!-- Alerta -->
                                    <table
                                      role="presentation"
                                      width="100%"
                                      cellspacing="0"
                                      cellpadding="0"
                                      border="0"
                                      style="
                                        background-color: #fff4f4;
                                        border: 1px solid #ffc9c9;
                                        border-radius: 12px;
                                      "
                                    >
                                      <tr>
                                        <td
                                          width="58"
                                          valign="top"
                                          style="padding: 20px 10px 20px 20px;"
                                        >
                                          <div
                                            style="
                                              font-size: 28px;
                                              line-height: 1;
                                            "
                                          >
                                            🛡️
                                          </div>
                                        </td>

                                        <td style="padding: 18px 20px 18px 0;">
                                          <p
                                            style="
                                              margin: 0 0 6px 0;
                                              color: #a61b1b;
                                              font-size: 16px;
                                              font-weight: 700;
                                            "
                                          >
                                            Reporte registrado
                                          </p>

                                          <p
                                            style="
                                              margin: 0;
                                              color: #7a271a;
                                              font-size: 14px;
                                              line-height: 1.6;
                                            "
                                          >
                                            Este caso debe ser revisado para determinar si la
                                            generación o redención del código fue autorizada.
                                          </p>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>

                                <!-- Pie -->
                                <tr>
                                  <td
                                    align="center"
                                    style="
                                      padding: 24px 32px;
                                      background-color: #f8fafc;
                                      border-top: 1px solid #e7ebf0;
                                    "
                                  >
                                    <p
                                      style="
                                        margin: 0;
                                        color: #667085;
                                        font-size: 12px;
                                        line-height: 1.6;
                                      "
                                    >
                                      Este es un mensaje automático. Por favor, no respondas
                                      directamente a este correo.
                                    </p>
                                  </td>
                                </tr>
                              </table>

                            </td>
                          </tr>
                        </table>
                      </body>
            </html>`,
          contentType: "HTML"
        },
        subject: "Reporte de uso indebido",
        toRecipients: [
          {
            emailAddress: {
              address: "dpalacios@estudiodemoda.com.co"
            }
          }
        ],
        ccRecipients: []
      },
      saveToSentItems: true,
      senderMail: "alert@estudiodemoda.com.co"
    }

    setRazonError(null)
    onSubmit(razon.trim(), p)
  }

  return (
    <div className="reportar-modal__overlay" role="presentation" onClick={onClose}>
      <div
        className="reportar-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reportar-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="reportar-modal__header">
          <h2 id="reportar-modal-title">Reportar codigo</h2>
          <button
            type="button"
            className="reportar-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={isSubmitting}
          >
            ×
          </button>
        </header>

        <div className="reportar-modal__info">
          <div className="reportar-modal__info-row">
            <span>Codigo</span>
            <strong>{codigo.code ?? 'Sin codigo'}</strong>
          </div>
          <div className="reportar-modal__info-row">
            <span>Valor</span>
            <strong>{formatValorCompra(codigo.purchaseValue)}</strong>
          </div>
          <div className="reportar-modal__info-row">
            <span>Estado</span>
            <strong>{codigo.status}</strong>
          </div>
          <div className="reportar-modal__info-row">
            <span>Generado</span>
            <strong>{formatFechaHistorial(codigo.generatedAt)}</strong>
          </div>
          <div className="reportar-modal__info-row">
            <span>Redimido</span>
            <strong>{formatFechaHistorial(codigo.redeemedAt)}</strong>
          </div>

          <div className="reportar-modal__divider" />

          <div className="reportar-modal__info-row">
            <span>Persona</span>
            <strong>
              {persona.nombres} {persona.apellidos}
            </strong>
          </div>
          <div className="reportar-modal__info-row">
            <span>Cedula</span>
            <strong>{persona.numero_documento}</strong>
          </div>
        </div>

        <form className="reportar-modal__form" onSubmit={handleSubmit} noValidate>
          <div className="reportar-modal__field">
            <label htmlFor="razon">Razon del reporte *</label>
            <textarea
              id="razon"
              name="razon"
              rows={4}
              placeholder="Describe por que este codigo se esta reportando"
              value={razon}
              onChange={(event) => {
                setRazon(event.target.value)
                setRazonError(null)
              }}
              disabled={isSubmitting}
            />
            {razonError && <span className="reportar-modal__field-error">{razonError}</span>}
          </div>

          <div className="reportar-modal__actions">
            <button
              type="button"
              className="reportar-modal__cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button type="submit" className="reportar-modal__submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ReportarModal
