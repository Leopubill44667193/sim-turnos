export type NegocioConfig = {
  id: string
  nombre: string              // "OC.Hobbies.Racing"
  nombreDisplay?: {
    parte1: string            // se coloriza con accent
    parte2?: string           // color normal, opcional
  }
  direccion: string           // "Av. 3 de Febrero 283 · Rojas"
  horario: {
    inicioMin: number         // minutos desde medianoche, ej: 15*60=900
    finMin: number            // minutos de cierre, ej: 19*60+30=1170 | 26*60=1560 (02:00 del día siguiente)
    intervaloMinutos: number  // 30 o 60
  }
  diasHabiles?: number[]      // 0=Dom, 1=Lun ... 6=Sáb. undefined = todos los días
  recursos: { id: number; nombre: string }[]
  recursoNombre: string       // "Simulador", "Cancha", "Peluquero"
  recursoNombrePlural: string // "Simuladores", "Canchas", "Peluqueros"
  duracionMinutos: number
  adminPassword: string
  emoji?: string              // emoji representativo del recurso
  seleccionSimple?: boolean   // true = solo se puede elegir 1 recurso por turno
  tema?: {
    accent: string            // color de acento, ej: '#ef4444'
    accentHover: string       // hover del acento, ej: '#dc2626'
    bg: string                // color de fondo, ej: '#000000'
  }
  features?: {
    multiRecurso?: boolean
    listaEspera?: boolean
    seniaObligatoria?: boolean
    recordatorio24hs?: boolean
    confirmacionCliente?: boolean
    limiteReservasPorIP?: number
    asignacionAutomatica?: boolean
    slotsPublicados?: boolean
  }
  telefonoPlaceholder?: string
  anticipacionMinHs?: number    // bloquea slots con menos de N horas de anticipación
  cancelacionMinHs?: number     // horas mínimas de anticipación para cancelar sin contactar al local
  whatsappNegocio?: string      // número de WhatsApp del local sin +, ej: "5492474470920"
  fontTitle?: string            // e.g. 'Bebas Neue' — fuente de títulos, cargada desde Google Fonts
  bgTexture?: 'grid'            // textura de fondo sutil
}

/** Genera el array de horarios a partir del rango del negocio.
 *  ej: inicioMin=540, finMin=1170, intervalo=30 → ['09:00', '09:30', ..., '19:00']
 *  Si se pasa duracionMinutos, excluye slots cuya duración completa supere finMin. */
export function generarHorarios(inicioMin: number, finMin: number, intervaloMinutos: number, duracionMinutos?: number): string[] {
  const dur = duracionMinutos ?? intervaloMinutos
  const horarios: string[] = []
  for (let m = inicioMin; m + dur <= finMin; m += intervaloMinutos) {
    horarios.push(formatHora(m))
  }
  return horarios
}

/** Formatea minutos desde medianoche como string HH:MM.
 *  ej: 900 → "15:00", 1560 → "02:00", 1170 → "19:30" */
export function formatHora(minutos: number): string {
  const total = minutos % (24 * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

/** Convierte "HH:MM" a minutos desde medianoche. */
export function toMin(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** Texto legible de los días hábiles. */
export function formatDiasHabiles(dias?: number[]): string {
  if (!dias || dias.length === 7) return 'Todos los días'
  const clave = dias.join(',')
  if (clave === '1,2,3,4,5') return 'Lunes a Viernes'
  if (clave === '1,2,3,4,5,6') return 'Lunes a Sábado'
  const nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return dias.map(d => nombres[d]).join(', ')
}

/** Umbral en minutos para detectar si estamos en horas post-medianoche.
 *  Solo aplica cuando el negocio cierra pasada la medianoche. */
export function calcularUmbral(finMin: number): number {
  if (finMin <= 24 * 60) return 0
  return Math.floor((finMin - 24 * 60) / 60) + 1  // en horas, para horaValida
}

/** Determina si un slot horario es válido para reservar en la fecha dada.
 *  Bloquea slots ya pasados del día actual, con soporte de 30 min y cruce de medianoche.
 *  Si anticipacionMinHs está definido, bloquea slots dentro de las próximas N horas (incluso en días futuros). */
export function horaValida(hora: string, fecha: string, umbral: number, anticipacionMinHs?: number): boolean {
  const ahora = new Date()
  const hoy = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const [h, m] = hora.split(':').map(Number)
  const minutosSlot = h * 60 + m

  if (anticipacionMinHs !== undefined) {
    // Construimos el datetime del slot y comparamos contra ahora + anticipación
    const slotDate = new Date(`${fecha}T${hora}:00`)
    const limiteMs = ahora.getTime() + anticipacionMinHs * 60 * 60 * 1000
    if (slotDate.getTime() <= limiteMs) return false
  }

  if (fecha !== hoy) return true

  const [horaAR, minAR] = ahora.toLocaleTimeString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).split(':').map(Number)
  const minutosActuales = horaAR * 60 + minAR

  if (umbral === 0) return minutosSlot > minutosActuales

  const umbralMin = umbral * 60
  if (minutosActuales < umbralMin) return minutosSlot >= umbralMin || minutosSlot > minutosActuales
  return minutosSlot < umbralMin || minutosSlot > minutosActuales
}

/** Verifica si una fecha cae en un día hábil del negocio. */
export function esDiaHabil(fecha: string, diasHabiles?: number[]): boolean {
  if (!diasHabiles || diasHabiles.length === 0) return true
  const dia = new Date(fecha + 'T12:00:00').getDay()
  return diasHabiles.includes(dia)
}
