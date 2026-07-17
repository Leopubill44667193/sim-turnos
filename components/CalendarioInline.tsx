'use client'

import { useState } from 'react'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

type Props = {
  value: string
  onChange: (fecha: string) => void
  diasHabiles?: number[]
  maxDiasAnticipacion?: number
}

export default function CalendarioInline({ value, onChange, diasHabiles, maxDiasAnticipacion }: Props) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const maxFecha = (() => {
    const d = new Date(hoy + 'T12:00:00')
    d.setDate(d.getDate() + (maxDiasAnticipacion ?? 7))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const [anioHoy, mesHoy] = hoy.split('-').map(Number) // mesHoy es 1-indexed

  const base = value ? new Date(value + 'T12:00:00') : new Date(hoy + 'T12:00:00')
  const [anio, setAnio] = useState(base.getFullYear())
  const [mes, setMes] = useState(base.getMonth()) // 0-indexed

  const puedeAnterior = anio > anioHoy || (anio === anioHoy && mes > mesHoy - 1)
  const puedeSiguiente = (() => {
    const sigAnio = mes === 11 ? anio + 1 : anio
    const sigMes  = mes === 11 ? 0 : mes + 1
    return `${sigAnio}-${String(sigMes + 1).padStart(2, '0')}-01` <= maxFecha
  })()

  function anteriorMes() {
    if (!puedeAnterior) return
    if (mes === 0) { setMes(11); setAnio(a => a - 1) }
    else setMes(m => m - 1)
  }

  function siguienteMes() {
    if (!puedeSiguiente) return
    if (mes === 11) { setMes(0); setAnio(a => a + 1) }
    else setMes(m => m + 1)
  }

  const primerDia = new Date(anio, mes, 1).getDay()
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()

  const celdas: (number | null)[] = Array(primerDia).fill(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d)
  while (celdas.length % 7 !== 0) celdas.push(null)

  function toFechaStr(dia: number) {
    return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  function esDiaValido(dia: number) {
    const f = toFechaStr(dia)
    if (f < hoy) return false
    if (f > maxFecha) return false
    if (!diasHabiles || diasHabiles.length === 0) return true
    return diasHabiles.includes(new Date(anio, mes, dia).getDay())
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 select-none">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={anteriorMes}
          disabled={!puedeAnterior}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-20 disabled:cursor-not-allowed text-xl leading-none"
        >
          ‹
        </button>
        <span className="text-sm font-bold uppercase tracking-widest">
          {MESES[mes]} {anio}
        </span>
        <button
          onClick={siguienteMes}
          disabled={!puedeSiguiente}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-20 disabled:cursor-not-allowed text-xl leading-none"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DIAS.map(d => (
          <div key={d} className="text-center text-xs text-gray-600 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={i} />
          const valido = esDiaValido(dia)
          const seleccionado = toFechaStr(dia) === value
          const esHoy = toFechaStr(dia) === hoy

          return (
            <button
              key={i}
              onClick={() => valido && onChange(toFechaStr(dia))}
              disabled={!valido}
              className={[
                'rounded-lg py-2 text-sm text-center transition font-medium w-full',
                seleccionado
                  ? 'bg-[var(--accent)] text-white font-bold'
                  : valido
                    ? esHoy
                      ? 'text-[var(--accent)] hover:bg-white/10'
                      : 'text-gray-300 hover:bg-white/10'
                    : 'text-gray-700 cursor-not-allowed',
              ].join(' ')}
            >
              {dia}
            </button>
          )
        })}
      </div>
    </div>
  )
}
