# ventasRF

Sistema de gestión de pedidos para la venta de locro y pastelitos el 1ro de mayo.

## Stack

- **Backend:** Python + Flask
- **Base de datos:** PostgreSQL (Render) / local con `.env`
- **Frontend:** HTML / CSS / Vanilla JS
- **Deploy:** Render (web service + PostgreSQL free tier)

## Instalación

```bash
pip install -r requirements.txt
```

Crear un archivo `.env` con la variable de conexión:

```
DATABASE_URL=postgresql://usuario:password@host:5432/nombre_db
```

## Uso local

```bash
TZ=America/Argentina/Buenos_Aires python3 app.py
```

Abrir en el navegador: http://localhost:8080

## Deploy (Render)

La app está disponible en: https://ventasrf.onrender.com

El deploy se actualiza automáticamente con cada push a `main`.

## Precios

| Producto | Precio |
|---|---|
| Locro (porción) | $10.000 |
| Combo 2 locros | $18.000 |
| Pastelitos (cada 6 unidades = 1 media docena) | $4.000 |

## Funcionalidades

- Cargar nuevos pedidos con datos del cliente, productos y medio de pago
- Pastelitos por unidad con mezcla de sabores (batata / membrillo) — precio cada 6 unidades
- Tipo de entrega por pedido: 🛵 Envío a domicilio / ⛪ Retiro en iglesia
- Notas especiales visibles directamente en la tabla del dashboard
- Dashboard sin scroll: tabla con scroll interno, stats colapsables con botón 📊
- Tarjeta **Cobrado** que suma solo los pedidos marcados como pagados
- Cambio de estado por pedido: Pendiente → En preparación → En envío → Entregado
- Estado de pago independiente (Pagado / Pendiente) con actualización inmediata
- Filtros por estado, medio de pago y fecha
- Edición completa de cualquier pedido
- Eliminación de pedidos en estado Pendiente
- Exportar pedidos a Excel con filtros aplicados (incluye tipo entrega y estado de pago)
- Fechas de pedido visibles en la tabla
