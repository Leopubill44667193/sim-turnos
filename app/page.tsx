import type { CSSProperties } from 'react'
import Link from 'next/link'
import { negocio } from '@/config'
import { formatHora, formatDiasHabiles } from '@/lib/config'

function LandingPage() {
  const WA_URL = 'https://wa.me/5492474470920'

  const clientes = [
    { num: '01', nombre: 'La Cancha Padel', tipo: 'Pádel', lugar: 'Rojas, Buenos Aires', url: 'https://lacancha.reservaturnos.com.ar' },
    { num: '02', nombre: 'OC Hobbies Racing', tipo: 'Simuladores', lugar: 'Rojas, Buenos Aires', url: 'https://ochobbies.reservaturnos.com.ar' },
    { num: '03', nombre: 'Prgrssv', tipo: 'Peluquería', lugar: 'Rosario, Santa Fe', url: 'https://prgrssv.reservaturnos.com.ar' },
  ]

  const features = [
    { num: '01', titulo: 'Reservas 24 horas', desc: 'Tu cliente reserva un domingo a las 3 AM. Vos te enterás cuando abrís el WhatsApp.' },
    { num: '02', titulo: 'WhatsApp automático', desc: 'Confirmación al cliente, aviso al negocio, recordatorio 24hs antes del turno. Cancelaciones con un link, sin tu intervención.' },
    { num: '03', titulo: 'Tu link personalizado', desc: 'tunegocio.reservaturnos.com.ar — corto, fácil de compartir en Instagram, WhatsApp o donde haga falta.' },
    { num: '04', titulo: 'Verificación de identidad', desc: 'Login con Google obligatorio. Se acabaron los turnos con nombres truchos.' },
    { num: '05', titulo: 'Panel de control', desc: 'Vista por día, grilla de turnos y bloqueos. Lo que un administrador realmente necesita.' },
    { num: '06', titulo: 'Un solo proveedor', desc: 'Yo te lo armo, te lo subo y te lo mantengo.' },
  ]

  const serif: CSSProperties = { fontFamily: 'var(--font-instrument-serif)', fontWeight: 400 }
  const divider = '0.5px solid rgba(255,255,255,0.1)'

  return (
    <main
      className="min-h-screen text-white flex flex-col"
      style={{ backgroundColor: '#080808', fontFamily: 'var(--font-inter, sans-serif)' }}
    >
      {/* Nav */}
      <nav className="px-6 md:px-12 py-5 flex items-center justify-between" style={{ borderBottom: divider }}>
        <span className="text-sm font-medium tracking-tight">
          reservaturnos<span className="text-neutral-500">.com.ar</span>
        </span>
        <a
          href={WA_URL}
          className="text-sm px-4 py-2 bg-white text-[#080808] rounded-full font-medium hover:bg-neutral-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Sumar mi negocio →
        </a>
      </nav>

      {/* Hero */}
      <section className="px-6 md:px-12 pt-20 pb-20 max-w-5xl">
        <p className="text-xs tracking-[0.25em] text-neutral-500 mb-8 flex items-center gap-3">
          <span className="inline-block w-4 h-px bg-neutral-600" aria-hidden="true" />
          RESERVAS ONLINE · ARGENTINA
        </p>
        <h1 style={serif} className="text-4xl md:text-6xl lg:text-7xl leading-tight text-white mb-8">
          Que tus clientes reserven solos,<br />
          <em>mientras vos atendés.</em>
        </h1>
        <p className="text-neutral-400 text-base md:text-lg font-light max-w-xl mb-10 leading-relaxed">
          Dejá de pasar el día contestando WhatsApps para coordinar turnos. Tu cliente entra a tu link, elige horario y vos recibís la notificación lista.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={WA_URL}
            className="px-6 py-3 bg-white text-[#080808] font-medium text-sm rounded-full hover:bg-neutral-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white text-center"
          >
            Sumar mi negocio →
          </a>
          <a
            href="#features"
            className="px-6 py-3 text-white text-sm rounded-full hover:bg-white/5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white text-center"
            style={{ border: '0.5px solid rgba(255,255,255,0.2)' }}
          >
            Ver cómo funciona
          </a>
        </div>
      </section>

      {/* Clientes activos */}
      <section className="px-6 md:px-12 py-20" style={{ borderTop: divider }}>
        <p className="text-xs tracking-[0.25em] text-neutral-500 mb-4 flex items-center gap-3">
          <span className="inline-block w-4 h-px bg-neutral-600" aria-hidden="true" />
          CLIENTES ACTIVOS · MIRÁ EL SISTEMA EN VIVO
        </p>
        <h2 style={serif} className="text-3xl md:text-5xl text-white mb-12">
          Negocios reales <em>usándolo todos los días.</em>
        </h2>
        <div>
          {clientes.map((n) => (
            <a
              key={n.url}
              href={n.url}
              className="flex items-center gap-6 py-5 hover:pl-2 transition-all duration-200 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{ borderTop: divider }}
            >
              <span className="text-neutral-600 text-xs tabular-nums w-6 shrink-0">{n.num}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{n.nombre}</p>
                <p className="text-neutral-500 text-xs mt-0.5">{n.tipo} · {n.lugar}</p>
              </div>
              <span className="text-neutral-600 text-xs group-hover:text-neutral-400 transition-colors shrink-0">→</span>
            </a>
          ))}
          <div style={{ borderTop: divider }} />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 md:px-12 py-20" style={{ borderTop: divider }}>
        <p className="text-xs tracking-[0.25em] text-neutral-500 mb-4 flex items-center gap-3">
          <span className="inline-block w-4 h-px bg-neutral-600" aria-hidden="true" />
          QUÉ INCLUYE
        </p>
        <h2 style={serif} className="text-3xl md:text-5xl text-white mb-16 max-w-3xl">
          Todo lo que necesitás <em>para no atender más el teléfono.</em>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.num} className="pt-6 pb-10 pr-8" style={{ borderTop: divider }}>
              <p className="text-neutral-600 text-xs mb-4">{f.num}</p>
              <p className="text-white font-medium text-sm mb-2">{f.titulo}</p>
              <p className="text-neutral-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 md:px-12 py-20" style={{ borderTop: divider }}>
        <h2 style={serif} className="text-3xl md:text-5xl lg:text-6xl text-white mb-10 max-w-3xl leading-tight">
          Cada turno que coordinás a mano <em>es plata que dejás en la mesa.</em>
        </h2>
        <a
          href={WA_URL}
          className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#080808] font-medium rounded-full hover:bg-neutral-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Hablemos por WhatsApp →
        </a>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 mt-auto" style={{ borderTop: divider }}>
        <p className="text-neutral-700 text-xs">© 2026 reservaturnos.com.ar · Argentina</p>
      </footer>
    </main>
  )
}

export default function Home() {
  if (negocio.id === 'landing') return <LandingPage />

  const horaInicio = formatHora(negocio.horario.inicioMin)
  const horaFin = formatHora(negocio.horario.finMin)

  return (
    <main className="min-h-screen bg-[var(--bg)] text-white flex flex-col">
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-widest uppercase">
            <span className="text-[var(--accent)]">{negocio.nombreDisplay?.parte1 ?? negocio.nombre.split('.')[0] + '.'}</span>
            {negocio.nombreDisplay ? negocio.nombreDisplay.parte2 : negocio.nombre.split('.').slice(1).join('.')}
          </h1>
          <p className="text-xs text-gray-600 tracking-wider uppercase mt-0.5">{negocio.direccionCorta ?? negocio.direccion}</p>
        </div>
        <div className="text-xs text-gray-600 tracking-widest uppercase text-right">
          <div>{horaInicio} - {horaFin}</div>
          <div>{formatDiasHabiles(negocio.diasHabiles)}</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-20 text-center">
        <p className="text-xs tracking-[0.4em] uppercase text-[var(--accent)] mb-6 flex items-center justify-center gap-3">
          <span className="inline-block w-6 h-px bg-[var(--accent)]" />
          Reservas en linea
          <span className="inline-block w-6 h-px bg-[var(--accent)]" />
        </p>
        <h2
          className="text-7xl md:text-8xl font-black uppercase tracking-tight leading-none mb-4"
          style={{
            fontFamily: "var(--font-title, inherit)",
            ...(negocio.fontTitle && { fontWeight: "normal", letterSpacing: "0.04em" }),
          }}
        >
          Reservá tu<br />
          <span className="text-[var(--accent)]">{(negocio.heroTexto ?? negocio.recursoNombre).toLowerCase()}</span>
        </h2>
        <p className="text-gray-600 text-sm tracking-wide mb-12">
          {negocio.recursos.length} {negocio.recursoNombrePlural.toLowerCase()} · Turnos de {negocio.duracionMinutos} min · Reservá tu {negocio.recursoNombre.toLowerCase()}
        </p>
        <Link href="/reservar" className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-2xl px-12 py-5 font-black uppercase tracking-widest transition text-sm">
          Reservar ahora
        </Link>
        <Link href="/mis-turnos" className="mt-4 text-gray-600 hover:text-gray-400 text-xs tracking-widest uppercase underline transition">
          Ver mis turnos
        </Link>
      </div>

      <div className="border-t border-white/5 px-8 py-6 text-center">
        <p className="text-xs text-gray-700 tracking-widest uppercase">{negocio.nombre} · {negocio.direccion.split('·').pop()?.trim()}</p>
      </div>
    </main>
  )
}
