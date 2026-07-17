import type { NegocioConfig } from '@/lib/config'

const config: NegocioConfig = {
  id: 'bogado',
  nombre: 'Bogado Pádel',
  nombreDisplay: { parte1: 'Bogado', parte2: ' Pádel' },
  direccion: 'Coronel Bogado, Santa Fe · maps.google.com/?q=-33.318139,-60.597694',
  horario: {
    inicioMin: 9 * 60,
    finMin: 24 * 60,  // 00:00 — permite mostrar sub-slots del último turno de 22:30
    intervaloMinutos: 30,
  },
  recursos: [
    { id: 1, nombre: 'Cancha Central' },
  ],
  recursoNombre: 'Cancha Central',
  recursoNombrePlural: 'Canchas',
  duracionMinutos: 90,
  adminPassword: 'Bogado123',
  emoji: '🎾',
  tema: { accent: '#F47C20', accentHover: '#d96a10', bg: '#0a0f1e' },
  features: { asignacionAutomatica: true, slotsPublicados: true, limiteReservasPorIP: 2 },
  telefonoPlaceholder: '341 123-4567',
  cancelacionMinHs: 6,
  whatsappNegocio: '5493412662777',
}

export default config
