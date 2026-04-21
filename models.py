import os
import psycopg2
import psycopg2.extras
from datetime import datetime
from config import (ESTADOS, MEDIOS_PAGO,
                    PRECIO_LOCRO_UNITARIO, PRECIO_LOCRO_COMBO,
                    PRECIO_PASTELITO_DOCENA)


def get_db():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    with conn.cursor() as cur:
        cur.execute("SET TIME ZONE 'America/Argentina/Buenos_Aires'")
    return conn


def _serialize(val):
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d %H:%M:%S')
    return val


def _row_to_dict(row, cursor):
    cols = [desc[0] for desc in cursor.description]
    return {col: _serialize(val) for col, val in zip(cols, row)}


def init_db():
    ddl = """
    CREATE TABLE IF NOT EXISTS pedidos (
        id                           SERIAL PRIMARY KEY,
        fecha_pedido                 TIMESTAMP NOT NULL DEFAULT NOW(),
        nombre_cliente               TEXT NOT NULL,
        telefono                     TEXT NOT NULL,
        email                        TEXT,
        direccion                    TEXT NOT NULL,
        cantidad_locro               INTEGER NOT NULL DEFAULT 0,
        cantidad_pastelito_batata    INTEGER NOT NULL DEFAULT 0,
        cantidad_pastelito_membrillo INTEGER NOT NULL DEFAULT 0,
        medio_pago                   TEXT NOT NULL,
        monto_total                  REAL NOT NULL,
        horario_entrega              TEXT,
        notas                        TEXT,
        estado                       TEXT NOT NULL DEFAULT 'Pendiente',
        fecha_actualizacion          TIMESTAMP NOT NULL DEFAULT NOW()
    );
    """
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(ddl)
        conn.commit()
    finally:
        conn.close()


def calcular_total(qty_locro, qty_batata, qty_membrillo):
    total_locro = (qty_locro // 2) * PRECIO_LOCRO_COMBO + (qty_locro % 2) * PRECIO_LOCRO_UNITARIO
    total_pastelitos = (qty_batata + qty_membrillo) * PRECIO_PASTELITO_DOCENA
    return total_locro + total_pastelitos


def create_pedido(data):
    qty_locro     = int(data.get('cantidad_locro', 0))
    qty_batata    = int(data.get('cantidad_pastelito_batata', 0))
    qty_membrillo = int(data.get('cantidad_pastelito_membrillo', 0))
    monto_total   = calcular_total(qty_locro, qty_batata, qty_membrillo)

    sql = """
    INSERT INTO pedidos
        (nombre_cliente, telefono, email, direccion,
         cantidad_locro, cantidad_pastelito_batata, cantidad_pastelito_membrillo,
         medio_pago, monto_total, horario_entrega, notas)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id
    """
    params = (
        data['nombre_cliente'].strip(),
        data['telefono'].strip(),
        data.get('email', '').strip() or None,
        data['direccion'].strip(),
        qty_locro, qty_batata, qty_membrillo,
        data['medio_pago'],
        monto_total,
        data.get('horario_entrega', '').strip() or None,
        data.get('notas', '').strip() or None,
    )
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            pedido_id = cur.fetchone()[0]
        conn.commit()
        return pedido_id, monto_total
    finally:
        conn.close()


def get_all_pedidos(estado=None, medio_pago=None, fecha=None):
    sql = "SELECT * FROM pedidos WHERE 1=1"
    params = []
    if estado:
        sql += " AND estado = %s"
        params.append(estado)
    if medio_pago:
        sql += " AND medio_pago = %s"
        params.append(medio_pago)
    if fecha:
        sql += " AND fecha_pedido::date = %s"
        params.append(fecha)
    sql += " ORDER BY fecha_pedido DESC"
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return [_row_to_dict(row, cur) for row in cur.fetchall()]
    finally:
        conn.close()


def get_pedido_by_id(pedido_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM pedidos WHERE id = %s", (pedido_id,))
            row = cur.fetchone()
            return _row_to_dict(row, cur) if row else None
    finally:
        conn.close()


def update_estado(pedido_id, nuevo_estado):
    if nuevo_estado not in ESTADOS:
        raise ValueError(f"Estado inválido: {nuevo_estado}")
    sql = """
    UPDATE pedidos
    SET estado = %s, fecha_actualizacion = NOW()
    WHERE id = %s
    """
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (nuevo_estado, pedido_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def update_pedido(pedido_id, data):
    qty_locro     = int(data.get('cantidad_locro', 0))
    qty_batata    = int(data.get('cantidad_pastelito_batata', 0))
    qty_membrillo = int(data.get('cantidad_pastelito_membrillo', 0))
    monto_total   = calcular_total(qty_locro, qty_batata, qty_membrillo)

    sql = """
    UPDATE pedidos SET
        nombre_cliente = %s, telefono = %s, email = %s, direccion = %s,
        cantidad_locro = %s, cantidad_pastelito_batata = %s, cantidad_pastelito_membrillo = %s,
        medio_pago = %s, monto_total = %s, horario_entrega = %s, notas = %s,
        estado = %s, fecha_actualizacion = NOW()
    WHERE id = %s
    """
    params = (
        data['nombre_cliente'].strip(),
        data['telefono'].strip(),
        data.get('email', '').strip() or None,
        data['direccion'].strip(),
        qty_locro, qty_batata, qty_membrillo,
        data['medio_pago'],
        monto_total,
        data.get('horario_entrega', '').strip() or None,
        data.get('notas', '').strip() or None,
        data['estado'],
        pedido_id,
    )
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
        return cur.rowcount > 0, monto_total
    finally:
        conn.close()


def delete_pedido(pedido_id):
    pedido = get_pedido_by_id(pedido_id)
    if not pedido:
        return False, 'not_found'
    if pedido['estado'] != 'Pendiente':
        return False, 'not_pending'
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM pedidos WHERE id = %s", (pedido_id,))
        conn.commit()
    finally:
        conn.close()
    return True, None


def get_stats():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COALESCE(SUM(cantidad_locro), 0) as total_locro,
                    COALESCE(SUM(cantidad_pastelito_batata), 0) as total_batata,
                    COALESCE(SUM(cantidad_pastelito_membrillo), 0) as total_membrillo,
                    COALESCE(SUM(monto_total), 0) as ingresos_totales,
                    COUNT(*) as total_pedidos
                FROM pedidos
            """)
            totales = _row_to_dict(cur.fetchone(), cur)

            cur.execute("""
                SELECT medio_pago, COALESCE(SUM(monto_total), 0) as total
                FROM pedidos GROUP BY medio_pago
            """)
            ingresos_pago = {row[0]: row[1] for row in cur.fetchall()}

            cur.execute("""
                SELECT estado, COUNT(*) as cantidad
                FROM pedidos GROUP BY estado
            """)
            por_estado = {row[0]: row[1] for row in cur.fetchall()}

    finally:
        conn.close()

    return {
        **totales,
        'ingresos_por_pago': ingresos_pago,
        'por_estado': por_estado,
    }
