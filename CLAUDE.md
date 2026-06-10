# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reglas para Claude Code

- Siempre que se cree una tabla nueva en Supabase, agregarla al esquema en este archivo.
- Siempre que se cree una route nueva, agregarla a la tabla de Rutas.
- Al final de cada sesión, actualizar la sección de Features pendientes marcando lo completado.
- Nunca modificar `.env.local` directamente.

---

# sim-turnos — Sistema multi-negocio de reservas

**Estado:** En producción (sim-turnos.vercel.app)

Sistema de reservas online configurable por negocio. Un solo repo, una sola base de datos Supabase compartida, múltiples deployments en Vercel.

---

## Negocios activos

| ID | Negocio | Dirección | Recursos | Horario |
|----|---------|-----------|----------|---------|
| `sim-turnos` | OC.Hobbies.Racing | Av. 3 de Febrero 283, Rojas | 4 simuladores, 60 min | 15:00-02:00 todos los días |
| `prgrssv` | Prgrssv | Zeballos 2239 6A, Rosario | 1 peluquero, 30 min | 09:00-19:30 Lun-Vie |
| `lacancha` | La Cancha Padel | Av. 20 de Diciembre 180, Rojas | 4 canchas, intervalo 30 min, turno 90 min, asignacionAutomatica | 09:00-22:30 todos los días |
| `demo-padel` | Club Demo Pádel | Av. Siempreviva 742, Rosario | 4 canchas, 90 min | 09:00-00:00 todos los días |

## Dominios

| Subdominio | Negocio |
|------------|---------|
| `reservaturnos.com.ar` (y www) | `landing` |
| `lacancha.reservaturnos.com.ar` | `lacancha` |
| `ochobbies.reservaturnos.com.ar` | `sim-turnos` |
| `prgrssv.reservaturnos.com.ar` | `prgrssv` |
| `demo-padel-ten.vercel.app` | `demo-padel` |

## Landing comercial

Existe un cuarto proyecto en Vercel llamado `reservaturnos-landing` que apunta al mismo repo y sirve el dominio raíz `reservaturnos.com.ar` (y www).

- **Variable de entorno clave:** `NEXT_PUBLIC_NEGOCIO_ID=landing`
- **Config:** `config/landing.ts` (valores neutros, no es un negocio real)
- **Renderizado:** la función `LandingPage()` en `app/page.tsx` se activa cuando `negocio.id === 'landing'`. En cualquier otro caso se renderiza la home del negocio normal.
- **Diseño:** dark mode editorial inspirado en efficast.ai. Fondo #080808, tipografías Instrument Serif (titulares) e Inter (cuerpo) cargadas via next/font/google en app/layout.tsx.
- **Independencia visual:** la landing ignora las CSS variables --accent, --bg del config del negocio. Los colores están hardcodeados con Tailwind. Esto la hace visualmente independiente de los temas de cada negocio.

**Adaptaciones en app/layout.tsx para el caso landing:**
- El footer global con `negocio.direccion` se omite cuando `negocio.id === 'landing'` (la landing tiene su propio footer).
- La `metadata` (title, description) usa valores específicos para la landing cuando `negocio.id === 'landing'`, en lugar de los genéricos que se arman con `negocio.nombre` y `negocio.recursos`.

---

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | Next.js (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| Base de datos | Supabase (PostgreSQL) — una sola instancia compartida, aislada por `negocio_id` |
| Auth admin | `ADMIN_PASSWORD` (env var server-side) + cookie httpOnly `admin_session` |
| Notificaciones | Twilio WhatsApp |
| Deploy | Vercel |

---

## Comandos

```bash
npm run dev:sim        # OC.Hobbies.Racing
npm run dev:prgrssv    # Prgrssv peluquería
npm run dev:lacancha   # La Cancha Padel

rm -rf .next && npm run dev:sim  # si hay problemas de caché
npm run lint
git add -p && git commit -m "..." && git push origin main && git push prgrssv main
```

El repo tiene dos remotes: `origin` (sim-turnos.vercel.app) y `prgrssv` (prgrssv.vercel.app). **Siempre pushear a ambos** para que los dos deployments de Vercel se actualicen.

**No tocar `.env.local`** para cambiar el negocio — usar los scripts `dev:*` de arriba.

No hay tests configurados y no se deben agregar salvo que se pida explícitamente.

## Flujo de trabajo

1. Crear rama: `git checkout -b feature/nombre`
2. Hacer cambios y probar en local con `npm run dev:negocio`
3. Pushear → Vercel genera URL preview automática para verificar
4. Si todo bien: `git checkout main && git merge feature/nombre`
5. Correr `bash scripts/check.sh` → tiene que dar 12/12
6. Pushear: `git push origin main && git push prgrssv main`

---

## Agregar un negocio nuevo

1. Copiar `config/sim-turnos.ts` como base y renombrar
2. Completar los campos (ver sección NegocioConfig abajo)
3. Registrar en `config/index.ts`
4. Crear deployment en Vercel con las variables de entorno del nuevo negocio

**No hace falta crear una Supabase nueva.** La BD es compartida y los datos se aíslan por `negocio_id`.

---

## NegocioConfig — todos los campos

```ts
{
  id: string            // identificador único, debe coincidir con NEXT_PUBLIC_NEGOCIO_ID
  nombre: string        // nombre visible del negocio
  nombreDisplay?: {
    parte1: string      // se coloriza con --accent en el header
    parte2?: string     // color normal, opcional. Incluir separadores (espacios, puntos) acá si se necesitan
  }
  direccion: string     // dirección, se muestra en el header y footer
  horario: {
    inicioMin: number   // minutos desde medianoche. Ej: 9*60 = 540 (09:00)
    finMin: number      // minutos de cierre. Ej: 24*60 = 1440 (00:00). Soporta cruce de medianoche
    intervaloMinutos: number  // duración del slot en minutos (30, 60, 90, etc.)
  }
  diasHabiles?: number[]      // 0=Dom, 1=Lun ... 6=Sáb. undefined = todos los días
  recursos: { id: number; nombre: string }[]  // lista de recursos. El nombre es lo que se muestra
  recursoNombre: string       // singular: "Simulador", "Cancha", "Peluquero"
  recursoNombrePlural: string // plural: "Simuladores", "Canchas", "Peluqueros"
  duracionMinutos: number     // duración del turno en minutos
  adminPassword: string       // contraseña del panel admin
  emoji: string               // emoji del recurso. Se usa en favicon, botones y mensajes WhatsApp
  seleccionSimple?: boolean   // true = solo se elige 1 recurso por turno. false/undefined = multi-select
  tema?: {
    accent: string            // color de acento hex. Default: '#ef4444'
    accentHover: string       // hover del acento hex. Default: '#dc2626'
    bg: string                // color de fondo hex. Default: '#000000'
  }
  features?: {
    multiRecurso?: boolean        // puede seleccionar múltiples recursos por turno
    listaEspera?: boolean         // lista de espera (no implementado)
    seniaObligatoria?: boolean    // seña obligatoria al reservar (no implementado)
    recordatorio24hs?: boolean    // recordatorio 24hs antes (no implementado)
    confirmacionCliente?: boolean // confirmación al cliente por WhatsApp (no implementado)
    limiteReservasPorIP?: number  // número máximo de reservas permitidas por IP en una ventana de 24 horas. Si está undefined, no se aplica límite.
    asignacionAutomatica?: boolean  // true = el sistema asigna automáticamente el primer recurso libre, el cliente no elige. La grilla oculta slots sin disponibilidad. Confirmado y WhatsApp muestran solo el nombre del recurso sin número.
    slotsPublicados?: boolean       // true = el admin publica slots explícitamente; el cliente solo ve slots publicados y libres. Solo lacancha por ahora.
  }
  anticipacionMinHs?: number      // bloquea slots con menos de N horas de anticipación desde ahora (aplica en días futuros también). undefined = sin restricción
  cancelacionMinHs?: number       // horas mínimas de anticipación para cancelar sin contactar al local. Se muestra en /cancelar/[token]. lacancha: 6
  whatsappNegocio?: string        // número WhatsApp del local sin + ni espacios, ej: "5492474470920". Se usa en el botón de contacto de /confirmado. lacancha: '5492474661495'
  fontTitle?: string              // fuente para títulos, cargada desde Google Fonts vía next/font. Ej: 'Bebas Neue'
  bgTexture?: 'grid'              // textura de fondo sutil. 'grid' = grilla verde semitransparente
  telefonoPlaceholder?: string    // placeholder del input de teléfono en el flujo de reserva. Ej: '2474 123456'. Default: '11 1234-5678'
}
```

**Sobre `nombreDisplay`:** si no se define, el header hace fallback a `nombre.split('.')` — útil para nombres con puntos como `OC.Hobbies.Racing`. Para nombres sin puntos (ej: `La Cancha Padel`) definirlo siempre para evitar bugs visuales. Si solo se define `parte1` (sin `parte2`), el header muestra únicamente `parte1` en color acento — el fallback de split solo se activa cuando `nombreDisplay` es undefined.

**Sobre `tema`:** los colores se inyectan como CSS variables `--accent`, `--accent-hover`, `--bg` en el layout. Todos los componentes los usan via `var(--accent)` etc.

**Sobre el nombre del recurso:** se muestra tal cual en la UI, mensajes de WhatsApp y admin. Si un recurso tiene característica especial, incluirla en el nombre (ej: `'Cancha 5 (Blindex)'`).

---

## Regla central: negocio_id en todos los queries

Todos los queries a Supabase deben filtrar por `.eq('negocio_id', negocio.id)`.
Todos los inserts deben incluir `negocio_id: negocio.id`.
Sin esto los datos se mezclan entre negocios.

---

## Esquema de base de datos (Supabase)

### `clientes`
| campo | tipo | notas |
|-------|------|-------|
| id | uuid PK | |
| negocio_id | text | aísla por negocio |
| nombre | text | |
| telefono | text nullable | único por negocio. NULL permitido (DROP NOT NULL ejecutado 2026-05-30) — varios clientes pueden tener telefono NULL coexistiendo en la UNIQUE |

**Constraint:** `UNIQUE (negocio_id, telefono)`

### `simuladores`
| campo | tipo |
|-------|------|
| id | int PK |
| nombre | text |

### `dias_bloqueados`
| campo | tipo | notas |
|-------|------|-------|
| negocio_id | text | |
| fecha | date | |
| motivo | text | nullable |

**PK:** `(negocio_id, fecha)`

### `horarios_bloqueados`
| campo | tipo | notas |
|-------|------|-------|
| negocio_id | text | |
| fecha | date | |
| hora | time | |

**Constraint:** `UNIQUE (negocio_id, fecha, hora)`

### `turnos`
| campo | tipo | notas |
|-------|------|-------|
| id | uuid PK | |
| negocio_id | text | aísla por negocio |
| simulador_id | int FK | |
| cliente_id | uuid FK | |
| fecha | date | |
| hora_inicio | time | |
| hora_fin | time | se guarda en el insert, calculada con negocio.duracionMinutos |
| cancel_token | uuid | generado por Supabase, para cancelar sin login |
| created_at | timestamptz | |
| email_verificacion | text | nullable — email Google verificado al momento de reservar. NULL en turnos anteriores a 2026-05-05 |

**Constraint:** `UNIQUE (negocio_id, simulador_id, fecha, hora_inicio)` — **OJO:** el constraint real en la BD se llamaba `turnos_simulador_fecha_hora_unique` y originalmente NO incluía `negocio_id`, lo que causaba colisiones entre negocios. Se corrigió el 2026-04-30 con `ALTER TABLE turnos DROP CONSTRAINT ... / ADD CONSTRAINT ... UNIQUE (negocio_id, simulador_id, fecha, hora_inicio)`.

**Sobre hora_fin:** se guarda en el momento de la reserva usando `negocio.duracionMinutos`. Si en el futuro se cambia la duración del negocio, los turnos viejos conservan la hora_fin original — eso es intencional.

### `reservas_por_ip`
| campo | tipo | notas |
|-------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| negocio_id | text NOT NULL | |
| ip | text NOT NULL | |
| created_at | timestamptz NOT NULL | default now() |

**Índice:** `(negocio_id, ip, created_at DESC)`

Usada por `/api/validar-reserva` para el rate limiting por IP. Migración ejecutada el 2026-05-03.

```sql
CREATE TABLE reservas_por_ip (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id text        NOT NULL,
  ip         text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservas_por_ip_negocio_ip_created
  ON reservas_por_ip (negocio_id, ip, created_at DESC);
```

RLS deshabilitado (misma anon key para todos).

### `slots_publicados`
| campo | tipo | notas |
|-------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| negocio_id | text NOT NULL | |
| recurso_id | int NOT NULL | |
| fecha | date NOT NULL | |
| hora | time NOT NULL | |
| created_at | timestamptz NOT NULL | default now() |

**Índice único:** `(negocio_id, recurso_id, fecha, hora)`

Usada por `features.slotsPublicados` (actualmente solo `lacancha`). El admin publica slots desde la grilla Por día. El cliente solo ve slots publicados y libres (`recursosReservables` filtra por hora exacta). Al confirmar reserva o cargar turno manual sobre un slot publicado, se eliminan todos los `slots_publicados` que solapan con ese turno (overlap bidireccional: `horaMin < pubMin + duracion && pubMin < horaMin + duracion`). El POST de publicación limpia sub-slots del rango antes de insertar. Los sub-slots H+30 y H+60 son solo visuales en la grilla del admin (`↳ publicado`) y no se persisten en la BD.

```sql
CREATE TABLE slots_publicados (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id text        NOT NULL,
  recurso_id int         NOT NULL,
  fecha      date        NOT NULL,
  hora       time        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_slots_publicados_unique
  ON slots_publicados (negocio_id, recurso_id, fecha, hora);
```

RLS deshabilitado.

### `slots_bloqueados`
| campo | tipo | notas |
|-------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| negocio_id | text NOT NULL | |
| recurso_id | int NOT NULL | |
| fecha | date NOT NULL | |
| hora | time NOT NULL | |
| motivo | text | nullable |
| created_at | timestamptz NOT NULL | default now() |

**Índice único:** `(negocio_id, recurso_id, fecha, hora)`

Usada por `/api/admin/bloquear-slot` para bloquear slots individuales desde el admin. El flujo de reserva consulta esta tabla para excluir esos slots de la disponibilidad. Migración ejecutada el 2026-05-19.

**Semántica de `motivo`:** determina el rango de cobertura del bloqueo en el flujo de reserva.
- **Con motivo** (turno fijo, ej: "Dai Pergolesi"): bloquea durante `duracionMinutos` (90 min en lacancha). Un cliente no puede reservar ese slot ni los sub-slots hasta que termine el bloqueo.
- **Sin motivo** (bloqueo genérico): bloquea solo durante `intervaloMinutos` (30 min en lacancha). Cubre exactamente ese slot de 30 min.

En la grilla del admin, el slot de inicio con motivo se muestra en azul con el nombre; los slots de continuación (+30min, +60min) se muestran como `↳ [motivo]` en azul tenue y no son clickeables.

```sql
CREATE TABLE slots_bloqueados (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id text        NOT NULL,
  recurso_id int         NOT NULL,
  fecha      date        NOT NULL,
  hora       time        NOT NULL,
  motivo     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_slots_bloqueados_unique
  ON slots_bloqueados (negocio_id, recurso_id, fecha, hora);
```

RLS deshabilitado.

---

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing con botón Reservar ahora |
| `/reservar` | Flujo principal: fecha → hora → recursos → datos → confirmar |
| `/reservar/[id]` | Flujo alternativo: un recurso específico, hasta 4 horas |
| `/confirmado` | Resumen con links de cancelación por recurso + botón WhatsApp |
| `/cancelar/[token]` | Cancelación self-service, sin login |
| `/cancelar` | Redirige a /mis-turnos |
| `/mis-turnos` | Buscar turnos propios por teléfono |
| `/admin` | Panel con cuatro pestañas: Resumen / Próximos / Todos / Por día. **Resumen:** métricas de hoy, semana y mes — combina `turnos` + `slots_bloqueados` con motivo no vacío (los slots con nombre representan reservas del dueño). Query trae desde inicioMes(-1) hasta finMes(0). **Próximos:** combina turnos reales y slots con motivo, ordenados por fecha+hora; slots sin botón Eliminar. **Por día:** grilla + tabla + bloqueos. En la grilla: click en slot libre abre form con opciones: (1) Turno ✓ — carga turno manual (nombre obligatorio, teléfono opcional), se inserta en `turnos`; si el slot está publicado también elimina todos los `slots_publicados` que solapan (fórmula de overlap bidireccional); (2) Bloquear — bloquea ese slot; si estaba publicado también lo despublica; (3) Publicar — solo negocios con `slotsPublicados`, solo si el slot no está publicado; (4) Despublicar — solo si el slot está publicado; (5) ✕ — cierra sin acción. Slot publicado (cian): click → abre el mismo form; sub-slots H+30 y H+60 de un publicado muestran `↳ publicado` en cian tenue y no son clickeables. Bloqueos con motivo: slots +30/+60 muestran `↳ [motivo]`. Click en label de hora → bloquea/desbloquea todos los slots libres de esa fila. Flechas ‹ › para navegar días. |
| `/api/notificar` | POST server-side → Twilio Content Templates: admin (TO_1/TO_2) + cliente |
| `/api/validar-reserva` | POST server-side → valida nombre/teléfono y límite por IP antes del insert |
| `/api/admin/bloquear-slot` | POST/DELETE server-side → bloquea o desbloquea un slot individual (recurso + fecha + hora) en `slots_bloqueados`. Requiere cookie `admin_session`. |
| `/api/admin/publicar-slot` | POST/DELETE server-side → publica o despublica un slot individual en `slots_publicados`. Solo para negocios con `features.slotsPublicados`. Requiere cookie `admin_session`. El POST también borra sub-slots dentro del rango `[H+intervalo, H+duracion)` antes de insertar, para evitar stale data. |

---

## Decisiones técnicas importantes

### TypeScript estricto
`ignoreBuildErrors: false` en `next.config.ts`. El build falla si hay errores de tipos — Vercel no despliega código roto silenciosamente.

### Multi-negocio
Cada negocio tiene un archivo en `config/` con tipo `NegocioConfig`. La config activa se selecciona por `NEXT_PUBLIC_NEGOCIO_ID` (default: `sim-turnos`). Un solo repo, múltiples deployments en Vercel, una sola BD Supabase.

### Sistema de temas
Los colores se definen en `config/<negocio>.ts` como `tema: { accent, accentHover, bg }` con hex directos. `app/layout.tsx` los inyecta como CSS variables `:root { --accent, --accent-hover, --bg }`. Sin `tema` definido usa rojo/negro como default.

`fontTitle` carga la fuente indicada desde Google Fonts vía `next/font` (self-hosted) e inyecta `--font-title` como CSS variable. El hero de `app/page.tsx` la usa via `font-family: var(--font-title, inherit)` — sin efecto en negocios que no la definen. Cuando se define, también se sobreescribe `font-weight` a normal (necesario para fuentes display de un solo peso como Bebas Neue).

`bgTexture: 'grid'` agrega un `<div>` fijo con `z-index: -10` en el body que muestra una grilla semitransparente usando el color de acento del negocio.

### Helpers de horario (`lib/config.ts`)
- `generarHorarios()` — crea array de slots desde apertura/cierre
- `formatHora()` — convierte minutos desde medianoche a HH:MM, maneja horarios del día siguiente
- `horaValida()` — bloquea slots pasados del día actual, maneja cruce de medianoche
- `esDiaHabil()` — verifica si la fecha cae en los días hábiles del negocio
- `calcularUmbral()` — detecta si el horario cruza la medianoche

### Notificaciones server-side (Twilio)
Las credenciales de Twilio viven en variables de entorno del servidor. La llamada se hace desde `app/api/notificar/route.ts` usando Twilio Content Templates (`ContentSid` + `ContentVariables`). Envía en paralelo a: admin (TO_1 y opcionalmente TO_2) y al teléfono del cliente. Nunca se exponen al browser.

El endpoint recibe `{ tipo, fechaHora, turno, nombreCliente, telefonoCliente, direccion, linkCancelacion, linkNegocio }`. Según `tipo` (`confirmacion` o `cancelacion`) elige los SIDs de admin y cliente correspondientes.

### cancel_token en lugar de auth
Cada turno tiene un `cancel_token` UUID generado por Supabase. Permite cancelar sin cuenta ni login. Los links de cancelación se muestran en `/confirmado` y se envían por WhatsApp.

### Anti-abuso en el flujo de reserva (`app/api/validar-reserva/route.ts`)
Endpoint POST llamado desde el cliente antes de insertar un turno. Recibe `{ negocio_id, nombre, telefono }` y valida en orden:

1. **Nombre:** exactamente un espacio (nombre + apellido), cada parte 3-15 letras, solo caracteres con acentos, al menos una vocal, no todo la misma letra, blacklist de palabras falsas.
2. **Teléfono:** 10-11 dígitos, solo números.
3. **Límite por IP** (si `features.limiteReservasPorIP` está definido): cuenta registros en `reservas_por_ip` para esa IP + negocio en las últimas 24hs. Si supera el límite devuelve 429. Si pasa, inserta un registro nuevo.

La IP se lee de `x-forwarded-for` (Vercel) con fallback a `x-real-ip`. El mapa `configs` se exporta desde `config/index.ts` para que el endpoint pueda leer la config de cualquier negocio sin depender de `NEXT_PUBLIC_NEGOCIO_ID`.

Valores actuales de `limiteReservasPorIP`: `lacancha` = 2, `sim-turnos` = 4, `prgrssv` = 1.

### Lógica de disponibilidad por rango (`horaConflicto` / `recursosOcupados`)

Un slot de cliente en hora `S` está no disponible si existe un turno o bloqueo en hora `T` tal que `S >= T && S < T + duración`.

- **Turnos reales** y **bloqueos con motivo**: duración = `negocio.duracionMinutos` (90 min en lacancha). Bloquean los sub-slots del turno completo.
- **Bloqueos sin motivo** (`slots_bloqueados` con `motivo = null`): duración = `negocio.horario.intervaloMinutos` (30 min). Bloquean exactamente ese slot.
- **`horarios_bloqueados`** (bloqueo de todos los recursos a la vez): siempre usa `duracionMinutos`.

La fórmula es unidireccional: un slot en 15:30 NO es bloqueado por un turno que empieza a las 16:00, aunque la reserva a las 15:30 terminaría a las 17:00 y solaparía. Solo se verifica si el inicio del nuevo slot cae dentro del rango del evento existente.

### Deduplicación de clientes por teléfono
Antes de insertar un turno se busca si ya existe un cliente con ese teléfono y negocio_id. Si existe se reutiliza el id y se actualiza el nombre. La query usa `.single()` que devuelve 406 si no encuentra fila — esto es normal y el código lo maneja.

### Supabase client tolerante a build time
`lib/supabase.js` usa fallback `|| placeholder` en las vars para evitar crash durante el prerender de Next.js en Vercel.

### Timezone
`created_at` en el admin resta 3 hs hardcodeado (UTC-3). Las funciones de fecha del admin (`hoy()`, `inicioMes()`, `finMes()`) usan `toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' })` para obtener la fecha argentina correcta sin depender de la timezone del sistema.

---

## Variables de entorno

```bash
# Negocio (cuál config cargar)
NEXT_PUBLIC_NEGOCIO_ID=sim-turnos   # o prgrssv, lacancha, etc.

# Supabase (misma instancia para todos los negocios)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Twilio WhatsApp (server-side, sin NEXT_PUBLIC_)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=whatsapp:+XXXXXXXXXXXXXXX
TWILIO_TO_1=whatsapp:+549XXXXXXXXXX   # número principal admin
TWILIO_TO_2=whatsapp:+549XXXXXXXXXX   # número secundario admin (opcional)

# Content Template SIDs (Twilio Content Template Builder)
TWILIO_CONTENT_SID_CONFIRMACION_ADMIN=HX...
TWILIO_CONTENT_SID_CONFIRMACION_CLIENTE=HX...
TWILIO_CONTENT_SID_CANCELACION_ADMIN=HX...
TWILIO_CONTENT_SID_CANCELACION_CLIENTE=HX...

# Auth admin (server-side, sin NEXT_PUBLIC_, distinta por negocio en Vercel)
ADMIN_PASSWORD=...
```

---

## Estado actual WhatsApp / Twilio (2026-05-06)

| Negocio | TWILIO_FROM | Estado |
|---------|-------------|--------|
| `lacancha` | `whatsapp:+17015017795` | **Online** — Twilio Local US, funcionando |
| `sim-turnos` | `whatsapp:+17015017795` | **Online** — Twilio Local US, funcionando |
| `prgrssv` | `whatsapp:+17015017795` | **Online** — Twilio Local US, funcionando |

**Número activo:** +17015017795 (Twilio Local US, $1.15/mes). Display name: "Gestia" (en revisión por Meta).

**Dominio:** `reservaturnos.com.ar` comprado en Donweb, apuntado a Vercel proyecto lacancha. Meta Business aprobado.

**`route.ts` ya usa Content Templates** (migrado 2026-05-01). Variables de entorno `TWILIO_CONTENT_SID_*` cargadas en los tres proyectos de Vercel.

### Content Template SIDs activos

| Variable | SID | Template |
|----------|-----|----------|
| `TWILIO_CONTENT_SID_CONFIRMACION_ADMIN` | `HXd50fd5a318b9321942f16ad21cac50fe` | `copy_confirmacion_admin` |
| `TWILIO_CONTENT_SID_CONFIRMACION_CLIENTE` | `HX78cbecfbef0e7977710b9c22ea66e6d5` | `copy_confirmacion_cliente` |
| `TWILIO_CONTENT_SID_CANCELACION_ADMIN` | `HX0361b5bc48e5e73b8af78b1ed1b7d25f` | `copy_cancelacion_admin` |
| `TWILIO_CONTENT_SID_CANCELACION_CLIENTE` | `HXec0f51de4fb8e8f96fc92b875cfffeba` | `copy_cancelacion_cliente` |

### Historial

- Números +1 555... y +15559391060 descartados. Ver historial en commits anteriores.

---

## Features pendientes

- ~~**Historial de turnos en admin y mis-turnos**~~ — implementado el 2026-04-30. Toggle "Ver historial / Ocultar historial" en ambas páginas.
- ~~**Validación de nombre y apellido obligatorio en el flujo de reserva**~~ — implementado el 2026-05-03. Endpoint `/api/validar-reserva` valida formato nombre + apellido antes del insert.
- ~~**Límite de reservas por IP por día (configurable por negocio)**~~ — implementado el 2026-05-03. Feature `limiteReservasPorIP` en config, tabla `reservas_por_ip` en BD (migración pendiente).
- ~~**Verificación Google antes de confirmar reserva**~~ — implementado el 2026-05-05. Todos los negocios. El cliente hace login con Google OAuth antes de confirmar; el email verificado se guarda en `turnos.email_verificacion`. Admin muestra columna Email en la tabla de turnos.
- **`bgImage` configurable desde `NegocioConfig`** — prgrssv ya tiene imagen de fondo hardcodeada en `app/confirmado/page.tsx` (condicional por `negocio.id`), pendiente hacerla configurable desde config y extender a más páginas.
- **Límite de reservas por cliente** — campo `limites` en `NegocioConfig` con `maxTurnosActivos`, `maxRecursosMismaHora`, `maxTurnosPorDia`. Lógica por negocio: sim-turnos permite multi-recurso misma hora, lacancha no. (Distinto del límite por IP ya implementado.)
- **Recordatorio 1hs antes por WhatsApp** — requiere cron job, no puede dispararse desde el flujo de reserva.
- ~~**Turno manual desde admin**~~ — implementado el 2026-05-27. Desde la grilla Por día, click en slot libre permite cargar turno manual (nombre + teléfono opcional) que se guarda en `turnos` como turno real, o bloquear ese slot específico sin afectar slots siguientes.
- ~~**Sistema de slots publicados**~~ — implementado el 2026-06-09, refinado 2026-06-09. Solo `lacancha` (`features.slotsPublicados: true`). Admin publica slots desde la grilla (cian); sub-slots H+30/H+60 son `↳ publicado` (no clickeables). Click en publicado abre form con Turno ✓ / Bloquear / Despublicar / ✕. Al cargar turno manual o al confirmar reserva, se eliminan todos los slots_publicados que solapan (overlap bidireccional). POST de publicación limpia sub-slots stale en BD. Cliente filtra por hora exacta. Tabla: `slots_publicados`. Route: `/api/admin/publicar-slot`.

## Auth / Verificación de identidad

Implementado el 2026-05-05. Activo en los tres negocios.

En el último paso de `/reservar` (después de ingresar nombre y teléfono) se requiere verificar identidad con Google antes de poder confirmar. La sesión OAuth persiste en el browser — en visitas siguientes el usuario ya está verificado y confirma directo.

**Configuración Supabase Auth:**
- Provider: Google OAuth activado
- Callback URL: `https://smxxwdgmxvrvinfzxwan.supabase.co/auth/v1/callback`
- Site URL: `https://reservaturnos.com.ar`
- Redirect URLs permitidas: `https://lacancha.reservaturnos.com.ar/reservar`, `https://ochobbies.reservaturnos.com.ar/reservar`, `https://prgrssv.reservaturnos.com.ar/reservar`, `https://demo-padel-ten.vercel.app/reservar`, `http://localhost:3000/reservar`

**Google Cloud Console:**
- Proyecto: `reservaturnos` (ID: `reservaturnos-495400`)
- Client ID: `1035723225880-fo0gc84cn93aa1o7aekdbvgrm3q97ngc.apps.googleusercontent.com`
- Authorized redirect URI: `https://smxxwdgmxvrvinfzxwan.supabase.co/auth/v1/callback`

**Flujo:**
1. Cliente completa fecha / hora / cancha / nombre / teléfono
2. Aparece bloque "Verificación de identidad" con botón Google
3. OAuth redirect → Google → Supabase callback → vuelve a `/reservar`
4. El estado del formulario se preserva en `sessionStorage` antes del redirect y se restaura al volver
5. Email verificado se muestra con ✓ verde; se habilita el botón "Confirmar"
6. El email se guarda en `turnos.email_verificacion` al insertar

---

## Auth admin

Implementado el 2026-05-05. Reemplaza la validación client-side (contraseña en bundle JS) por un esquema server-side con cookie httpOnly.

**Flujo:**
1. Acceder a `/admin` sin sesión → middleware redirige a `/admin-login`
2. `/admin-login` envía `POST /api/admin-login` con la contraseña
3. El endpoint compara contra `process.env.ADMIN_PASSWORD` (nunca expuesta al cliente)
4. Si es correcta: setea cookie `admin_session` (httpOnly, valor = SHA-256 del password, 7 días)
5. Middleware verifica la cookie en cada request a `/admin/*`
6. Logout: `DELETE /api/admin-login` → limpia la cookie → redirige a `/admin-login`

**Archivos:**
- `middleware.ts` — intercepta `/admin` y `/admin/*`, verifica cookie
- `app/api/admin-login/route.ts` — POST (login) y DELETE (logout)
- `app/admin-login/page.tsx` — formulario de contraseña

**Variable de entorno:** `ADMIN_PASSWORD` — sin `NEXT_PUBLIC_`, distinta por negocio en Vercel. Agregar también a `.env.local` para desarrollo local.

**Nota:** la página de login está en `/admin-login` (no `/admin/login`) porque `app/admin/` tiene permisos de root en el sistema de archivos local. Funcionalmente idéntico.

**Fix cookie path (2026-05-19):** la cookie `admin_session` se emite con `path: '/'` (no `path: '/admin'`) para que el browser la envíe también en requests a `/api/admin/*`. Si hay sesiones activas previas al fix, hacer logout y login de nuevo.

---

## Anti-abuso

Implementado el 2026-05-03. Activo en los tres negocios.

- **Endpoint `/api/validar-reserva`** — POST server-side llamado antes del insert. Valida nombre, teléfono y límite por IP. La IP se lee del header `x-forwarded-for` (Vercel la inyecta automáticamente en producción). En local siempre es `127.0.0.1`, lo que hace que el límite se consuma rápido al testear — limpiar la tabla `reservas_por_ip` entre pruebas si es necesario.

  **Reglas del nombre:**
  - Entre 2 y 4 partes separadas por espacios simples (acepta "Juan Pérez", "Juan Marcos Pereyra", "María de los Ángeles")
  - Al menos 2 partes "reales" (no partículas): `de`, `del`, `la`, `las`, `los`, `el`, `y`, `da`, `do`, `dos` se omiten de las reglas de validación pero deben ser solo letras
  - Cada parte real: entre 3 y 15 letras
  - Solo letras con acentos (á é í ó ú ü ñ y mayúsculas), sin números ni símbolos
  - Cada parte real debe tener al menos una vocal
  - Cada parte real no puede ser toda la misma letra (ej: "aaa")
  - Blacklist case insensitive por parte real: `test`, `prueba`, `asd`, `asdf`, `xxx`, `admin`, `null`, `undefined`, `nombre`, `user`, `cliente`, `nobody`, `fake`, `anonymous`

  **Reglas del teléfono:**
  - Solo dígitos
  - Entre 10 y 11 caracteres (formato argentino, sin 0 ni 15)
- **Tabla `reservas_por_ip`** — registra cada reserva con `negocio_id`, `ip` y `created_at`. El conteo es por ventana deslizante de 24hs.
- **Config `limiteReservasPorIP`** — campo en `features` de `NegocioConfig`. Valores: `lacancha` = 2, `sim-turnos` = 4, `prgrssv` = 1. Si no está definido, el endpoint omite el chequeo de IP.

---

## Infraestructura pendiente

- ~~**WhatsApp Business API**~~ — resuelto el 2026-05-06. Los tres negocios usan `TWILIO_FROM=whatsapp:+17015017795` (Twilio Local US).
- ~~**Resolver WABA deshabilitada (lacancha)**~~ — resuelto el 2026-05-06. Número +15559391060 descartado, reemplazado por +17015017795.
- **Aprobar nombre "Gestia" en Meta** — display name en revisión por Meta. Pendiente aprobación final.
- **Mercado Pago / seña** — Checkout Pro, requiere monotributo.
- ~~**Auth admin server-side**~~ — implementado el 2026-05-05. `ADMIN_PASSWORD` en env var server-side, cookie httpOnly `admin_session`. Ver sección "Auth admin" abajo.
- ~~**RLS en Supabase**~~ — evaluado el 2026-05-07. Descartado por ahora: casi todo el acceso a BD es client-side con anon key, implementar RLS correctamente requeriría mover el admin a API routes server-side. Riesgo bajo dado el perfil del proyecto.
- ~~**Migración `reservas_por_ip`**~~ — ejecutada el 2026-05-03, tabla confirmada con datos en Supabase.
- **Timezone explícita en admin** — `created_at` resta 3hs hardcodeado (UTC-3).

## Bugs conocidos

- ~~**Bug admin**~~ — al borrar un turno desde vista tabla cambia a grilla. Resuelto al refactorizar modos.
- ~~**Constraint UNIQUE en turnos sin negocio_id**~~ — resuelto el 2026-04-30. Ver nota en sección `turnos` del esquema de BD.
- ~~**Lógica dentroDeVentana invertida en /cancelar/[token]**~~ — resuelto el 2026-05-19. La condición mostraba "contactar al local" cuando el turno ya había pasado en lugar de cuando se acercaba.
- ~~**Query a turnos sin negocio_id en /cancelar/[token]**~~ — resuelto el 2026-05-19. Faltaba `.eq('negocio_id', negocio.id)` en la query de carga del turno.
- ~~**Resumen admin mostraba 0 turnos**~~ — resuelto el 2026-05-26. Dos causas: (1) `hoy()` usaba UTC → después de las 21:00 ARG devolvía fecha incorrecta; (2) el Resumen solo consultaba `turnos` pero en lacancha los turnos se cargan como `slots_bloqueados` con motivo. Solución: timezone correcta en `hoy()`/`inicioMes()`/`finMes()`, y `fetchResumen` ahora combina ambas tablas.
- **Autocapitalización de nombre en reserva** — el input de nombre en `/reservar` autocapitaliza la primera letra de cada palabra al tipear. Implementado con `.replace(/(?:^|\s)\S/g, c => c.toUpperCase())` en el `onChange`.

---

## Activación Twilio sandbox (por número nuevo)

1. Desde el teléfono, mandar por WhatsApp al `+1 415 523 8886`: `join <palabra-del-sandbox>`
2. La palabra se encuentra en Twilio → Messaging → Try it out → Send a WhatsApp message
3. El número queda habilitado para recibir mensajes del sandbox indefinidamente

**Números de sim-turnos que todavía NO hicieron el join:**
- `+5492475410576`
- `+5492474442485`
