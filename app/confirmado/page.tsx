'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { negocio } from '@/config'

function Confirmado() {
  const searchParams = useSearchParams()
  const tokens = (searchParams.get('tokens') ?? searchParams.get('token') ?? '').split(',').filter(Boolean)
  const fecha = searchParams.get('fecha') ?? ''
  const hora = searchParams.get('hora') ?? ''
  const horas = hora.split(',').filter(Boolean)
  const simus = (searchParams.get('simus') ?? '').split(',').filter(Boolean)
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])

  const fechaFormateada = fecha
    ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  const nombreRecurso = (id: string) => negocio.features?.asignacionAutomatica
    ? negocio.recursoNombre
    : negocio.recursos.find(r => r.id === Number(id))?.nombre ?? `${negocio.recursoNombre} ${id}`

  const waTexto = encodeURIComponent(
    `Reserva ${negocio.nombre}\n📅 ${fechaFormateada}\n⏰ ${horas.length > 1 ? horas.join(", ") : hora} hs\n${negocio.emoji ?? '🏎'} ${simus.map(s => nombreRecurso(s)).join(', ')}\n\nLinks de cancelación:\n` +
    tokens.map((t, i) => `${nombreRecurso(simus[i] ?? String(i + 1))}: ${origin}/cancelar/${t}`).join('\n')
  )

  return (
    <>
      {negocio.id === 'prgrssv' && (
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.72)), url(/bg-prgrssv.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      <main className={`min-h-screen text-white p-8 max-w-lg mx-auto mt-12${negocio.id === 'prgrssv' ? '' : ' bg-[var(--bg)]'}`}>
      <div className="text-center mb-10">
        <div className="text-6xl mb-5">{negocio.emoji ?? '🏁'}</div>
        <h1 className="text-4xl font-black uppercase mb-2">
          {tokens.length === 1 ? 'Turno confirmado' : 'Turnos confirmados'}
        </h1>
        <p className="text-[var(--accent)] text-xs tracking-widest uppercase">{negocio.nombre} · {negocio.direccion}</p>
      </div>

      {/* Resumen */}
      {fecha && hora && (
        <div className="border border-white/10 rounded-xl p-5 mb-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Fecha</p>
            <p className="text-sm font-medium capitalize">{fechaFormateada}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Horario</p>
            <p className="text-sm font-medium">{horas.length > 1 ? horas.join(' · ') + ' hs' : hora + ' hs'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">
              {simus.length === 1 ? negocio.recursoNombre : negocio.recursoNombrePlural}
            </p>
            <p className="text-sm font-medium">{simus.map((s) => nombreRecurso(s)).join(' · ')}</p>
          </div>
        </div>
      )}

      {/* Links de cancelación */}
      <div className="border border-white/10 rounded-xl p-5 mb-4">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Cancelación</p>
        <div className="space-y-3">
          {tokens.map((token, i) => {
            const cancelUrl = origin + '/cancelar/' + token
            return (
              <div key={token} className={tokens.length > 1 && i < tokens.length - 1 ? 'pb-3 border-b border-white/5' : ''}>
                {tokens.length > 1 && (
                  <p className="text-xs text-gray-700 mb-1 uppercase tracking-widest">{nombreRecurso(simus[i] ?? String(i + 1))}</p>
                )}
                <a href={cancelUrl} className="text-[var(--accent)] text-sm font-bold underline underline-offset-2 hover:opacity-80 transition">Cancelar este turno</a>
              </div>
            )
          })}
        </div>
      </div>

      {/* WhatsApp */}
      <a
        href={`https://wa.me/?text=${waTexto}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full border border-[var(--accent)]/40 hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 text-[var(--accent)] rounded-xl p-4 text-sm font-bold uppercase tracking-widest transition mb-4"
      >
        <span>Compartir por WhatsApp</span>
      </a>

      <a href="/" className="block text-center text-gray-600 text-sm underline">
        Volver al inicio
      </a>
    </main>
    </>
  )
}

export default function ConfirmadoPage() {
  return (
    <Suspense>
      <Confirmado />
    </Suspense>
  )
}
