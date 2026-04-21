# ventasRF

Sistema de gestión de pedidos para la venta de locro y pastelitos el 1ro de mayo.

## Stack

- **Backend:** Python + Flask
- **Base de datos:** PostgreSQL (Render) / SQLite (local)
- **Frontend:** HTML / CSS / Vanilla JS
- **Deploy:** Render (web service + PostgreSQL free tier)

## Instalación

```bash
pip install -r requirements.txt
```

Crear un archivo `.env` con la variable de conexión a la base de datos:

```
DATABASE_URL=postgresql://usuario:password@host:5432/nombre_db
```

## Uso local

```bash
TZ=America/Argentina/Buenos_Aires python3 app.py
```

Abrir en el navegador: http://localhost:8080

## Precios

| Producto | Precio |
|---|---|
| Locro (porción) | $12.000 |
| Combo 2 locros | $20.000 |
| Pastelitos (cada 6 unidades = 1 media docena) | $4.000 |

## Funcionalidades

- Cargar nuevos pedidos con datos del cliente, productos y medio de pago
- Pastelitos por unidad con mezcla de sabores (batata / membrillo) — precio cada 6 unidades
- Dashboard con tabla de pedidos, filtros por estado / pago / fecha y estadísticas
- Cambio de estado por pedido: Pendiente → En preparación → En envío → Entregado
- Estado de pago independiente (Pagado / Pendiente) por pedido
- Edición completa de cualquier pedido
- Eliminación de pedidos en estado Pendiente
- Exportar pedidos a Excel con filtros aplicados (incluye columna Pagado)
- Fechas de pedido visibles en la tabla del dashboard
