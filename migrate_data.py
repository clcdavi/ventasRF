import os
import urllib.request
import json
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def migrate():
    url = "https://ventasrf.onrender.com/api/pedidos"
    print(f"1. Obteniendo datos desde {url}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            pedidos = json.loads(response.read().decode())
        print(f"   ¡Éxito! Se encontraron {len(pedidos)} pedidos en Render.")
    except Exception as e:
        print(f"   Error al obtener los datos: {e}")
        return

    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("   Error: DATABASE_URL no encontrada en el entorno.")
        return

    print("2. Conectando a la base de datos de Oracle Cloud...")
    try:
        conn = psycopg2.connect(db_url)
        with conn.cursor() as cur:
            sql = """
            INSERT INTO pedidos (
                id, fecha_pedido, nombre_cliente, telefono, email, direccion,
                cantidad_locro, cantidad_pastelito_batata, cantidad_pastelito_membrillo,
                medio_pago, monto_total, horario_entrega, notas, estado, pagado, tipo_entrega, fecha_actualizacion
            ) VALUES (
                %(id)s, %(fecha_pedido)s, %(nombre_cliente)s, %(telefono)s, %(email)s, %(direccion)s,
                %(cantidad_locro)s, %(cantidad_pastelito_batata)s, %(cantidad_pastelito_membrillo)s,
                %(medio_pago)s, %(monto_total)s, %(horario_entrega)s, %(notas)s, %(estado)s, %(pagado)s, %(tipo_entrega)s, %(fecha_actualizacion)s
            )
            ON CONFLICT (id) DO UPDATE SET
                fecha_pedido = EXCLUDED.fecha_pedido,
                nombre_cliente = EXCLUDED.nombre_cliente,
                telefono = EXCLUDED.telefono,
                email = EXCLUDED.email,
                direccion = EXCLUDED.direccion,
                cantidad_locro = EXCLUDED.cantidad_locro,
                cantidad_pastelito_batata = EXCLUDED.cantidad_pastelito_batata,
                cantidad_pastelito_membrillo = EXCLUDED.cantidad_pastelito_membrillo,
                medio_pago = EXCLUDED.medio_pago,
                monto_total = EXCLUDED.monto_total,
                horario_entrega = EXCLUDED.horario_entrega,
                notas = EXCLUDED.notas,
                estado = EXCLUDED.estado,
                pagado = EXCLUDED.pagado,
                tipo_entrega = EXCLUDED.tipo_entrega,
                fecha_actualizacion = EXCLUDED.fecha_actualizacion
            """
            
            print("3. Insertando/Actualizando pedidos en la nueva base de datos...")
            for p in pedidos:
                cur.execute(sql, p)
            
            # Sincronizar el secuenciador de IDs en PostgreSQL
            cur.execute("SELECT setval(pg_get_serial_sequence('pedidos', 'id'), coalesce(max(id), 1)) FROM pedidos")
            
        conn.commit()
        print("   ¡Migración completada con éxito en Oracle Cloud!")
    except Exception as e:
        print(f"   Error durante la migración: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
