# ventasRF

Sistema de gestión de pedidos para la venta de locro y pastelitos el 1ro de mayo.

## Stack

- **Backend:** Python + Flask
- **Base de datos:** SQLite
- **Frontend:** HTML / CSS / Vanilla JS

## Instalación

```bash
pip install -r requirements.txt
```

## Uso

```bash
TZ=America/Argentina/Buenos_Aires python3 app.py
```

Abrir en el navegador: http://localhost:8080

## Precios

| Producto | Precio |
|---|---|
| Locro (porción) | $12.000 |
| Combo 2 locros | $20.000 |
| Pastelitos batata o membrillo | $8.000 la docena |

## Funcionalidades

- Cargar nuevos pedidos con datos del cliente, productos y medio de pago
- Dashboard con tabla de pedidos, filtros y estadísticas
- Cambio de estado por pedido (Pendiente → En preparación → En envío → Entregado)
- Edición completa de cualquier pedido
- Eliminación de pedidos en estado Pendiente
- Exportar pedidos a Excel (con filtros aplicados)
