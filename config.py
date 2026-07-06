# ── Configuración de precios ────────────────────────────────────────────────
# Locro: precio por porción individual
PRECIO_LOCRO_UNITARIO = 10000   # ARS — 1 porción

# Pastelitos:
PRECIO_PASTELITO_DOCENA = 8000
PRECIO_PASTELITO_MEDIA_DOCENA = 4000
PRECIO_PASTELITO_UNIDAD = 700

# ── Estados válidos del pedido (en orden de flujo) ──────────────────────────
ESTADOS = ['Pendiente', 'En preparación', 'En envío', 'Entregado']

# ── Medios de pago válidos ───────────────────────────────────────────────────
MEDIOS_PAGO = ['efectivo', 'transferencia']

import os

# ── Código secreto de registro para Admin ────────────────────────────────────
CODIGO_ADMIN = os.environ.get('CODIGO_ADMIN')
