#!/bin/bash

# Smoke test: levanta el servidor para cada negocio y verifica las rutas críticas.
# Uso: bash scripts/check.sh
# Salida: exit 0 si todo OK, exit 1 si alguna ruta falla.

NEGOCIOS=("sim-turnos" "prgrssv" "lacancha")
RUTAS=("/" "/reservar" "/admin" "/mis-turnos")
PORT=3000
TOTAL_OK=0
TOTAL_ROTO=0

# ── helpers ──────────────────────────────────────────────────────────────────

matar_servidor() {
  local pid
  pid=$(lsof -ti:$PORT 2>/dev/null)
  [ -n "$pid" ] && kill "$pid" 2>/dev/null && sleep 1
}

esperar_servidor() {
  local intentos=0
  until curl -s "http://localhost:$PORT" > /dev/null 2>&1; do
    sleep 1
    intentos=$((intentos + 1))
    if [ "$intentos" -ge 30 ]; then
      return 1
    fi
  done
}

# ── main ─────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")/.." || exit 1

for negocio in "${NEGOCIOS[@]}"; do
  echo ""
  echo "▸ $negocio"

  matar_servidor

  NEXT_PUBLIC_NEGOCIO_ID="$negocio" npm run dev > "/tmp/check-$negocio.log" 2>&1 &
  SERVER_PID=$!

  if ! esperar_servidor; then
    echo "  [ROTO] servidor no arrancó — ver /tmp/check-$negocio.log"
    TOTAL_ROTO=$((TOTAL_ROTO + ${#RUTAS[@]}))
    kill "$SERVER_PID" 2>/dev/null
    continue
  fi

  for ruta in "${RUTAS[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$ruta")
    if [ "$status" = "200" ] || [ "$status" = "307" ]; then
      echo "  [OK]   $ruta"
      TOTAL_OK=$((TOTAL_OK + 1))
    else
      echo "  [ROTO] $ruta  (HTTP $status)"
      TOTAL_ROTO=$((TOTAL_ROTO + 1))
    fi
  done

  matar_servidor
done

# ── resumen ───────────────────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────"
TOTAL=$((TOTAL_OK + TOTAL_ROTO))
echo "  $TOTAL_OK / $TOTAL rutas OK"
[ "$TOTAL_ROTO" -gt 0 ] && echo "  $TOTAL_ROTO ROTA(S)" && echo "────────────────────────────────" && exit 1
echo "  Todo OK"
echo "────────────────────────────────"
