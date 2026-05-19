'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { negocio } from '@/config'
import { generarHorarios, esDiaHabil } from '@/lib/config'

type Turno = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  simulador_id: number
  created_at: string
  email_verificacion: string | null
  clientes: { nombre: string; telefono: string } | null
  simuladores: { nombre: string } | null
}

const HORARIOS = generarHorarios(negocio.horario.inicioMin, negocio.horario.finMin, negocio.horario.intervaloMinutos)
const RECURSOS = negocio.recursos
const DIAS_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function lunesDeRef(ref: Date): string {
  const d = new Date(ref)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}

function inicioMes(offset: number): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString().slice(0, 10)
}

function finMes(offset: number): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset + 1, 0).toISOString().slice(0, 10)
}

function DiffBadge({ diff }: { diff: number }) {
  const color = diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-500'
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
  return <span className={`text-sm font-medium ${color}`}>{arrow} {Math.abs(diff)}%</span>
}

export default function Admin() {
  const [modo, setModo] = useState<'resumen' | 'proximos' | 'todos' | 'dia'>('resumen')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(false)
  const [fecha, setFecha] = useState(hoy())
  const [vista, setVista] = useState<'grilla' | 'tabla'>('grilla')
  const [diaBloqueado, setDiaBloqueado] = useState<{ motivo: string } | null>(null)
  const [mostrandoFormBloqueo, setMostrandoFormBloqueo] = useState(false)
  const [motivoInput, setMotivoInput] = useState('')
  const [horariosBloqueados, setHorariosBloqueados] = useState<Set<string>>(new Set())
  const [mostrarPasados, setMostrarPasados] = useState(false)
  const [resumenTurnos, setResumenTurnos] = useState<Turno[]>([])
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [slotsBloqueados, setSlotsBloqueados] = useState<Set<string>>(new Set())
  const [procesandoHora, setProcesandoHora] = useState<Set<string>>(new Set())

  const fetchResumen = async () => {
    setLoadingResumen(true)
    const { data, error } = await supabase
      .from('turnos')
      .select('id, fecha, hora_inicio, hora_fin, simulador_id')
      .eq('negocio_id', negocio.id)
      .gte('fecha', inicioMes(-1))
      .lte('fecha', hoy())
    if (!error && data) setResumenTurnos(data as unknown as Turno[])
    setLoadingResumen(false)
  }

  useEffect(() => {
    if (modo === 'resumen') {
      fetchResumen()
    } else {
      fetchTurnos()
      if (modo === 'dia') { fetchBloqueo(); fetchHorariosBloqueados(); fetchSlotsBloqueados() }
      else { setDiaBloqueado(null); setHorariosBloqueados(new Set()); setSlotsBloqueados(new Set()) }
    }
  }, [modo, fecha])

  const fetchTurnos = async () => {
    setLoading(true)
    let query = supabase
      .from('turnos')
      .select('id, fecha, hora_inicio, hora_fin, simulador_id, created_at, email_verificacion, clientes ( nombre, telefono ), simuladores ( nombre )')
      .eq('negocio_id', negocio.id)
    if (modo === 'dia') query = query.eq('fecha', fecha)
    else if (modo === 'proximos') query = query.gte('fecha', hoy())
    query = query.order('fecha', { ascending: true }).order('hora_inicio', { ascending: true })
    const { data, error } = await query
    if (!error && data) setTurnos(data as unknown as Turno[])
    setLoading(false)
  }

  const fetchHorariosBloqueados = async () => {
    const { data } = await supabase.from('horarios_bloqueados').select('hora').eq('fecha', fecha).eq('negocio_id', negocio.id)
    setHorariosBloqueados(new Set((data ?? []).map((d) => d.hora.slice(0, 5))))
  }

  const fetchSlotsBloqueados = async () => {
    const { data } = await supabase.from('slots_bloqueados').select('recurso_id, hora').eq('fecha', fecha).eq('negocio_id', negocio.id)
    setSlotsBloqueados(new Set((data ?? []).map((d) => `${d.recurso_id}_${d.hora.slice(0, 5)}`)))
  }

  const toggleHorario = async (hora: string) => {
    if (horariosBloqueados.has(hora)) {
      await supabase.from('horarios_bloqueados').delete().eq('fecha', fecha).eq('hora', hora).eq('negocio_id', negocio.id)
      setHorariosBloqueados((prev) => { const s = new Set(prev); s.delete(hora); return s })
    } else {
      await supabase.from('horarios_bloqueados').insert({ fecha, hora, negocio_id: negocio.id })
      setHorariosBloqueados((prev) => new Set([...prev, hora]))
    }
  }

  const toggleHoraCompleta = async (hora: string) => {
    if (procesandoHora.has(hora)) return
    setProcesandoHora((prev) => new Set([...prev, hora]))
    const nuevosSlots = new Set(slotsBloqueados)
    const ops: Promise<void>[] = []
    for (const r of RECURSOS) {
      if (grillaMap[hora]?.[r.id] || horariosBloqueados.has(hora)) continue
      const key = `${r.id}_${hora}`
      const bloqueado = nuevosSlots.has(key)
      ops.push(
        fetch('/api/admin/bloquear-slot', {
          method: bloqueado ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ negocio_id: negocio.id, recurso_id: r.id, fecha, hora }),
        }).then(() => { bloqueado ? nuevosSlots.delete(key) : nuevosSlots.add(key) })
      )
    }
    await Promise.all(ops)
    setSlotsBloqueados(nuevosSlots)
    setProcesandoHora((prev) => { const s = new Set(prev); s.delete(hora); return s })
  }

  const toggleSlot = async (hora: string, recursoId: number) => {
    const key = `${recursoId}_${hora}`
    const bloqueado = slotsBloqueados.has(key)
    await fetch('/api/admin/bloquear-slot', {
      method: bloqueado ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio_id: negocio.id, recurso_id: recursoId, fecha, hora }),
    })
    setSlotsBloqueados((prev) => {
      const s = new Set(prev)
      bloqueado ? s.delete(key) : s.add(key)
      return s
    })
  }

  const fetchBloqueo = async () => {
    const { data } = await supabase
      .from('dias_bloqueados')
      .select('motivo')
      .eq('fecha', fecha)
      .eq('negocio_id', negocio.id)
      .single()
    setDiaBloqueado(data ?? null)
    setMostrandoFormBloqueo(false)
    setMotivoInput('')
  }

  const bloquearDia = async () => {
    const { error } = await supabase
      .from('dias_bloqueados')
      .upsert({ fecha, motivo: motivoInput.trim() || null, negocio_id: negocio.id }, { onConflict: 'negocio_id,fecha' })
    if (error) {
      alert('Error al bloquear: ' + error.message)
      return
    }
    fetchBloqueo()
  }

  const desbloquearDia = async () => {
    await supabase.from('dias_bloqueados').delete().eq('fecha', fecha).eq('negocio_id', negocio.id)
    setDiaBloqueado(null)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Eliminar este turno?')) return
    const { error } = await supabase.from('turnos').delete().eq('id', id)
    if (!error) setTurnos(turnos.filter((t) => t.id !== id))
  }

  function esPasado(f: string, hora: string) {
    return new Date(`${f}T${hora}`) < new Date()
  }

  // ── Métricas resumen ──────────────────────────────────────────────────
  const todayStr = hoy()

  const turnosHoy = resumenTurnos.filter(t => t.fecha === todayStr)
  const esHabilHoy = esDiaHabil(todayStr, negocio.diasHabiles)
  const posiblesHoy = esHabilHoy ? HORARIOS.length * RECURSOS.length : 0
  const ocupacionPct = posiblesHoy > 0 ? Math.round(turnosHoy.length / posiblesHoy * 100) : 0

  const ahoraDate = new Date()
  const ocupadosAhora = turnosHoy.filter(t => {
    const ini = new Date(`${todayStr}T${t.hora_inicio.slice(0, 5)}`)
    const fin = new Date(`${todayStr}T${t.hora_fin.slice(0, 5)}`)
    if (fin <= ini) fin.setDate(fin.getDate() + 1)
    return ini <= ahoraDate && ahoraDate < fin
  }).length

  const lunesEsta = lunesDeRef(new Date())
  const _refPasada = new Date(); _refPasada.setDate(_refPasada.getDate() - 7)
  const lunesPasada = lunesDeRef(_refPasada)
  const dayOfWeek = new Date().getDay()
  const diasDesdeL = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const finComparacion = (() => {
    const d = new Date(lunesPasada + 'T12:00:00')
    d.setDate(d.getDate() + diasDesdeL)
    return d.toISOString().slice(0, 10)
  })()

  const turnosEstaSemana = resumenTurnos.filter(t => t.fecha >= lunesEsta && t.fecha <= todayStr)
  const turnosSemPasada = resumenTurnos.filter(t => t.fecha >= lunesPasada && t.fecha <= finComparacion)
  const diffSemana = turnosSemPasada.length > 0
    ? Math.round((turnosEstaSemana.length - turnosSemPasada.length) / turnosSemPasada.length * 100)
    : turnosEstaSemana.length > 0 ? 100 : 0

  const barData = DIAS_LABEL.map((nombre, i) => {
    const d = new Date(lunesEsta + 'T12:00:00')
    d.setDate(d.getDate() + i)
    const fechaStr = d.toISOString().slice(0, 10)
    return {
      nombre,
      fechaStr,
      count: resumenTurnos.filter(t => t.fecha === fechaStr).length,
      esFuturo: fechaStr > todayStr,
    }
  })
  const maxBar = Math.max(...barData.map(d => d.count), 1)

  const inicioEsteMes = inicioMes(0)
  const turnosEsteMes = resumenTurnos.filter(t => t.fecha >= inicioEsteMes && t.fecha <= todayStr)
  const turnosMesAnt = resumenTurnos.filter(t => t.fecha >= inicioMes(-1) && t.fecha <= finMes(-1))
  const diffMes = turnosMesAnt.length > 0
    ? Math.round((turnosEsteMes.length - turnosMesAnt.length) / turnosMesAnt.length * 100)
    : turnosEsteMes.length > 0 ? 100 : 0
  // ─────────────────────────────────────────────────────────────────────

  const turnosFiltrados = modo === 'dia' && !mostrarPasados
    ? turnos.filter(t => !esPasado(t.fecha, t.hora_fin.slice(0, 5)))
    : turnos

  const horariosFiltrados = !mostrarPasados
    ? HORARIOS.filter(hora => !esPasado(fecha, hora))
    : HORARIOS

  const grillaMap: Record<string, Record<number, Turno>> = {}
  for (const t of turnos) {
    const h = t.hora_inicio.slice(0, 5)
    if (!grillaMap[h]) grillaMap[h] = {}
    grillaMap[h][t.simulador_id] = t
  }

  const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const subtitulo = modo === 'resumen'
    ? 'Resumen general'
    : modo === 'proximos'
    ? `Próximos turnos · ${turnosFiltrados.length} turnos`
    : modo === 'todos'
    ? `Todos los turnos · ${turnosFiltrados.length} turnos`
    : `${fechaFormateada} · ${turnosFiltrados.length} turnos`

  const navClass = (m: typeof modo) =>
    'px-4 py-2 uppercase tracking-widest transition text-xs ' +
    (modo === m ? 'bg-[var(--accent)] text-white' : 'text-gray-500 hover:text-white')

  return (
    <main className="min-h-screen bg-[var(--bg)] text-white p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <p className="text-xs tracking-[0.4em] uppercase text-[var(--accent)] mb-1">Panel</p>
            <h1 className="text-3xl font-black uppercase">Admin</h1>
            <p className="text-gray-600 text-sm mt-1 capitalize">{subtitulo}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex border border-white/10 rounded-xl overflow-hidden text-xs">
              <button onClick={() => setModo('resumen')} className={navClass('resumen')}>Resumen</button>
              <button onClick={() => setModo('proximos')} className={navClass('proximos')}>Próximos</button>
              <button onClick={() => setModo('todos')} className={navClass('todos')}>Todos</button>
              <button onClick={() => setModo('dia')} className={navClass('dia')}>Por día</button>
            </div>
            {modo === 'dia' && (
              <>
                <button
                  onClick={() => setMostrarPasados(p => !p)}
                  className={'px-4 py-2 rounded-xl text-xs uppercase tracking-widest transition border ' + (mostrarPasados ? 'border-white/20 text-white bg-white/10' : 'border-white/10 text-gray-500 hover:text-white')}
                >
                  {mostrarPasados ? 'Ocultar historial' : 'Ver historial'}
                </button>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none text-sm focus:border-[var(--accent)]"
                />
                <div className="flex border border-white/10 rounded-xl overflow-hidden text-xs">
                  <button onClick={() => setVista('grilla')} className={'px-4 py-2 uppercase tracking-widest transition ' + (vista === 'grilla' ? 'bg-[var(--accent)] text-white' : 'text-gray-500 hover:text-white')}>Grilla</button>
                  <button onClick={() => setVista('tabla')} className={'px-4 py-2 uppercase tracking-widest transition ' + (vista === 'tabla' ? 'bg-[var(--accent)] text-white' : 'text-gray-500 hover:text-white')}>Tabla</button>
                </div>
              </>
            )}
            <button
              onClick={async () => { await fetch('/api/admin-login', { method: 'DELETE' }); window.location.href = '/admin-login' }}
              className="text-xs text-gray-600 hover:text-[var(--accent)] uppercase tracking-widest transition"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Control de bloqueo — solo modo día */}
        {modo === 'dia' && (
          <div className="mb-6">
            {diaBloqueado ? (
              <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-3">
                <div>
                  <span className="text-yellow-400 font-bold text-sm uppercase tracking-widest">Día bloqueado</span>
                  {diaBloqueado.motivo && <span className="text-yellow-600 text-sm ml-3">· {diaBloqueado.motivo}</span>}
                </div>
                <button onClick={desbloquearDia} className="text-xs uppercase tracking-widest text-yellow-600 hover:text-yellow-400 transition">
                  Desbloquear
                </button>
              </div>
            ) : mostrandoFormBloqueo ? (
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-3">
                <input
                  type="text"
                  value={motivoInput}
                  onChange={e => setMotivoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && bloquearDia()}
                  placeholder="Motivo (opcional: Feriado, Mantenimiento...)"
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-700"
                  autoFocus
                />
                <button onClick={bloquearDia} className="text-xs uppercase tracking-widest text-yellow-400 hover:text-yellow-300 font-bold transition">Confirmar</button>
                <button onClick={() => { setMostrandoFormBloqueo(false); setMotivoInput('') }} className="text-xs uppercase tracking-widest text-gray-600 hover:text-gray-400 transition">Cancelar</button>
              </div>
            ) : (
              <button
                onClick={() => setMostrandoFormBloqueo(true)}
                className="text-xs uppercase tracking-widest text-gray-600 hover:text-yellow-500 transition border border-white/5 hover:border-yellow-500/30 rounded-xl px-5 py-3 w-full text-left"
              >
                + Bloquear este día
              </button>
            )}
          </div>
        )}

        {/* Contenido principal */}
        {modo === 'resumen' ? (
          loadingResumen ? (
            <p className="text-gray-600 tracking-widest uppercase text-sm">Cargando...</p>
          ) : (
            <div className="space-y-10">

              {/* Hoy */}
              <section>
                <p className="text-xs tracking-[0.4em] uppercase text-[var(--accent)] mb-4">Hoy</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {([
                    { valor: turnosHoy.length, label: 'Turnos confirmados' },
                    { valor: posiblesHoy, label: 'Turnos posibles' },
                    { valor: `${ocupacionPct}%`, label: 'Ocupación' },
                    { valor: ocupadosAhora, label: `${negocio.recursoNombrePlural} ahora mismo` },
                  ] as { valor: string | number; label: string }[]).map(({ valor, label }) => (
                    <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-5">
                      <p className="text-3xl font-black">{valor}</p>
                      <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest leading-snug">{label}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Esta semana */}
              <section>
                <p className="text-xs tracking-[0.4em] uppercase text-[var(--accent)] mb-4">Esta semana</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <p className="text-3xl font-black">{turnosEstaSemana.length}</p>
                    <p className="text-xs text-gray-500 mt-1 mb-3 uppercase tracking-widest">
                      Lun–{DIAS_LABEL[diasDesdeL]} · {turnosSemPasada.length} la semana pasada
                    </p>
                    <DiffBadge diff={diffSemana} />
                    <span className="text-xs text-gray-600 ml-2">vs semana pasada</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Por día</p>
                    <div className="space-y-2">
                      {barData.map(({ nombre, fechaStr, count, esFuturo }) => (
                        <div key={nombre} className="flex items-center gap-3">
                          <span className={`text-xs w-7 shrink-0 ${fechaStr === todayStr ? 'text-[var(--accent)]' : 'text-gray-600'}`}>
                            {nombre}
                          </span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            {!esFuturo && count > 0 && (
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round(count / maxBar * 100)}%`,
                                  backgroundColor: fechaStr === todayStr ? 'var(--accent)' : 'rgba(255,255,255,0.2)',
                                }}
                              />
                            )}
                          </div>
                          <span className={`text-xs w-4 text-right shrink-0 ${esFuturo ? 'text-transparent' : 'text-gray-400'}`}>
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Este mes */}
              <section>
                <p className="text-xs tracking-[0.4em] uppercase text-[var(--accent)] mb-4">Este mes</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <p className="text-3xl font-black">{turnosEsteMes.length}</p>
                    <p className="text-xs text-gray-500 mt-1 mb-3 uppercase tracking-widest">
                      Turnos este mes · {turnosMesAnt.length} el mes anterior
                    </p>
                    <DiffBadge diff={diffMes} />
                    <span className="text-xs text-gray-600 ml-2">vs mes anterior</span>
                  </div>
                </div>
              </section>

            </div>
          )
        ) : loading ? (
          <p className="text-gray-600 tracking-widest uppercase text-sm">Cargando...</p>
        ) : modo === 'dia' && vista === 'grilla' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="p-3 text-left text-xs uppercase tracking-widest text-gray-600 w-20">Hora</th>
                  {RECURSOS.map((r) => (
                    <th key={r.id} className="p-3 text-center text-xs uppercase tracking-widest text-gray-600">
                      {negocio.recursoNombre} {r.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horariosFiltrados.map((hora) => (
                  <tr key={hora} className="border-t border-white/5">
                    <td className="p-3 text-xs font-mono">
                      <button
                        onClick={() => !diaBloqueado && toggleHoraCompleta(hora)}
                        disabled={procesandoHora.has(hora)}
                        className={'transition ' + (diaBloqueado ? 'text-gray-600 cursor-default' : procesandoHora.has(hora) ? 'text-gray-600 opacity-50 cursor-default' : 'text-gray-600 hover:text-white cursor-pointer')}
                      >{hora}</button>
                    </td>
                    {RECURSOS.map((r) => {
                      const turno = grillaMap[hora]?.[r.id]
                      return (
                        <td key={r.id} className="p-2">
                          {diaBloqueado ? (
                            <div className="rounded-lg p-2 text-center border border-yellow-500/10 text-yellow-900 text-xs">bloq.</div>
                          ) : turno ? (
                            <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg p-2 text-center group relative">
                              <p className="text-xs font-bold text-[var(--accent)]/80 truncate">{turno.clientes?.nombre}</p>
                              <p className="text-xs text-gray-600">{turno.clientes?.telefono}</p>
                              <button
                                onClick={() => handleDelete(turno.id)}
                                className="absolute top-1 right-1 text-[var(--accent)]/50 hover:text-[var(--accent)]/80 text-xs opacity-0 group-hover:opacity-100 transition"
                              >✕</button>
                            </div>
                          ) : horariosBloqueados.has(hora) ? (
                            <button onClick={() => toggleHorario(hora)} className="w-full rounded-lg p-2 text-center border border-orange-500/20 text-orange-800 text-xs hover:border-orange-500/40 transition">
                              bloq. ✕
                            </button>
                          ) : slotsBloqueados.has(`${r.id}_${hora}`) ? (
                            <button onClick={() => toggleSlot(hora, r.id)} className="w-full rounded-lg p-2 text-center border border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs hover:border-amber-500/50 transition">
                              bloqueado ✕
                            </button>
                          ) : (
                            <button onClick={() => toggleSlot(hora, r.id)} className="w-full rounded-lg p-2 text-center border border-white/5 text-gray-800 text-xs hover:border-white/20 hover:text-gray-600 transition">
                              libre
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : turnosFiltrados.length === 0 ? (
          <p className="text-gray-600">{modo === 'dia' ? 'No hay turnos para este día.' : 'No hay turnos.'}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {modo !== 'dia' && <th className="p-4 text-left text-xs uppercase tracking-widest text-gray-500">Fecha</th>}
                  <th className="p-4 text-left text-xs uppercase tracking-widest text-gray-500">{negocio.recursoNombre}</th>
                  <th className="p-4 text-left text-xs uppercase tracking-widest text-gray-500">Cliente</th>
                  <th className="p-4 text-left text-xs uppercase tracking-widest text-gray-500">Telefono</th>
                  <th className="p-4 text-left text-xs uppercase tracking-widest text-gray-500">Email</th>
                  <th className="p-4 text-left text-xs uppercase tracking-widest text-gray-500">Horario</th>
                  <th className="p-4 text-left text-xs uppercase tracking-widest text-gray-500">Reservado</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {turnosFiltrados.map((t) => (
                  <tr
                    key={t.id}
                    className={'border-b border-white/5 hover:bg-white/5 transition' + (modo === 'todos' && esPasado(t.fecha, t.hora_fin.slice(0, 5)) ? ' opacity-50' : '')}
                  >
                    {modo !== 'dia' && <td className="p-4 text-gray-400 text-xs">{new Date(t.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>}
                    <td className="p-4 font-medium">{RECURSOS.find(r => r.id === t.simulador_id)?.nombre ?? t.simuladores?.nombre}</td>
                    <td className="p-4">{t.clientes?.nombre}</td>
                    <td className="p-4 text-gray-400">{t.clientes?.telefono}</td>
                    <td className="p-4 text-gray-400 text-xs">{t.email_verificacion ?? '—'}</td>
                    <td className="p-4">{t.hora_inicio?.slice(0, 5)} - {t.hora_fin?.slice(0, 5)}</td>
                    <td className="p-4 text-gray-600 text-xs">
                      {(() => { const d = new Date(t.created_at); d.setHours(d.getHours() - 3); return d.toLocaleString('es-AR', { hour12: false }) })()}
                    </td>
                    <td className="p-4">
                      <button onClick={() => handleDelete(t.id)} className="text-[var(--accent)] hover:text-[var(--accent)]/80 text-xs uppercase tracking-widest transition">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </main>
  )
}
