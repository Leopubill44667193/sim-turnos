'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { negocio } from '@/config'
import { generarHorarios, calcularUmbral, horaValida, esDiaHabil, toMin } from '@/lib/config'
import CalendarioInline from '@/components/CalendarioInline'

const HORARIOS = generarHorarios(negocio.horario.inicioMin, negocio.horario.finMin, negocio.horario.intervaloMinutos)
const RECURSOS = negocio.recursos
const UMBRAL = calcularUmbral(negocio.horario.finMin)


export default function ReservarPage() {
  const router = useRouter()

  useEffect(() => {
    if (negocio.id === 'landing') router.push('/')
  }, [])

  if (negocio.id === 'landing') return null

  const [fecha, setFecha] = useState('')
  const [horaSeleccionada, setHoraSeleccionada] = useState('')
  const [recursosSeleccionados, setRecursosSeleccionados] = useState<number[]>([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cargando, setCargando] = useState(false)
  const [turnosPorHora, setTurnosPorHora] = useState<Record<string, number[]>>({})
  const [slotsBloqList, setSlotsBloqList] = useState<Array<{ recurso_id: number; hora: string; motivo: string | null }>>([])
  const [fechaBloqueada, setFechaBloqueada] = useState(false)
  const [diaNoHabil, setDiaNoHabil] = useState(false)
  const [horariosBloqueados, setHorariosBloqueados] = useState<string[]>([])
  const [emailVerificado, setEmailVerificado] = useState<string | null>(null)
  const draftRef = useRef<{ hora: string; recursos: number[] } | null>(null)

  useEffect(() => {
    if (!fecha) return
    const fetchDatos = async () => {
      if (!esDiaHabil(fecha, negocio.diasHabiles)) {
        setDiaNoHabil(true)
        setFechaBloqueada(false)
        return
      }
      setDiaNoHabil(false)
      const [{ data: turnosData, error: errorFetch }, { data: bloqueo }, { data: horBloq }, { data: slotsBloq }] = await Promise.all([
        supabase.from('turnos').select('hora_inicio, simulador_id').eq('fecha', fecha).eq('negocio_id', negocio.id),
        supabase.from('dias_bloqueados').select('fecha').eq('fecha', fecha).eq('negocio_id', negocio.id).single(),
        supabase.from('horarios_bloqueados').select('hora').eq('fecha', fecha).eq('negocio_id', negocio.id),
        supabase.from('slots_bloqueados').select('recurso_id, hora, motivo').eq('fecha', fecha).eq('negocio_id', negocio.id),
      ])
      if (errorFetch) {
        alert('Error al cargar disponibilidad. Recargá la página e intentá de nuevo.\n' + errorFetch.message)
        return
      }
      setFechaBloqueada(!!bloqueo)
      setHorariosBloqueados((horBloq ?? []).map((h) => h.hora.slice(0, 5)))
      const mapa: Record<string, number[]> = {}
      for (const t of turnosData ?? []) {
        const h = t.hora_inicio.slice(0, 5)
        if (!mapa[h]) mapa[h] = []
        mapa[h].push(t.simulador_id)
      }
      setTurnosPorHora(mapa)
      setSlotsBloqList((slotsBloq ?? []).map((s) => ({ recurso_id: s.recurso_id, hora: s.hora.slice(0, 5), motivo: s.motivo ?? null })))
      if (draftRef.current) {
        const { hora, recursos } = draftRef.current
        draftRef.current = null
        setHoraSeleccionada(hora)
        setRecursosSeleccionados(recursos)
      }
    }
    fetchDatos()
    setHoraSeleccionada('')
    setRecursosSeleccionados([])
  }, [fecha])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setEmailVerificado(session.user.email)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmailVerificado(session?.user?.email ?? null)
    })
    const raw = sessionStorage.getItem('reservar_draft')
    if (raw) {
      try {
        const d = JSON.parse(raw)
        if (d.nombre) setNombre(d.nombre)
        if (d.telefono) setTelefono(d.telefono)
        if (d.fecha) setFecha(d.fecha)
        if (d.horaSeleccionada && d.recursosSeleccionados) {
          draftRef.current = { hora: d.horaSeleccionada, recursos: d.recursosSeleccionados }
        }
      } catch {}
      sessionStorage.removeItem('reservar_draft')
    }
    return () => subscription.unsubscribe()
  }, [])

  function recursosOcupados(hora: string): number[] {
    const s = toMin(hora)
    const d = negocio.duracionMinutos
    const result = new Set<number>()
    for (const [h, ids] of Object.entries(turnosPorHora)) {
      const t = toMin(h)
      if (s < t + d && t < s + d) ids.forEach(id => result.add(id))
    }
    for (const b of slotsBloqList) {
      const bm = toMin(b.hora)
      const bd = b.motivo ? d : negocio.horario.intervaloMinutos
      if (s < bm + bd && bm < s + d) result.add(b.recurso_id)
    }
    return [...result]
  }

  function horaBloqueada(hora: string): boolean {
    const s = toMin(hora)
    const d = negocio.duracionMinutos
    return horariosBloqueados.some(b => { const bm = toMin(b); return s >= bm && s < bm + d })
  }

  function seleccionarHora(hora: string) {
    setHoraSeleccionada(hora)
    setRecursosSeleccionados([])
  }

  function toggleRecurso(id: number) {
    if (recursosOcupados(horaSeleccionada).includes(id)) return
    setRecursosSeleccionados((prev) =>
      negocio.seleccionSimple
        ? prev.includes(id) ? [] : [id]
        : prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  async function verificarConGoogle() {
    sessionStorage.setItem('reservar_draft', JSON.stringify({
      fecha, horaSeleccionada, recursosSeleccionados, nombre, telefono,
    }))
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/reservar' },
    })
  }

  async function confirmarReserva() {
    setCargando(true)

    if (!emailVerificado) {
      alert('Necesitás verificar tu identidad con Google antes de confirmar.')
      setCargando(false)
      return
    }

    let recursosAUsar = recursosSeleccionados
    if (negocio.features?.asignacionAutomatica) {
      const ocupados = recursosOcupados(horaSeleccionada)
      const libre = RECURSOS.find(r => !ocupados.includes(r.id))
      if (!libre) {
        alert('No hay canchas disponibles para ese horario.')
        setCargando(false)
        return
      }
      recursosAUsar = [libre.id]
    }

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
      if (error || !nuevoCliente) { alert('Error al guardar el cliente: ' + (error?.message ?? 'sin datos')); setCargando(false); return }
      clienteId = nuevoCliente.id
    }

    const [horas, minutos] = horaSeleccionada.split(':').map(Number)
    const totalMin = horas * 60 + minutos + negocio.duracionMinutos
    const horaFin = String(Math.floor(totalMin / 60) % 24).padStart(2, '0') + ':' + String(totalMin % 60).padStart(2, '0')

    const { data: ocupados } = await supabase
      .from('turnos')
      .select('simulador_id')
      .eq('negocio_id', negocio.id)
      .eq('fecha', fecha)
      .eq('hora_inicio', horaSeleccionada)
      .in('simulador_id', recursosAUsar)
    if (ocupados && ocupados.length > 0) {
      alert('Ese horario ya fue reservado por otro. Por favor elegí otro horario.')
      setCargando(false)
      return
    }

    const tokens: string[] = []
    for (const simId of recursosAUsar) {
      const { data: turnoCreado, error: errorTurno } = await supabase.from('turnos').insert({
        negocio_id: negocio.id,
        simulador_id: simId,
        cliente_id: clienteId,
        fecha,
        hora_inicio: horaSeleccionada,
        hora_fin: horaFin,
        ...(emailVerificado ? { email_verificacion: emailVerificado } : {}),
      }).select('cancel_token').single()
      if (errorTurno || !turnoCreado) {
        const msg = errorTurno?.code === '23505'
          ? 'Ese horario ya fue reservado por otro. Por favor elegí otro horario.'
          : 'Error al guardar turno en ' + negocio.recursoNombre + ' ' + simId + '\n' + errorTurno?.code + ': ' + errorTurno?.message
        alert(msg)
        setCargando(false)
        return
      }
      tokens.push(turnoCreado.cancel_token)
    }

    await notificarReserva(nombre, telefono, fecha, horaSeleccionada, recursosAUsar, tokens)
    router.push(`/confirmado?tokens=${tokens.join(',')}&fecha=${fecha}&hora=${horaSeleccionada}&simus=${recursosAUsar.join(',')}`)
  }

  async function notificarReserva(nombre: string, telefono: string, fecha: string, hora: string, recursos: number[], tokens: string[]) {
    const fechaFmt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    const recursoTexto = negocio.features?.asignacionAutomatica
      ? negocio.recursoNombre
      : recursos.length === 1
        ? `${negocio.recursoNombre} ${recursos[0]}`
        : `${negocio.recursoNombrePlural} ${recursos.join(', ')}`
    const linkCancelacion = tokens.map(t => `${window.location.origin}/cancelar/${t}`).join('\n')
    await fetch('/api/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'confirmacion',
        fechaHora: `${fechaFmt}, ${hora} hs`,
        turno: `${negocio.emoji} ${recursoTexto}`,
        nombreCliente: nombre,
        telefonoCliente: telefono,
        direccion: negocio.direccion,
        linkCancelacion,
      }),
    })
  }

  const ocupadosEnHora = horaSeleccionada ? recursosOcupados(horaSeleccionada) : []
  const disponiblesEnHora = (hora: string) => RECURSOS.length - recursosOcupados(hora).length

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
        <p className="text-xs tracking-[0.4em] uppercase text-[var(--accent)] mb-2">Nueva reserva</p>
        <h2 className="text-4xl font-black uppercase mb-10">Elegí tu turno</h2>

        {/* Fecha */}
        <div className="mb-8">
          <label className="block text-xs uppercase tracking-widest text-gray-500 mb-3">Fecha</label>
          <CalendarioInline
            value={fecha}
            onChange={setFecha}
            diasHabiles={negocio.diasHabiles}
          />
        </div>

        {/* Día no hábil */}
        {fecha && diaNoHabil && (
          <div className="mb-8 bg-white/5 border border-white/10 rounded-xl px-5 py-4">
            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-1">No atendemos ese día</p>
            <p className="text-gray-600 text-xs">Elegí un día hábil.</p>
          </div>
        )}

        {/* Fecha bloqueada */}
        {fecha && !diaNoHabil && fechaBloqueada && (
          <div className="mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-4">
            <p className="text-yellow-400 font-bold text-sm uppercase tracking-widest mb-1">Día no disponible</p>
            <p className="text-yellow-700 text-xs">El local no abre este día. Elegí otra fecha.</p>
          </div>
        )}

        {/* Horario */}
        {fecha && !diaNoHabil && !fechaBloqueada && (
          <div className="mb-8">
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-3">Horario</label>
            <div className="grid grid-cols-4 gap-2">
              {HORARIOS.map((hora) => {
                if (negocio.features?.asignacionAutomatica) {
                  const disp = disponiblesEnHora(hora)
                  const pasado = !horaValida(hora, fecha, UMBRAL, negocio.anticipacionMinHs)
                  const bloqueado = horaBloqueada(hora)
                  if (disp === 0 || pasado || bloqueado) return null
                }
                const disp = disponiblesEnHora(hora)
                const pasado = !horaValida(hora, fecha, UMBRAL, negocio.anticipacionMinHs)
                const bloqueado = horaBloqueada(hora)
                const lleno = disp === 0 || pasado || bloqueado
                const seleccionado = horaSeleccionada === hora
                return (
                  <button
                    key={hora}
                    onClick={() => !lleno && seleccionarHora(hora)}
                    disabled={lleno}
                    className={'rounded-xl py-3 px-2 text-center text-sm font-medium transition border flex flex-col items-center gap-1 ' +
                      (lleno ? 'border-white/5 text-gray-700 cursor-not-allowed ' : '') +
                      (seleccionado ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]/80 ' : '') +
                      (!lleno && !seleccionado ? 'border-white/10 hover:border-[var(--accent)] hover:text-[var(--accent)]/80 text-gray-300' : '')}
                  >
                    <span>{hora}</span>
                    <span className={'text-xs ' + (lleno ? 'text-gray-700' : seleccionado ? 'text-[var(--accent)]/50' : 'text-gray-600')}>
                      {pasado ? 'pasado' : bloqueado ? 'no disp.' : lleno ? 'lleno' : disp + (disp === 1 ? ' libre' : ' libres')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Recursos */}
        {horaSeleccionada && !negocio.features?.asignacionAutomatica && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs uppercase tracking-widest text-gray-500">
                {negocio.recursoNombrePlural}
              </label>
              {recursosSeleccionados.length > 0 && (
                <button onClick={() => setRecursosSeleccionados([])} className="text-xs text-gray-600 hover:text-[var(--accent)]/80 transition uppercase tracking-widest">
                  Limpiar
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {RECURSOS.map((r) => {
                const ocupado = ocupadosEnHora.includes(r.id)
                const seleccionado = recursosSeleccionados.includes(r.id)
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleRecurso(r.id)}
                    disabled={ocupado}
                    className={'rounded-2xl py-6 text-center transition border flex flex-col items-center gap-2 ' +
                      (ocupado ? 'border-white/5 text-gray-700 cursor-not-allowed ' : '') +
                      (seleccionado ? 'border-[var(--accent)] bg-[var(--accent)]/10 ' : '') +
                      (!ocupado && !seleccionado ? 'border-white/10 hover:border-[var(--accent)] ' : '')}
                  >
                    <span className={'text-2xl ' + (ocupado ? 'grayscale opacity-30' : '')}>{negocio.emoji ?? '🏎'}</span>
                    <span className={'text-xs font-bold tracking-widest uppercase ' +
                      (ocupado ? 'text-gray-700' : seleccionado ? 'text-[var(--accent)]/80' : 'text-gray-400')}>
                      {r.nombre}
                    </span>
                    <span className={'text-xs ' + (ocupado ? 'text-gray-700' : seleccionado ? 'text-[var(--accent)]/50' : 'text-gray-600')}>
                      {ocupado ? 'ocupado' : seleccionado ? 'elegido' : 'libre'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Datos */}
        {horaSeleccionada && (recursosSeleccionados.length > 0 || negocio.features?.asignacionAutomatica) && (
          <div className="mb-8 border border-white/10 rounded-xl p-6">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">Tus datos</p>
            <div className="mb-4">
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Nombre y apellido</label>
              <input type="text" className="bg-white/5 border border-white/10 rounded-xl p-3 w-full text-white focus:border-[var(--accent)] outline-none text-sm" value={nombre} onChange={(e) => { const val = e.target.value.replace(/(?:^|\s)\S/g, c => c.toUpperCase()); setNombre(val) }} placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Telefono</label>
              <input type="tel" className="bg-white/5 border border-white/10 rounded-xl p-3 w-full text-white focus:border-[var(--accent)] outline-none text-sm" value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/[^0-9]/g, ''))} placeholder={negocio.telefonoPlaceholder ?? '11 1234-5678'} />
            </div>
          </div>
        )}

        {/* Verificación Google */}
        {nombre && telefono && (recursosSeleccionados.length > 0 || negocio.features?.asignacionAutomatica) && (
          <div className="mb-8 border border-white/10 rounded-xl p-6">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">Verificación de identidad</p>
            {emailVerificado ? (
              <div className="flex items-center gap-3">
                <span className="text-green-400 text-lg font-bold">✓</span>
                <span className="text-sm text-gray-300">{emailVerificado}</span>
              </div>
            ) : (
              <button
                onClick={verificarConGoogle}
                className="flex items-center gap-3 bg-white text-gray-900 rounded-xl px-5 py-3 font-bold text-sm hover:bg-gray-100 transition"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Verificar con Google
              </button>
            )}
          </div>
        )}

        {/* Confirmar */}
        {nombre && telefono && (recursosSeleccionados.length > 0 || negocio.features?.asignacionAutomatica) && !!emailVerificado && (
          <button
            onClick={confirmarReserva}
            disabled={cargando}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl p-4 font-black uppercase tracking-widest transition disabled:opacity-50 text-sm"
          >
            {cargando
              ? 'Guardando...'
              : negocio.features?.asignacionAutomatica
                ? `Confirmar · ${horaSeleccionada}`
                : `Confirmar · ${horaSeleccionada} · ${recursosSeleccionados.length === 1 ? negocio.recursoNombre + ' ' + recursosSeleccionados[0] : recursosSeleccionados.length + ' ' + negocio.recursoNombrePlural.toLowerCase()}`}
          </button>
        )}
      </div>
    </main>
  )
}
