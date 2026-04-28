# ── Configuración de precios ────────────────────────────────────────────────
# Locro: precio por porción individual y precio del combo de 2 porciones
PRECIO_LOCRO_UNITARIO = 10000   # ARS — 1 porción
PRECIO_LOCRO_COMBO    = 18000   # ARS — 2 porciones (descuento de $2.000)

# Pastelitos: mismo precio para batata y membrillo, la cantidad es en MEDIAS DOCENAS
PRECIO_PASTELITO_MEDIA_DOCENA = 4000  # ARS — 1 media docena (batata o membrillo)

# ── Estados válidos del pedido (en orden de flujo) ──────────────────────────
ESTADOS = ['Pendiente', 'En preparación', 'En envío', 'Entregado']

# ── Medios de pago válidos ───────────────────────────────────────────────────
MEDIOS_PAGO = ['efectivo', 'transferencia', 'tarjeta']
