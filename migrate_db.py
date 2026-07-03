import os
from models import get_db, init_db

def run_migration():
    init_db() # Ensure tables exist
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # 1. Ensure initial products exist
            cur.execute("SELECT id FROM productos WHERE nombre = 'Porción de Locro'")
            locro = cur.fetchone()
            if not locro:
                cur.execute("INSERT INTO productos (nombre, descripcion, precio, activo) VALUES ('Porción de Locro', 'Porción individual', 10000, true)")

            cur.execute("SELECT id FROM productos WHERE nombre = 'Porción de Locro'")
            locro_id = cur.fetchone()[0]

            cur.execute("SELECT id FROM productos WHERE nombre = 'Pastelitos de Batata'")
            if not cur.fetchone():
                cur.execute("INSERT INTO productos (nombre, descripcion, precio, activo) VALUES ('Pastelitos de Batata', 'Por unidad', 700, true)")
            cur.execute("SELECT id FROM productos WHERE nombre = 'Pastelitos de Batata'")
            batata_id = cur.fetchone()[0]

            cur.execute("SELECT id FROM productos WHERE nombre = 'Pastelitos de Membrillo'")
            if not cur.fetchone():
                cur.execute("INSERT INTO productos (nombre, descripcion, precio, activo) VALUES ('Pastelitos de Membrillo', 'Por unidad', 700, true)")
            cur.execute("SELECT id FROM productos WHERE nombre = 'Pastelitos de Membrillo'")
            membrillo_id = cur.fetchone()[0]

            # 2. Migrate existing orders
            cur.execute("SELECT id, cantidad_locro, cantidad_pastelito_batata, cantidad_pastelito_membrillo FROM pedidos")
            pedidos = cur.fetchall()

            for p in pedidos:
                p_id = p[0]
                q_locro = p[1]
                q_batata = p[2]
                q_membrillo = p[3]

                # Check if already migrated
                cur.execute("SELECT count(*) FROM pedido_items WHERE pedido_id = %s", (p_id,))
                if cur.fetchone()[0] == 0:
                    if q_locro > 0:
                        cur.execute("INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario) VALUES (%s, %s, %s, %s)", (p_id, locro_id, q_locro, 10000))
                    if q_batata > 0:
                        cur.execute("INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario) VALUES (%s, %s, %s, %s)", (p_id, batata_id, q_batata, 700))
                    if q_membrillo > 0:
                        cur.execute("INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario) VALUES (%s, %s, %s, %s)", (p_id, membrillo_id, q_membrillo, 700))

        conn.commit()
        print("Migración completada exitosamente.")
    except Exception as e:
        print("Error en migración:", e)
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    run_migration()
