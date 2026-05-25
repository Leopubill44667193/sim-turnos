'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { negocio } from '@/config'
import { generarHorarios, calcularUmbral, horaValida, esDiaHabil, toMin } from '@/lib/config'
import CalendarioInline from '@/components/CalendarioInline'

const HORARIOS = generarHorarios(negocio.horario.inicioMin, negocio.horario.finMin, negocio.horario.intervaloMinutos)
const UMBRAL = calcularUmbral(negocio.horario.finMin)

export default function ReservarIdPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()

  useEffect(() => {
    if (negocio.id === 'landing') router.push('/')
  }, [])

  if (negocio.id === 'landing') return null

  const [simuladorId, setSimuladorId] = useState('')
  const [fecha, setFecha] = useState('')
  const [horasSeleccionadas, setHorasSeleccionadas] = useState<string[]>([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cargando, setCargando] = useState(false)
  const [turnosHoras, setTurnosHoras] = useState<string[]>([])
  const [slotsBloqHoras, setSlotsBloqHoras] = useState<string[]>([])
  const [fechaBloqueada, setFechaBloqueada] = useState(false)
  const [diaNoHabil, setDiaNoHabil] = useState(false)
  const [horariosBloqueados, setHorariosBloqueados] = useState<string[]>([])

  useEffect(() => {
    params.then((p) => setSimuladorId(p.id))
  }, [params])

  useEffect(() => {
    if (!fecha || !simuladorId) return
    const fetchDatos = async () => {
      if (!esDiaHabil(fecha, negocio.diasHabiles)) {
        setDiaNoHabil(true)
        setFechaBloqueada(false)
        return
      }
      setDiaNoHabil(false)
      const [{ data: turnosData }, { data: bloqueo }, { data: horBloq }, { data: slotsBloq }] = await Promise.all([
        supabase.from('turnos').select('hora_inicio').eq('simulador_id', Number(simuladorId)).eq('fecha', fecha).eq('negocio_id', negocio.id),
        supabase.from('dias_bloqueados').select('fecha').eq('fecha', fecha).eq('negocio_id', negocio.id).single(),
        supabase.from('horarios_bloqueados').select('hora').eq('fecha', fecha).eq('negocio_id', negocio.id),
        supabase.from('slots_bloqueados').select('hora').eq('negocio_id', negocio.id).eq('recurso_id', Number(simuladorId)).eq('fecha', fecha),
      ])
      setFechaBloqueada(!!bloqueo)
      setHorariosBloqueados((horBloq ?? []).map((h) => h.hora.slice(0, 5)))
      setTurnosHoras((turnosData ?? []).map((t) => t.hora_inicio.slice(0, 5)))
      setSlotsBloqHoras((slotsBloq ?? []).map((s) => s.hora.slice(0, 5)))
    }
    fetchDatos()
    setHorasSeleccionadas([])
  }, [fecha, simuladorId])

  function toggleHora(hora: string) {
    setHorasSeleccionadas((prev) => {
      if (prev.includes(hora)) return prev.filter((h) => h !== hora)
      if (prev.length >= 4) return prev
      return [...prev, hora]
    })
  }

  async function confirmarReserva() {
    setCargando(true)

    const validacion = await fetch('/api/validar-reserva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio_id: negocio.id, telefono, nombre }),
    })
    if (!validacion.ok) {
      const data = await validacion.json().catch(() => ({}))
      alert(data.error ?? 'Error de validación')
      setCargando(false)
      return
    }

    let clienteId
    const { data: clienteExistente } = await supabase.from('clientes').select('id').eq('telefono', telefono).eq('negocio_id', negocio.id).single()
    if (clienteExistente) {
      clienteId = clienteExistente.id
      await supabase.from('clientes').update({ nombre }).eq('id', clienteId)
    } else {
      const { data: nuevoCliente, error } = await supabase.from('clientes').insert({ nombre, telefono, negocio_id: negocio.id }).select('id').single()
      if (error || !nuevoCliente) { alert('Error al guardar el cliente'); setCargando(false); return }
      clienteId = nuevoCliente.id
    }

    const tokens: string[] = []
    for (const hora of horasSeleccionadas) {
      const [horas, minutos] = hora.split(':').map(Number)
      const horaFin = String((horas + 1) % 24).padStart(2, '0') + ':' + String(minutos).padStart(2, '0')
      const { data: turnoCreado, error: errorTurno } = await supabase.from('turnos').insert({
        negocio_id: negocio.id,
        simulador_id: Number(simuladorId),
        cliente_id: clienteId,
        fecha,
        hora_inicio: hora,
        hora_fin: horaFin,
      }).select('cancel_token').single()
      if (errorTurno || !turnoCreado) { alert('Error al guardar el turno ' + hora); setCargando(false); return }
      tokens.push(turnoCreado.cancel_token)
    }

    await notificarReserva(nombre, telefono, fecha, horasSeleccionadas, simuladorId, tokens)
    router.push(`/confirmado?tokens=${tokens.join(',')}&fecha=${fecha}&hora=${horasSeleccionadas.join(',')}&simus=${simuladorId}`)
  }

  async function notificarReserva(nombre: string, telefono: string, fecha: string, horas: string[], simId: string, tokens: string[]) {
    const fechaFmt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    const horasTexto = horas.length === 1 ? horas[0] + ' hs' : horas.join(', ') + ' hs'
    const recursoNombre = negocio.recursos.find(r => r.id === Number(simId))?.nombre ?? negocio.recursoNombre + ' ' + simId
    const linkCancelacion = tokens.map(t => `${window.location.origin}/cancelar/${t}`).join('\n')
    await fetch('/api/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'confirmacion',
        fechaHora: `${fechaFmt}, ${horasTexto}`,
        turno: `${negocio.emoji} ${recursoNombre}`,
        nombreCliente: nombre,
        telefonoCliente: telefono,
        direccion: negocio.direccion,
        linkCancelacion,
      }),
    })
  }

  function horaConflicto(hora: string): boolean {
    const s = toMin(hora)
    const d = negocio.duracionMinutos
    return (
      turnosHoras.some(t => { const tm = toMin(t); return s >= tm && s < tm + d }) ||
      slotsBloqHoras.some(b => { const bm = toMin(b); return s >= bm && s < bm + d }) ||
      horariosBloqueados.some(b => { const bm = toMin(b); return s >= bm && s < bm + d })
    )
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-white">
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-widest uppercase">
            <span className="text-[var(--accent)]">{negocio.nombreDisplay?.parte1 ?? negocio.nombre.split('.')[0] + '.'}</span>
            {negocio.nombreDisplay ? negocio.nombreDisplay.parte2 : negocio.nombre.split('.').slice(1).join('.')}
          </h1>
          <p className="text-xs text-gray-600 tracking-wider uppercase mt-0.5">{negocio.direccion}</p>
        </div>
        <a href="/" className="text-xs text-gray-600 hover:text-[var(--accent)] tracking-widest uppercase transition">← Volver</a>
      </div>

      <div className="max-w-xl mx-auto px-8 py-12">
        <p className="text-xs tracking-[0.4em] uppercase text-[var(--accent)] mb-2">Reserva</p>
        <h2 className="text-4xl font-black uppercase mb-1">{negocio.recursoNombre} {simuladorId}</h2>
        <p className="text-gray-600 text-sm mb-10">Turnos de {negocio.duracionMinutos} min · Hasta 4 turnos</p>

        <div className="mb-8">
          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-3">Fecha</label>
          <CalendarioInline
            value={fecha}
            onChange={setFecha}
            diasHabiles={negocio.diasHabiles}
          />
        </div>

        {fecha && diaNoHabil && (
          <div className="mb-8 bg-white/5 border border-white/10 rounded-xl px-5 py-4">
            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-1">No atendemos ese día</p>
            <p className="text-gray-600 text-xs">Elegí un día hábil.</p>
          </div>
        )}

        {fecha && !diaNoHabil && fechaBloqueada && (
          <div className="mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-4">
            <p className="text-yellow-400 font-bold text-sm uppercase tracking-widest mb-1">Día no disponible</p>
            <p className="text-yellow-700 text-xs">El local no abre este día. Elegí otra fecha.</p>
          </div>
        )}

        {fecha && !diaNoHabil && !fechaBloqueada && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs uppercase tracking-widest text-gray-500">Horario disponible</label>
              <span className="text-xs text-gray-600">
                {horasSeleccionadas.length > 0
                  ? <><span className="text-[var(--accent)]/80">{horasSeleccionadas.length}</span>/4 seleccionados</>
                  : 'Hasta 4 turnos'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {HORARIOS.map((hora) => {
                const ocupado = horaConflicto(hora) || !horaValida(hora, fecha, UMBRAL, negocio.anticipacionMinHs)
                const seleccionado = horasSeleccionadas.includes(hora)
                const lleno = !seleccionado && horasSeleccionadas.length >= 4
                return (
                  <button key={hora} onClick={() => !ocupado && toggleHora(hora)} disabled={ocupado || lleno}
                    className={'rounded-xl py-3 text-center text-sm font-medium transition border ' +
                      (ocupado ? 'border-white/5 text-gray-700 cursor-not-allowed line-through ' : '') +
                      (lleno ? 'border-white/5 text-gray-700 cursor-not-allowed ' : '') +
                      (seleccionado ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]/80 ' : '') +
                      (!ocupado && !seleccionado && !lleno ? 'border-white/10 hover:border-[var(--accent)] hover:text-[var(--accent)]/80 text-gray-300' : '')}>
                    {hora}
                  </button>
                )
              })}
            </div>
            {horasSeleccionadas.length > 0 && (
              <button onClick={() => setHorasSeleccionadas([])} className="mt-3 text-xs text-gray-600 hover:text-[var(--accent)]/80 transition uppercase tracking-widest">
                Limpiar selección
              </button>
            )}
          </div>
        )}

        {horasSeleccionadas.length > 0 && (
          <div className="mb-8 border border-white/10 rounded-xl p-6">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">Tus datos</p>
            <div className="mb-4">
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Nombre y apellido</label>
              <input type="text" className="bg-white/5 border border-white/10 rounded-xl p-3 w-full text-white focus:border-[var(--accent)] outline-none text-sm" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Telefono</label>
              <input type="tel" className="bg-white/5 border border-white/10 rounded-xl p-3 w-full text-white focus:border-[var(--accent)] outline-none text-sm" value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/[^0-9]/g, ''))} placeholder="11 1234-5678" />
            </div>
          </div>
        )}

        {nombre && telefono && horasSeleccionadas.length > 0 && (
          <button onClick={confirmarReserva} disabled={cargando} className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl p-4 font-black uppercase tracking-widest transition disabled:opacity-50 text-sm">
            {cargando ? 'Guardando...' : `Confirmar ${horasSeleccionadas.length === 1 ? 'turno' : horasSeleccionadas.length + ' turnos'}`}
          </button>
        )}
      </div>
    </main>
  )
}
