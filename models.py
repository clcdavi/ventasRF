import sqlite3
from config import (DATABASE_PATH, ESTADOS, MEDIOS_PAGO,
                    PRECIO_LOCRO_UNITARIO, PRECIO_LOCRO_COMBO,
                    PRECIO_PASTELITO_DOCENA)


def get_db():
    """Devuelve una conexión SQLite con row_factory para acceso por nombre de columna."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Crea la tabla pedidos si no existe."""
    ddl = """
    CREATE TABLE IF NOT EXISTS pedidos (
        id                           INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_pedido                 TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
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
        fecha_actualizacion          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    """
    with get_db() as conn:
        conn.execute(ddl)
        conn.commit()


def calcular_total(qty_locro, qty_batata, qty_membrillo):
    """Calcula el monto total aplicando el combo de 2 locros y precio por docena de pastelitos."""
    total_locro = (qty_locro // 2) * PRECIO_LOCRO_COMBO + (qty_locro % 2) * PRECIO_LOCRO_UNITARIO
    total_pastelitos = (qty_batata + qty_membrillo) * PRECIO_PASTELITO_DOCENA
    return total_locro + total_pastelitos


def create_pedido(data):
    """
    Inserta un nuevo pedido. Recalcula monto_total en el servidor.
    data: dict con campos del formulario.
    Retorna el id del nuevo pedido.
    """
    qty_locro    = int(data.get('cantidad_locro', 0))
    qty_batata   = int(data.get('cantidad_pastelito_batata', 0))
    qty_membrillo = int(data.get('cantidad_pastelito_membrillo', 0))
    monto_total  = calcular_total(qty_locro, qty_batata, qty_membrillo)

    sql = """
    INSERT INTO pedidos
        (nombre_cliente, telefono, email, direccion,
         cantidad_locro, cantidad_pastelito_batata, cantidad_pastelito_membrillo,
         medio_pago, monto_total, horario_entrega, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    with get_db() as conn:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid, monto_total


def get_all_pedidos(estado=None, medio_pago=None, fecha=None):
    """Devuelve lista de pedidos con filtros opcionales."""
    sql = "SELECT * FROM pedidos WHERE 1=1"
    params = []
    if estado:
        sql += " AND estado = ?"
        params.append(estado)
    if medio_pago:
        sql += " AND medio_pago = ?"
        params.append(medio_pago)
    if fecha:
        sql += " AND DATE(fecha_pedido) = ?"
        params.append(fecha)
    sql += " ORDER BY fecha_pedido DESC"
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]


def get_pedido_by_id(pedido_id):
    """Devuelve un pedido por id, o None si no existe."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM pedidos WHERE id = ?", (pedido_id,)).fetchone()
        return dict(row) if row else None


def update_estado(pedido_id, nuevo_estado):
    """Actualiza solo el estado del pedido. Retorna True si actualizó, False si no existe."""
    if nuevo_estado not in ESTADOS:
        raise ValueError(f"Estado inválido: {nuevo_estado}")
    sql = """
    UPDATE pedidos
    SET estado = ?, fecha_actualizacion = datetime('now', 'localtime')
    WHERE id = ?
    """
    with get_db() as conn:
        cur = conn.execute(sql, (nuevo_estado, pedido_id))
        conn.commit()
        return cur.rowcount > 0


def update_pedido(pedido_id, data):
    """Actualiza todos los campos editables de un pedido. Recalcula monto_total."""
    qty_locro     = int(data.get('cantidad_locro', 0))
    qty_batata    = int(data.get('cantidad_pastelito_batata', 0))
    qty_membrillo = int(data.get('cantidad_pastelito_membrillo', 0))
    monto_total   = calcular_total(qty_locro, qty_batata, qty_membrillo)

    sql = """
    UPDATE pedidos SET
        nombre_cliente = ?, telefono = ?, email = ?, direccion = ?,
        cantidad_locro = ?, cantidad_pastelito_batata = ?, cantidad_pastelito_membrillo = ?,
        medio_pago = ?, monto_total = ?, horario_entrega = ?, notas = ?,
        estado = ?, fecha_actualizacion = datetime('now', 'localtime')
    WHERE id = ?
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
    with get_db() as conn:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.rowcount > 0, monto_total


def delete_pedido(pedido_id):
    """
    Elimina un pedido. Solo permite si estado == 'Pendiente'.
    Retorna (True, None) si eliminó, (False, 'motivo') si no.
    """
    pedido = get_pedido_by_id(pedido_id)
    if not pedido:
        return False, 'not_found'
    if pedido['estado'] != 'Pendiente':
        return False, 'not_pending'
    with get_db() as conn:
        conn.execute("DELETE FROM pedidos WHERE id = ?", (pedido_id,))
        conn.commit()
    return True, None


def get_stats():
    """Devuelve estadísticas agregadas: unidades por producto, ingresos por medio de pago, conteo por estado."""
    with get_db() as conn:
        # Totales de cantidades y monto global
        row = conn.execute("""
            SELECT
                COALESCE(SUM(cantidad_locro), 0) as total_locro,
                COALESCE(SUM(cantidad_pastelito_batata), 0) as total_batata,
                COALESCE(SUM(cantidad_pastelito_membrillo), 0) as total_membrillo,
                COALESCE(SUM(monto_total), 0) as ingresos_totales,
                COUNT(*) as total_pedidos
            FROM pedidos
        """).fetchone()
        totales = dict(row)

        # Ingresos por medio de pago
        rows = conn.execute("""
            SELECT medio_pago, COALESCE(SUM(monto_total), 0) as total
            FROM pedidos GROUP BY medio_pago
        """).fetchall()
        ingresos_pago = {r['medio_pago']: r['total'] for r in rows}

        # Conteo por estado
        rows = conn.execute("""
            SELECT estado, COUNT(*) as cantidad
            FROM pedidos GROUP BY estado
        """).fetchall()
        por_estado = {r['estado']: r['cantidad'] for r in rows}

    return {
        **totales,
        'ingresos_por_pago': ingresos_pago,
        'por_estado': por_estado,
    }
