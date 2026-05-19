'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { negocio } from '@/config'

type TurnoDetalle = {
  id: string
  fecha: string
  hora_inicio: string
  simulador_id: number
  cliente: {
    nombre: string
    telefono: string
  }
}

export default function CancelarTokenPage() {
  const { token } = useParams<{ token: string }>()
  const [turno, setTurno] = useState<TurnoDetalle | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'encontrado' | 'noEncontrado' | 'cancelando' | 'cancelado'>('cargando')
  const [ahora] = useState(() => new Date())

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from('turnos')
        .select('id, fecha, hora_inicio, simulador_id, clientes(nombre, telefono)')
        .eq('cancel_token', token)
        .eq('negocio_id', negocio.id)
        .single()

      if (!data) {
        setEstado('noEncontrado')
        return
      }

      const cliente = Array.isArray(data.clientes) ? data.clientes[0] : data.clientes
      setTurno({ id: data.id, fecha: data.fecha, hora_inicio: data.hora_inicio, simulador_id: data.simulador_id, cliente })
      setEstado('encontrado')
    }
    cargar()
  }, [token])

  async function confirmarCancelacion() {
    if (!turno) return
    setEstado('cancelando')

    await supabase.from('turnos').delete().eq('id', turno.id)

    const fechaFormateada = new Date(turno.fecha + 'T12:00:00').toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long'
    })
    const recursoNombre = negocio.recursos.find(r => r.id === turno.simulador_id)?.nombre ?? negocio.recursoNombre + ' ' + turno.simulador_id

    await fetch('/api/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'cancelacion',
        fechaHora: `${fechaFormateada}, ${turno.hora_inicio.slice(0, 5)} hs`,
        turno: `${negocio.emoji} ${recursoNombre}`,
        nombreCliente: turno.cliente.nombre,
        telefonoCliente: turno.cliente.telefono,
        direccion: negocio.direccion,
        linkNegocio: window.location.origin,
      }),
    })

    setEstado('cancelado')
  }

  const dentroDeVentana = useMemo(() => {
    if (!turno || !negocio.cancelacionMinHs) return false
    const slotMs = new Date(`${turno.fecha}T${turno.hora_inicio}`).getTime()
    return slotMs > ahora.getTime() && slotMs <= ahora.getTime() + negocio.cancelacionMinHs * 60 * 60 * 1000
  }, [turno, ahora])

  function formatearFecha(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long'
    })
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-white p-8 max-w-lg mx-auto">
      <div className="mt-12 mb-10">
        <p className="text-xs tracking-[0.4em] uppercase text-[var(--accent)] mb-3">{negocio.nombre}</p>
        <h1 className="text-4xl font-black uppercase tracking-tight">Cancelar<br /><span className="text-[var(--accent)]">turno</span></h1>
      </div>

      {estado === 'cargando' && (
        <p className="text-gray-500 text-sm text-center py-16">Cargando...</p>
      )}

      {estado === 'noEncontrado' && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm mb-2">Este link de cancelación no es válido</p>
          <p className="text-gray-600 text-xs">El turno ya fue cancelado o el link es incorrecto.</p>
        </div>
      )}

      {(estado === 'encontrado' || estado === 'cancelando') && turno && (
        <div>
            <div className="border border-white/10 rounded-2xl p-6 mb-8">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">Detalle del turno</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-0.5">Cliente</p>
                  <p className="font-bold">{turno.cliente.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-0.5">Fecha</p>
                  <p className="font-bold capitalize">{formatearFecha(turno.fecha)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-0.5">Horario</p>
                  <p className="font-bold">{turno.hora_inicio.slice(0, 5)} hs</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-0.5">{negocio.recursoNombre}</p>
                  <p className="font-bold">{negocio.recursoNombre} {turno.simulador_id}</p>
                </div>
              </div>
            </div>

            {dentroDeVentana ? (
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-6">
                  Para cancelar con menos de {negocio.cancelacionMinHs} hs de anticipación contactá al local
                </p>
                <a
                  href={`https://wa.me/${negocio.whatsappNegocio}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-block bg-[#25D366] hover:bg-[#1ebe5d] text-white py-4 rounded-2xl font-black uppercase tracking-widest transition text-sm text-center"
                >
                  Contactar por WhatsApp
                </a>
              </div>
            ) : (
              <button
                onClick={confirmarCancelacion}
                disabled={estado === 'cancelando'}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition text-sm"
              >
                {estado === 'cancelando' ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            )}
        </div>
      )}

      {estado === 'cancelado' && (
        <div className="text-center py-8">
          <div className="text-5xl mb-5">✓</div>
          <h2 className="text-2xl font-black uppercase mb-2">Turno cancelado</h2>
          <p className="text-gray-500 text-sm">Tu turno fue cancelado correctamente.</p>
        </div>
      )}

      <div className="mt-12 text-center">
        <Link href="/" className="text-gray-700 hover:text-gray-500 text-xs tracking-widest uppercase underline transition">
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
