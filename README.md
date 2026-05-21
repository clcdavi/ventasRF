# ventasRF

Sistema de gestión de pedidos para la venta de locro y pastelitos (eventos del 1ro de Mayo, 25 de Mayo, etc.).

## Stack

- **Backend:** Python + Flask
- **Base de datos:** PostgreSQL
- **Frontend:** HTML / CSS / Vanilla JS
- **Contenedores:** Docker & Docker Compose
- **Deploy:** Servidor en la nube (Oracle Cloud VM / OCI)

---

## Uso Local (Sin Docker)

1. Instalar las dependencias de Python:
   ```bash
   pip install -r requirements.txt
   ```

2. Crear un archivo `.env` en la raíz del proyecto con la variable de conexión de PostgreSQL:
   ```env
   DATABASE_URL=postgresql://usuario:password@host:5432/nombre_db
   ```

3. Ejecutar la aplicación:
   ```bash
   TZ=America/Argentina/Buenos_Aires python3 app.py
   ```
   Abrir en el navegador: `http://localhost:8080`

---

## Deploy y Ejecución con Docker Compose (Oracle Cloud)

El proyecto está dockerizado para facilitar su puesta en marcha en servidores privados (VPS/VM) como Oracle Cloud.

1. Clonar el repositorio en la máquina virtual:
   ```bash
   git clone https://github.com/clcdavi/ventasRF.git
   cd ventasRF
   ```

2. Crear el archivo `.env` con las variables de base de datos deseadas:
   ```env
   DB_USER=usuario
   DB_PASSWORD=password
   DB_NAME=ventasrf
   ```

3. Levantar los servicios (Base de datos PostgreSQL + Servidor Web Flask):
   ```bash
   docker-compose up -d --build
   ```
   La aplicación se expondrá en el puerto configurado (por defecto `8081`). Puedes acceder en: `http://<IP_DE_TU_VM>:8081`.

---

## Migración de Datos desde Render

Si tienes pedidos registrados en la plataforma antigua de Render y quieres transferirlos a tu base de datos nueva en Oracle Cloud, puedes hacerlo de forma automática ejecutando el script de migración dentro del contenedor web:

```bash
docker-compose exec web python migrate_data.py
```

Este script traerá todos los pedidos antiguos desde el endpoint de Render e importará/actualizará en el PostgreSQL local de forma segura (haciendo un *UPSERT* para evitar duplicados).

---

## Precios del Menú

| Producto | Detalle | Precio |
|---|---|---|
| **Locro** | Porción individual | $10.000 |
| **Pastelitos** | 1 unidad | $700 /u |
| **Pastelitos (½ Docena)** | 6 unidades | $4.000 |
| **Pastelitos (Docena)** | 12 unidades | $8.000 |


---

## Funcionalidades Clave

- **Fecha de pedido personalizable:** Al registrar o editar un pedido, puedes elegir para qué día está programado (por defecto se preselecciona el **25 de Mayo** para facilitar el cargado rápido).
- **Dashboard inteligente:**
  - Se abre por defecto filtrando los pedidos programados para el **25 de Mayo**.
  - Permite limpiar filtros con el botón **✕ Limpiar** para ver las ventas históricas de otros eventos (como el 1ro de Mayo).
  - Interfaz compacta de **9 columnas** que evita la necesidad de hacer scroll de lado en pantallas estándar.
  - Estadísticas colapsables (porciones de locro, docenas de pastelitos, ingresos por medio de pago).
- **Control de entrega:** Tipo de entrega por pedido (🛵 Envío a domicilio con horario preferido / ⛪ Retiro en iglesia).
- **Gestión de Cobro y Estado:** 
  - Cambio rápido del estado del pedido (Pendiente → En preparación → En envío → Entregado).
  - Marcado de pago independiente con actualización instantánea (Cobrado / No cobrado).
- **Exportación:** Descarga de pedidos directamente a archivos de Excel según los filtros aplicados en el Dashboard.
