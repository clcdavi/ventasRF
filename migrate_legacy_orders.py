from models import get_db

def migrate():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # Seleccionar pedidos que tengan cantidades antiguas y no tengan items
            cur.execute("""
                SELECT id, cantidad_locro, cantidad_pastelito_batata, cantidad_pastelito_membrillo 
                FROM pedidos
                WHERE NOT EXISTS (
                    SELECT 1 FROM pedido_items WHERE pedido_id = pedidos.id
                )
            """)
            pedidos = cur.fetchall()
            
            for ped in pedidos:
                p_id = ped[0]
                locro = ped[1]
                batata = ped[2]
                membrillo = ped[3]
                
                # Para Locro (id=1)
                if locro and locro > 0:
                    cur.execute("SELECT precio FROM productos WHERE id = 1")
                    precio = cur.fetchone()[0]
                    cur.execute("INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario) VALUES (%s, %s, %s, %s)", (p_id, 1, locro, precio))
                
                # Para Batata (id=2)
                if batata and batata > 0:
                    cur.execute("SELECT precio FROM productos WHERE id = 2")
                    precio = cur.fetchone()[0]
                    cur.execute("INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario) VALUES (%s, %s, %s, %s)", (p_id, 2, batata, precio))
                    
                # Para Membrillo (id=3)
                if membrillo and membrillo > 0:
                    cur.execute("SELECT precio FROM productos WHERE id = 3")
                    precio = cur.fetchone()[0]
                    cur.execute("INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario) VALUES (%s, %s, %s, %s)", (p_id, 3, membrillo, precio))
                    
        conn.commit()
        print(f"Migrated {len(pedidos)} legacy orders to pedido_items.")
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
