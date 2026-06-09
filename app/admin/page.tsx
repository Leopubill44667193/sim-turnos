'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { negocio } from '@/config'
import { generarHorarios, esDiaHabil, toMin, formatHora } from '@/lib/config'

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
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10)
}

function lunesDeRef(ref: Date): string {
  const d = new Date(ref)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}

function inicioMes(offset: number): string {
  const ar = new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10)
  const [y, m] = ar.split('-').map(Number)
  const d = new Date(y, m - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function finMes(offset: number): string {
  const ar = new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10)
  const [y, m] = ar.split('-').map(Number)
  const d = new Date(y, m - 1 + offset + 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const [horariosBloqueados, setHorariosBloqueados] = useState<Record<string, string | null>>({})
  const [slotActivo, setSlotActivo] = useState<{ hora: string; recursoId: number } | null>(null)
  const [slotMotivo, setSlotMotivo] = useState('')
  const [slotNombre, setSlotNombre] = useState('')
  const [slotTelefono, setSlotTelefono] = useState('')
  const [mostrarPasados, setMostrarPasados] = useState(false)
  const [resumenTurnos, setResumenTurnos] = useState<Turno[]>([])
  const [resumenSlots, setResumenSlots] = useState<{ fecha: string; recurso_id: number; hora: string; motivo: string | null }[]>([])
  const [proximosSlots, setProximosSlots] = useState<{ id: string; fecha: string; recurso_id: number; hora: string; motivo: string }[]>([])
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [slotsBloqueados, setSlotsBloqueados] = useState<Record<string, string | null>>({})
  const [procesandoHora, setProcesandoHora] = useState<Set<string>>(new Set())
  const [slotsPublicadosMap, setSlotsPublicadosMap] = useState<Record<string, true>>({})

  const fetchResumen = async () => {
    setLoadingResumen(true)
    const [{ data, error }, { data: slotsData }] = await Promise.all([
      supabase
        .from('turnos')
        .select('id, fecha, hora_inicio, hora_fin, simulador_id')
        .eq('negocio_id', negocio.id)
        .gte('fecha', inicioMes(-1))
        .lte('fecha', finMes(0)),
      supabase
        .from('slots_bloqueados')
        .select('fecha, recurso_id, hora, motivo')
        .eq('negocio_id', negocio.id)
        .gte('fecha', inicioMes(-1))
        .lte('fecha', finMes(0)),
    ])
    if (!error && data) setResumenTurnos(data as unknown as Turno[])
    if (slotsData) setResumenSlots(slotsData)
    setLoadingResumen(false)
  }

  useEffect(() => {
    if (modo === 'resumen') {
      fetchResumen()
    } else {
      fetchTurnos()
      if (modo === 'dia') { fetchBloqueo(); fetchHorariosBloqueados(); fetchSlotsBloqueados(); fetchSlotsPublicados() }
      else { setDiaBloqueado(null); setHorariosBloqueados({}); setSlotsBloqueados({}); setSlotsPublicadosMap({}) }
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
    if (modo === 'proximos') {
      const [{ data, error }, { data: slotsData }] = await Promise.all([
        query,
        supabase
          .from('slots_bloqueados')
          .select('id, fecha, recurso_id, hora, motivo')
          .eq('negocio_id', negocio.id)
          .gte('fecha', hoy())
          .not('motivo', 'is', null)
          .neq('motivo', ''),
      ])
      if (!error && data) setTurnos(data as unknown as Turno[])
      if (slotsData) setProximosSlots(slotsData as { id: string; fecha: string; recurso_id: number; hora: string; motivo: string }[])
    } else {
      const { data, error } = await query
      if (!error && data) setTurnos(data as unknown as Turno[])
      setProximosSlots([])
    }
    setLoading(false)
  }

  const fetchHorariosBloqueados = async () => {
    const { data } = await supabase.from('horarios_bloqueados').select('hora, motivo').eq('fecha', fecha).eq('negocio_id', negocio.id)
    const map: Record<string, string | null> = {}
    for (const d of data ?? []) map[d.hora.slice(0, 5)] = d.motivo ?? null
    setHorariosBloqueados(map)
  }

  const fetchSlotsBloqueados = async () => {
    const { data } = await supabase.from('slots_bloqueados').select('recurso_id, hora, motivo').eq('fecha', fecha).eq('negocio_id', negocio.id)
    const map: Record<string, string | null> = {}
    for (const d of data ?? []) map[`${d.recurso_id}_${d.hora.slice(0, 5)}`] = d.motivo ?? null
    setSlotsBloqueados(map)
  }

  const fetchSlotsPublicados = async () => {
    if (!negocio.features?.slotsPublicados) return
    const { data } = await supabase.from('slots_publicados').select('recurso_id, hora').eq('fecha', fecha).eq('negocio_id', negocio.id)
    const map: Record<string, true> = {}
    for (const d of data ?? []) map[`${d.recurso_id}_${d.hora.slice(0, 5)}`] = true
    setSlotsPublicadosMap(map)
  }

  const toggleHorario = async (hora: string) => {
    await supabase.from('horarios_bloqueados').delete().eq('fecha', fecha).eq('hora', hora).eq('negocio_id', negocio.id)
    setHorariosBloqueados((prev) => { const r = { ...prev }; delete r[hora]; return r })
  }

  const bloquearConMotivo = async (hora: string, recursoId: number, motivo: string) => {
    await fetch('/api/admin/bloquear-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio_id: negocio.id, recurso_id: recursoId, fecha, hora, motivo }),
    })
    setSlotsBloqueados((prev) => ({ ...prev, [`${recursoId}_${hora}`]: motivo }))
    setSlotActivo(null)
    setSlotMotivo('')
  }

  const toggleHoraCompleta = async (hora: string) => {
    if (procesandoHora.has(hora)) return
    setProcesandoHora((prev) => new Set([...prev, hora]))
    const nuevosSlots = { ...slotsBloqueados }
    const ops: Promise<void>[] = []
    for (const r of RECURSOS) {
      if (grillaMap[hora]?.[r.id] || continuacionMap[hora]?.has(r.id) || hora in horariosBloqueados || slotsBloqContinuacionMap[hora]?.[r.id] || slotsPublicadosMap[`${r.id}_${hora}`]) continue
      const key = `${r.id}_${hora}`
      const bloqueado = key in nuevosSlots
      ops.push(
        fetch('/api/admin/bloquear-slot', {
          method: bloqueado ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ negocio_id: negocio.id, recurso_id: r.id, fecha, hora }),
        }).then(() => { bloqueado ? delete nuevosSlots[key] : (nuevosSlots[key] = null) })
      )
    }
    await Promise.all(ops)
    setSlotsBloqueados(nuevosSlots)
    setProcesandoHora((prev) => { const s = new Set(prev); s.delete(hora); return s })
  }

  const cargarTurnoManual = async (hora: string, recursoId: number, nombre: string, telefono: string) => {
    const [h, m] = hora.split(':').map(Number)
    const total = h * 60 + m + negocio.duracionMinutos
    const horaFin = String(Math.floor(total / 60) % 24).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0')
    let clienteId: string
    if (telefono) {
      const { data: existente } = await supabase.from('clientes').select('id').eq('telefono', telefono).eq('negocio_id', negocio.id).single()
      if (existente) {
        clienteId = existente.id
        await supabase.from('clientes').update({ nombre }).eq('id', clienteId)
      } else {
        const { data: nuevo } = await supabase.from('clientes').insert({ nombre, telefono, negocio_id: negocio.id }).select('id').single()
        if (!nuevo) return
        clienteId = nuevo.id
      }
    } else {
      const { data: nuevo } = await supabase.from('clientes').insert({ nombre, telefono: null, negocio_id: negocio.id }).select('id').single()
      if (!nuevo) return
      clienteId = nuevo.id
    }
    await supabase.from('turnos').insert({ negocio_id: negocio.id, simulador_id: recursoId, cliente_id: clienteId, fecha, hora_inicio: hora, hora_fin: horaFin })
    if (negocio.features?.slotsPublicados) {
      const { data: pubs } = await supabase
        .from('slots_publicados')
        .select('recurso_id, hora')
        .eq('negocio_id', negocio.id)
        .eq('fecha', fecha)
        .eq('recurso_id', recursoId)
      const horaMin = toMin(hora)
      const coveringPubs = (pubs ?? []).filter(p => {
        const pubMin = toMin(p.hora.substring(0, 5))
        return horaMin < pubMin + negocio.duracionMinutos && pubMin < horaMin + negocio.duracionMinutos
      })
      if (coveringPubs.length > 0) {
        await supabase
          .from('slots_publicados')
          .delete()
          .eq('negocio_id', negocio.id)
          .eq('recurso_id', recursoId)
          .eq('fecha', fecha)
          .in('hora', coveringPubs.map(p => p.hora))
      }
    }
    await fetchTurnos()
    await fetchSlotsPublicados()
    setSlotActivo(null); setSlotNombre(''); setSlotTelefono('')
  }

  const toggleSlot = async (hora: string, recursoId: number) => {
    const key = `${recursoId}_${hora}`
    const bloqueado = key in slotsBloqueados
    await fetch('/api/admin/bloquear-slot', {
      method: bloqueado ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio_id: negocio.id, recurso_id: recursoId, fecha, hora }),
    })
    setSlotsBloqueados((prev) => {
      const r = { ...prev }
      bloqueado ? delete r[key] : (r[key] = null)
      return r
    })
  }

  const desbloquearConMotivo = async (hora: string, recursoId: number) => {
    await fetch('/api/admin/bloquear-slot', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio_id: negocio.id, recurso_id: recursoId, fecha, hora }),
    })
    setSlotsBloqueados((prev) => { const r = { ...prev }; delete r[`${recursoId}_${hora}`]; return r })
  }

  const publicarSlot = async (hora: string, recursoId: number) => {
    await fetch('/api/admin/publicar-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio_id: negocio.id, recurso_id: recursoId, fecha, hora }),
    })
    setSlotsPublicadosMap((prev) => ({ ...prev, [`${recursoId}_${hora}`]: true }))
    setSlotActivo(null); setSlotNombre(''); setSlotTelefono('')
  }

  const despublicarSlot = async (hora: string, recursoId: number) => {
    await fetch('/api/admin/publicar-slot', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio_id: negocio.id, recurso_id: recursoId, fecha, hora }),
    })
    setSlotsPublicadosMap((prev) => { const r = { ...prev }; delete r[`${recursoId}_${hora}`]; return r })
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
  const slotsConMotivo = resumenSlots.filter(s => s.motivo && s.motivo.trim() !== '')

  const turnosHoy = resumenTurnos.filter(t => t.fecha === todayStr)
  const slotsHoy = slotsConMotivo.filter(s => s.fecha === todayStr)
  const totalHoy = turnosHoy.length + slotsHoy.length
  const esHabilHoy = esDiaHabil(todayStr, negocio.diasHabiles)
  const posiblesHoy = esHabilHoy ? HORARIOS.length * RECURSOS.length : 0
  const ocupacionPct = posiblesHoy > 0 ? Math.round(totalHoy / posiblesHoy * 100) : 0

  const ahoraDate = new Date()
  const ocupadosAhora = turnosHoy.filter(t => {
    const ini = new Date(`${todayStr}T${t.hora_inicio.slice(0, 5)}`)
    const fin = new Date(`${todayStr}T${t.hora_fin.slice(0, 5)}`)
    if (fin <= ini) fin.setDate(fin.getDate() + 1)
    return ini <= ahoraDate && ahoraDate < fin
  }).length + slotsHoy.filter(s => {
    const ini = new Date(`${todayStr}T${s.hora.slice(0, 5)}`)
    const fin = new Date(ini.getTime() + negocio.duracionMinutos * 60000)
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

  const turnosEstaSemana = resumenTurnos.filter(t => t.fecha >= lunesEsta && t.fecha <= todayStr).length
    + slotsConMotivo.filter(s => s.fecha >= lunesEsta && s.fecha <= todayStr).length
  const turnosSemPasada = resumenTurnos.filter(t => t.fecha >= lunesPasada && t.fecha <= finComparacion).length
    + slotsConMotivo.filter(s => s.fecha >= lunesPasada && s.fecha <= finComparacion).length
  const diffSemana = turnosSemPasada > 0
    ? Math.round((turnosEstaSemana - turnosSemPasada) / turnosSemPasada * 100)
    : turnosEstaSemana > 0 ? 100 : 0

  const barData = DIAS_LABEL.map((nombre, i) => {
    const d = new Date(lunesEsta + 'T12:00:00')
    d.setDate(d.getDate() + i)
    const fechaStr = d.toISOString().slice(0, 10)
    return {
      nombre,
      fechaStr,
      count: resumenTurnos.filter(t => t.fecha === fechaStr).length
        + slotsConMotivo.filter(s => s.fecha === fechaStr).length,
      esFuturo: fechaStr > todayStr,
    }
  })
  const maxBar = Math.max(...barData.map(d => d.count), 1)

  const inicioEsteMes = inicioMes(0)
  const turnosEsteMes = resumenTurnos.filter(t => t.fecha >= inicioEsteMes && t.fecha <= todayStr).length
    + slotsConMotivo.filter(s => s.fecha >= inicioEsteMes && s.fecha <= todayStr).length
  const turnosMesAnt = resumenTurnos.filter(t => t.fecha >= inicioMes(-1) && t.fecha <= finMes(-1)).length
    + slotsConMotivo.filter(s => s.fecha >= inicioMes(-1) && s.fecha <= finMes(-1)).length
  const diffMes = turnosMesAnt > 0
    ? Math.round((turnosEsteMes - turnosMesAnt) / turnosMesAnt * 100)
    : turnosEsteMes > 0 ? 100 : 0
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

  const continuacionMap: Record<string, Set<number>> = {}
  for (const t of turnos) {
    const tMin = toMin(t.hora_inicio.slice(0, 5))
    for (const h of horariosFiltrados) {
      const hMin = toMin(h)
      if (hMin > tMin && hMin < tMin + negocio.duracionMinutos) {
        if (!continuacionMap[h]) continuacionMap[h] = new Set()
        continuacionMap[h].add(t.simulador_id)
      }
    }
  }

  const slotsBloqContinuacionMap: Record<string, Record<number, string>> = {}
  for (const [key, motivo] of Object.entries(slotsBloqueados)) {
    if (!motivo) continue
    const idx = key.indexOf('_')
    const recursoId = Number(key.slice(0, idx))
    const hora = key.slice(idx + 1)
    const horaMin = toMin(hora)
    for (const delta of [30, 60]) {
      const hCont = formatHora(horaMin + delta)
      if (!slotsBloqContinuacionMap[hCont]) slotsBloqContinuacionMap[hCont] = {}
      slotsBloqContinuacionMap[hCont][recursoId] = motivo
    }
  }

  const slotsPublicadosContinuacionMap: Record<string, Set<number>> = {}
  for (const key of Object.keys(slotsPublicadosMap)) {
    const idx = key.indexOf('_')
    const recursoId = Number(key.slice(0, idx))
    const hora = key.slice(idx + 1)
    const horaMin = toMin(hora)
    for (const delta of [30, 60]) {
      const hCont = formatHora(horaMin + delta)
      if (!slotsPublicadosContinuacionMap[hCont]) slotsPublicadosContinuacionMap[hCont] = new Set()
      slotsPublicadosContinuacionMap[hCont].add(recursoId)
    }
  }

  const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const slotHoraFin = (hora: string) => {
    const [h, m] = hora.slice(0, 5).split(':').map(Number)
    const fin = h * 60 + m + negocio.duracionMinutos
    return `${String(Math.floor(fin / 60) % 24).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`
  }

  const proximosCombinados = modo === 'proximos' ? [
    ...turnosFiltrados.map(t => ({
      key: t.id,
      fecha: t.fecha,
      recursoNombre: RECURSOS.find(r => r.id === t.simulador_id)?.nombre ?? t.simuladores?.nombre ?? '',
      clienteNombre: t.clientes?.nombre ?? '',
      telefono: t.clientes?.telefono ?? '—',
      horaInicio: t.hora_inicio?.slice(0, 5) ?? '',
      horaFin: t.hora_fin?.slice(0, 5) ?? '',
      email: t.email_verificacion ?? '—',
      reservado: (() => { const d = new Date(t.created_at); d.setHours(d.getHours() - 3); return d.toLocaleString('es-AR', { hour12: false }) })(),
      esSlot: false as const,
      turnoId: t.id,
    })),
    ...proximosSlots.map(s => ({
      key: s.id,
      fecha: s.fecha,
      recursoNombre: RECURSOS.find(r => r.id === s.recurso_id)?.nombre ?? `Recurso ${s.recurso_id}`,
      clienteNombre: s.motivo,
      telefono: '—',
      horaInicio: s.hora.slice(0, 5),
      horaFin: slotHoraFin(s.hora),
      email: '—',
      reservado: '—',
      esSlot: true as const,
      turnoId: undefined,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio)) : []

  const subtitulo = modo === 'resumen'
    ? 'Resumen general'
    : modo === 'proximos'
    ? `Próximos turnos · ${proximosCombinados.length} turnos`
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
                <div className="flex items-center border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => { const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() - 1); setFecha(d.toISOString().slice(0, 10)) }}
                    className="px-3 py-2 text-gray-500 hover:text-white hover:bg-white/5 transition text-sm"
                  >‹</button>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="bg-white/5 px-2 py-2 text-white outline-none text-sm"
                  />
                  <button
                    onClick={() => { const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() + 1); setFecha(d.toISOString().slice(0, 10)) }}
                    className="px-3 py-2 text-gray-500 hover:text-white hover:bg-white/5 transition text-sm"
                  >›</button>
                </div>
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
                    { valor: totalHoy, label: 'Turnos confirmados' },
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
                    <p className="text-3xl font-black">{turnosEstaSemana}</p>
                    <p className="text-xs text-gray-500 mt-1 mb-3 uppercase tracking-widest">
                      Lun–{DIAS_LABEL[diasDesdeL]} · {turnosSemPasada} la semana pasada
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
                    <p className="text-3xl font-black">{turnosEsteMes}</p>
                    <p className="text-xs text-gray-500 mt-1 mb-3 uppercase tracking-widest">
                      Turnos este mes · {turnosMesAnt} el mes anterior
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
                      const esContinuacion = !turno && (continuacionMap[hora]?.has(r.id) ?? false)
                      const motivoContinuacion = !turno && !esContinuacion ? (slotsBloqContinuacionMap[hora]?.[r.id] ?? null) : null
                      const esContinuacionPublicada = !turno && !esContinuacion && !motivoContinuacion && negocio.features?.slotsPublicados && (slotsPublicadosContinuacionMap[hora]?.has(r.id) ?? false)
                      return (
                        <td key={r.id} className="p-2">
                          {turno ? (
                            <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg p-2 text-center group relative">
                              <p className="text-xs font-bold text-[var(--accent)]/80 truncate">{turno.clientes?.nombre}</p>
                              <p className="text-xs text-gray-600">{turno.clientes?.telefono}</p>
                              <button
                                onClick={() => handleDelete(turno.id)}
                                className="absolute top-1 right-1 text-[var(--accent)]/50 hover:text-[var(--accent)]/80 text-xs opacity-0 group-hover:opacity-100 transition"
                              >✕</button>
                            </div>
                          ) : esContinuacion ? (
                            <div className="rounded-lg p-2 text-center border border-white/5 text-gray-700 text-xs">↳ turno anterior</div>
                          ) : motivoContinuacion ? (
                            <div className="rounded-lg p-2 text-center border border-blue-400/10 text-blue-400/50 text-xs truncate">↳ {motivoContinuacion}</div>
                          ) : esContinuacionPublicada ? (
                            <div className="rounded-lg p-2 text-center border border-cyan-400/10 text-cyan-400/50 text-xs">↳ publicado</div>
                          ) : diaBloqueado ? (
                            <div className="rounded-lg p-2 text-center border border-yellow-500/10 text-yellow-900 text-xs">bloq.</div>
                          ) : hora in horariosBloqueados ? (
                            <button onClick={() => toggleHorario(hora)} className="w-full rounded-lg p-2 text-center border border-orange-500/20 text-orange-800 text-xs hover:border-orange-500/40 transition truncate">
                              {horariosBloqueados[hora] ?? 'bloq.'} ✕
                            </button>
                          ) : `${r.id}_${hora}` in slotsBloqueados ? (
                            slotsBloqueados[`${r.id}_${hora}`]
                              ? <button onClick={() => desbloquearConMotivo(hora, r.id)} className="w-full rounded-lg p-2 text-center border border-blue-400/30 bg-blue-400/10 text-blue-400 text-xs hover:border-blue-400/50 transition truncate">
                                  {slotsBloqueados[`${r.id}_${hora}`]} ✕
                                </button>
                              : <button onClick={() => toggleSlot(hora, r.id)} className="w-full rounded-lg p-2 text-center border border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs hover:border-amber-500/50 transition">
                                  bloqueado ✕
                                </button>
                          ) : negocio.features?.slotsPublicados && slotsPublicadosMap[`${r.id}_${hora}`] && !(slotActivo?.hora === hora && slotActivo?.recursoId === r.id) ? (
                            <button onClick={() => setSlotActivo({ hora, recursoId: r.id })} className="w-full rounded-lg p-2 text-center border border-cyan-400/30 bg-cyan-400/10 text-cyan-400 text-xs hover:border-cyan-400/50 transition">
                              publicado
                            </button>
                          ) : slotActivo?.hora === hora && slotActivo?.recursoId === r.id ? (
                            <div className="rounded-lg p-1.5 border border-white/15 text-xs flex flex-col gap-1">
                              <input
                                type="text"
                                value={slotNombre}
                                onChange={e => setSlotNombre(e.target.value)}
                                placeholder="Nombre cliente*"
                                className="bg-transparent text-white outline-none placeholder-gray-700 text-xs w-full"
                                autoFocus
                              />
                              <input
                                type="text"
                                value={slotTelefono}
                                onChange={e => setSlotTelefono(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="Teléfono (opcional)"
                                className="bg-transparent text-white outline-none placeholder-gray-700 text-xs w-full"
                              />
                              <div className="flex gap-1 justify-end">
                                <button
                                  onClick={async () => {
                                    if (!slotNombre.trim()) return
                                    await cargarTurnoManual(hora, r.id, slotNombre.trim(), slotTelefono.trim())
                                  }}
                                  className="text-green-500 hover:text-green-400 transition text-xs px-2 py-1 rounded border border-green-500/40 hover:bg-green-500/10"
                                >Turno ✓</button>
                                <button
                                  onClick={async () => {
                                    if (negocio.features?.slotsPublicados && slotsPublicadosMap[`${r.id}_${hora}`]) {
                                      await despublicarSlot(hora, r.id)
                                    }
                                    await toggleSlot(hora, r.id)
                                    setSlotActivo(null); setSlotNombre(''); setSlotTelefono('')
                                  }}
                                  className="text-amber-500 hover:text-amber-400 transition text-xs px-2 py-1 rounded border border-amber-500/40 hover:bg-amber-500/10"
                                >Bloquear</button>
                                {negocio.features?.slotsPublicados && !slotsPublicadosMap[`${r.id}_${hora}`] && (
                                  <button
                                    onClick={() => publicarSlot(hora, r.id)}
                                    className="text-cyan-500 hover:text-cyan-400 transition text-xs px-2 py-1 rounded border border-cyan-500/40 hover:bg-cyan-500/10"
                                  >Publicar</button>
                                )}
                                {negocio.features?.slotsPublicados && slotsPublicadosMap[`${r.id}_${hora}`] && (
                                  <button
                                    onClick={async () => { await despublicarSlot(hora, r.id); setSlotActivo(null); setSlotNombre(''); setSlotTelefono('') }}
                                    className="text-cyan-500 hover:text-cyan-400 transition text-xs px-2 py-1 rounded border border-cyan-500/40 hover:bg-cyan-500/10"
                                  >Despublicar</button>
                                )}
                                <button
                                  onClick={() => { setSlotActivo(null); setSlotNombre(''); setSlotTelefono('') }}
                                  className="text-gray-600 hover:text-gray-400 transition text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                                >✕</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setSlotActivo({ hora, recursoId: r.id })} className="w-full rounded-lg p-2 text-center border border-white/5 text-gray-800 text-xs hover:border-white/20 hover:text-gray-600 transition">
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
        ) : modo === 'proximos' ? (
          proximosCombinados.length === 0 ? (
            <p className="text-gray-600">No hay turnos próximos.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-4 text-left text-xs uppercase tracking-widest text-gray-500">Fecha</th>
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
                  {proximosCombinados.map(f => (
                    <tr key={f.key} className={'border-b border-white/5 hover:bg-white/5 transition' + (esPasado(f.fecha, f.horaInicio) ? ' opacity-40' : '')}>
                      <td className="p-4 text-gray-400 text-xs">{new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className="p-4 font-medium">{f.recursoNombre}</td>
                      <td className="p-4">{f.clienteNombre}</td>
                      <td className="p-4 text-gray-400">{f.telefono}</td>
                      <td className="p-4 text-gray-400 text-xs">{f.email}</td>
                      <td className="p-4">{f.horaInicio} - {f.horaFin}</td>
                      <td className="p-4 text-gray-600 text-xs">{f.reservado}</td>
                      <td className="p-4">
                        {!f.esSlot && (
                          <button onClick={() => handleDelete(f.turnoId!)} className="text-[var(--accent)] hover:text-[var(--accent)]/80 text-xs uppercase tracking-widest transition">Eliminar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
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
