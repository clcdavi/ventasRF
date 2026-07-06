import os
import sqlite3
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Config
SQLITE_DB = 'ventasrf.db'
POSTGRES_URL = os.environ.get('DATABASE_URL')
if POSTGRES_URL and POSTGRES_URL.startswith('postgres://'):
    POSTGRES_URL = POSTGRES_URL.replace('postgres://', 'postgresql://', 1)

def migrate():
    if not POSTGRES_URL:
        print("DATABASE_URL no está configurada. No se puede migrar a Postgres.")
        return

    print("Conectando a SQLite...")
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    print(f"Conectando a Postgres... ({POSTGRES_URL})")
    pg_conn = psycopg2.connect(POSTGRES_URL)
    pg_cur = pg_conn.cursor()

    try:
        # Migrar Usuarios
        print("Migrando Usuarios...")
        sqlite_cur.execute("SELECT id, nombre, email, password_hash, rol, telefono, direccion, created_at FROM usuarios")
        usuarios = sqlite_cur.fetchall()
        for u in usuarios:
            pg_cur.execute("""
                INSERT INTO usuarios (id, nombre, email, password_hash, rol, telefono, direccion, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
            """, tuple(u))
        
        # Sincronizar secuencia de IDs de usuarios
        pg_cur.execute("SELECT setval(pg_get_serial_sequence('usuarios', 'id'), COALESCE((SELECT MAX(id) FROM usuarios), 1));")

        # Migrar Productos
        print("Migrando Productos...")
        sqlite_cur.execute("SELECT id, nombre, descripcion, precio, activo, created_at FROM productos")
        productos = sqlite_cur.fetchall()
        for p in productos:
            pg_cur.execute("""
                INSERT INTO productos (id, nombre, descripcion, precio, activo, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
            """, tuple(p))
            
        pg_cur.execute("SELECT setval(pg_get_serial_sequence('productos', 'id'), COALESCE((SELECT MAX(id) FROM productos), 1));")

        # Migrar Pedidos
        print("Migrando Pedidos...")
        # Note: Not selecting legacy columns (cantidad_locro, etc)
        sqlite_cur.execute("""
            SELECT id, fecha_pedido, nombre_cliente, telefono, email, direccion, medio_pago, 
                   monto_total, horario_entrega, notas, estado, pagado, tipo_entrega, 
                   repartidor, usuario_id, fecha_actualizacion 
            FROM pedidos
        """)
        pedidos = sqlite_cur.fetchall()
        for ped in pedidos:
            pg_cur.execute("""
                INSERT INTO pedidos (id, fecha_pedido, nombre_cliente, telefono, email, direccion, 
                                     medio_pago, monto_total, horario_entrega, notas, estado, 
                                     pagado, tipo_entrega, repartidor, usuario_id, fecha_actualizacion)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
            """, tuple(ped))
            
        pg_cur.execute("SELECT setval(pg_get_serial_sequence('pedidos', 'id'), COALESCE((SELECT MAX(id) FROM pedidos), 1));")

        # Migrar PedidoItems
        print("Migrando PedidoItems...")
        sqlite_cur.execute("SELECT id, pedido_id, producto_id, cantidad, precio_unitario FROM pedido_items")
        items = sqlite_cur.fetchall()
        for item in items:
            pg_cur.execute("""
                INSERT INTO pedido_items (id, pedido_id, producto_id, cantidad, precio_unitario)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
            """, tuple(item))
            
        pg_cur.execute("SELECT setval(pg_get_serial_sequence('pedido_items', 'id'), COALESCE((SELECT MAX(id) FROM pedido_items), 1));")

        pg_conn.commit()
        print("¡Migración completada exitosamente!")

    except Exception as e:
        pg_conn.rollback()
        print(f"Error durante la migración: {e}")
    finally:
        sqlite_conn.close()
        pg_conn.close()

if __name__ == "__main__":
    migrate()
