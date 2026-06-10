import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { configs } from '@/config'
import { toMin, formatHora } from '@/lib/config'

async function computeToken(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + ':admin-session-v1')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return false
  const cookie = req.cookies.get('admin_session')?.value
  if (!cookie) return false
  const expected = await computeToken(adminPassword)
  return cookie === expected
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { negocio_id, recurso_id, fecha, hora } = await req.json()
  const negocio = configs[negocio_id]
  if (negocio) {
    const horaMin = toMin(hora)
    const subSlots: string[] = []
    for (let d = negocio.horario.intervaloMinutos; d < negocio.duracionMinutos; d += negocio.horario.intervaloMinutos) {
      subSlots.push(formatHora(horaMin + d))
    }
    if (subSlots.length > 0) {
      await supabase.from('slots_publicados').delete()
        .eq('negocio_id', negocio_id).eq('recurso_id', recurso_id).eq('fecha', fecha)
        .in('hora', subSlots)
    }
  }
  const { error } = await supabase.from('slots_publicados').insert({ negocio_id, recurso_id, fecha, hora })
  if (error) { console.error('[publicar-slot POST]', error); return NextResponse.json({ error: error.message }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { negocio_id, recurso_id, fecha, hora } = await req.json()
  const { error } = await supabase.from('slots_publicados').delete()
    .eq('negocio_id', negocio_id)
    .eq('recurso_id', recurso_id)
    .eq('fecha', fecha)
    .eq('hora', hora)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
