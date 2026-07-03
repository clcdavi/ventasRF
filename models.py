import os
import psycopg2
from datetime import datetime
from config import (ESTADOS, MEDIOS_PAGO,
                    PRECIO_LOCRO_UNITARIO, PRECIO_PASTELITO_DOCENA,
                    PRECIO_PASTELITO_MEDIA_DOCENA, PRECIO_PASTELITO_UNIDAD)

import sqlite3
import re

class SQLiteCursorWrapper:
    def __init__(self, sqlite_cursor):
        self.cur = sqlite_cursor

    def execute(self, sql, params=None):
        # Translate Postgres SQL to SQLite
        sql = sql.replace('%s', '?')
        sql = sql.replace('ILIKE', 'LIKE')
        sql = sql.replace('NOW()', "(datetime('now', 'localtime'))")
        # Replace date cast: fecha_pedido::date = ? -> date(fecha_pedido) = ?
        sql = re.sub(r'([\w\.]+)::date\b', r'date(\1)', sql)
        # Replace SERIAL with INTEGER PRIMARY KEY AUTOINCREMENT in CREATE TABLE
        sql = sql.replace('SERIAL PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT')
        # Remove IF NOT EXISTS from ADD COLUMN clauses (SQLite syntax)
        sql = re.sub(r'ADD COLUMN\s+IF\s+NOT\s+EXISTS\b', 'ADD COLUMN', sql, flags=re.IGNORECASE)
        try:
            if params is not None:
                self.cur.execute(sql, params)
            else:
                self.cur.execute(sql)
        except Exception as e:
            # If it's ALTER TABLE ADD COLUMN and column already exists, ignore
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                pass
            else:
                raise e

    def fetchone(self):
        return self.cur.fetchone()

    def fetchall(self):
        return self.cur.fetchall()

    @property
    def description(self):
        return self.cur.description

    @property
    def rowcount(self):
        return self.cur.rowcount

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cur.close()

class SQLiteConnectionWrapper:
    def __init__(self, sqlite_conn):
        self.conn = sqlite_conn

    def cursor(self):
        return SQLiteCursorWrapper(self.conn.cursor())

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()


def get_db():
    db_url = os.environ.get('DATABASE_URL')
    if db_url:
        conn = psycopg2.connect(db_url)
        with conn.cursor() as cur:
            cur.execute("SET TIME ZONE 'America/Argentina/Buenos_Aires'")
        return conn
    else:
        # Fallback to local SQLite database
        conn = sqlite3.connect('ventasRF.db')
        return SQLiteConnectionWrapper(conn)


def _serialize(val):
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d %H:%M:%S')
    return val


def _row_to_dict(row, cursor):
    cols = [desc[0] for desc in cursor.description]
    return {col: _serialize(val) for col, val in zip(cols, row)}


def init_db():
    ddl_pedidos = """
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
        pagado                       BOOLEAN NOT NULL DEFAULT FALSE,
        tipo_entrega                 TEXT NOT NULL DEFAULT 'envio',
        usuario_id                   INTEGER REFERENCES usuarios(id),
        fecha_actualizacion          TIMESTAMP NOT NULL DEFAULT NOW()
    );
    """
    ddl_usuarios = """
    CREATE TABLE IF NOT EXISTS usuarios (
        id                           SERIAL PRIMARY KEY,
        nombre                       TEXT NOT NULL,
        email                        TEXT NOT NULL UNIQUE,
        password_hash                TEXT NOT NULL,
        rol                          TEXT NOT NULL DEFAULT 'user',
        created_at                   TIMESTAMP NOT NULL DEFAULT NOW()
    );
    """
    ddl_productos = """
    CREATE TABLE IF NOT EXISTS productos (
        id                           SERIAL PRIMARY KEY,
        nombre                       TEXT NOT NULL,
        descripcion                  TEXT,
        precio                       REAL NOT NULL,
        activo                       BOOLEAN NOT NULL DEFAULT TRUE,
        created_at                   TIMESTAMP NOT NULL DEFAULT NOW()
    );
    """
    ddl_pedido_items = """
    CREATE TABLE IF NOT EXISTS pedido_items (
        id                           SERIAL PRIMARY KEY,
        pedido_id                    INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        producto_id                  INTEGER NOT NULL REFERENCES productos(id),
        cantidad                     INTEGER NOT NULL,
        precio_unitario              REAL NOT NULL
    );
    """
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(ddl_usuarios)
            cur.execute(ddl_productos)
            cur.execute(ddl_pedidos)
            cur.execute(ddl_pedido_items)
            cur.execute("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagado BOOLEAN NOT NULL DEFAULT FALSE")
            cur.execute("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_entrega TEXT NOT NULL DEFAULT 'envio'")
            cur.execute("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id)")
        conn.commit()
    finally:
        conn.close()



# ── PRODUCTOS ────────────────────────────────────────────────────────────────

def get_productos(solo_activos=False):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if solo_activos:
                cur.execute("SELECT * FROM productos WHERE activo = TRUE ORDER BY id ASC")
            else:
                cur.execute("SELECT * FROM productos ORDER BY id ASC")
            return [_row_to_dict(row, cur) for row in cur.fetchall()]
    finally:
        conn.close()

def get_producto_by_id(prod_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM productos WHERE id = %s", (prod_id,))
            row = cur.fetchone()
            return _row_to_dict(row, cur) if row else None
    finally:
        conn.close()

def create_producto(data):
    sql = """
    INSERT INTO productos (nombre, descripcion, precio, activo)
    VALUES (%s, %s, %s, %s)
    """
    params = (
        data['nombre'].strip(),
        data.get('descripcion', '').strip() or None,
        float(data['precio']),
        data.get('activo') in (True, 'true', 1, '1')
    )
    conn = get_db()
    try:
        with conn.cursor() as cur:
            is_sqlite = 'SQLiteConnectionWrapper' in str(type(conn))
            if is_sqlite:
                cur.execute(sql, params)
                cur.execute("SELECT last_insert_rowid()")
                p_id = cur.fetchone()[0]
            else:
                sql += " RETURNING id"
                cur.execute(sql, params)
                p_id = cur.fetchone()[0]
        conn.commit()
        return p_id
    finally:
        conn.close()

def update_producto(prod_id, data):
    sql = """
    UPDATE productos SET
        nombre = %s, descripcion = %s, precio = %s, activo = %s
    WHERE id = %s
    """
    params = (
        data['nombre'].strip(),
        data.get('descripcion', '').strip() or None,
        float(data['precio']),
        data.get('activo') in (True, 'true', 1, '1'),
        prod_id
    )
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()

def delete_producto(prod_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM productos WHERE id = %s", (prod_id,))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_fechas_pedidos():
    sql = "SELECT DISTINCT fecha_pedido::date as fecha FROM pedidos ORDER BY fecha DESC"
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
            fechas = []
            for r in rows:
                f = r[0]
                if f:
                    if hasattr(f, 'strftime'):
                        fechas.append(f.strftime('%Y-%m-%d'))
                    else:
                        fechas.append(str(f).split(' ')[0])
            return fechas
    finally:
        conn.close()


# ── PEDIDOS Y ITEMS ──────────────────────────────────────────────────────────

def _attach_items_to_pedidos(pedidos, conn):
    if not pedidos:
        return pedidos
    pedido_ids = [p['id'] for p in pedidos]
    placeholders = ','.join(['%s'] * len(pedido_ids))
    with conn.cursor() as cur:
        # Fetch items with product details
        cur.execute(f"""
            SELECT pi.*, p.nombre as producto_nombre 
            FROM pedido_items pi
            JOIN productos p ON pi.producto_id = p.id
            WHERE pi.pedido_id IN ({placeholders})
        """, tuple(pedido_ids))
        items_rows = cur.fetchall()
        items = [_row_to_dict(row, cur) for row in items_rows]
    
    # Map items to pedidos
    items_by_pedido = {}
    for item in items:
        p_id = item['pedido_id']
        if p_id not in items_by_pedido:
            items_by_pedido[p_id] = []
        items_by_pedido[p_id].append(item)
        
    for p in pedidos:
        p['items'] = items_by_pedido.get(p['id'], [])
    return pedidos

def get_all_pedidos(estado=None, medio_pago=None, fecha=None, busqueda=None, tipo_entrega=None):
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
    if tipo_entrega:
        sql += " AND tipo_entrega = %s"
        params.append(tipo_entrega)
    if busqueda:
        sql += " AND (id::text = %s OR nombre_cliente ILIKE %s)"
        params.append(busqueda.strip())
        params.append(f"%{busqueda.strip()}%")
    sql += " ORDER BY fecha_pedido DESC"
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            pedidos = [_row_to_dict(row, cur) for row in cur.fetchall()]
        return _attach_items_to_pedidos(pedidos, conn)
    finally:
        conn.close()

def get_pedido_by_id(pedido_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM pedidos WHERE id = %s", (pedido_id,))
            row = cur.fetchone()
            if not row: return None
            pedido = _row_to_dict(row, cur)
        return _attach_items_to_pedidos([pedido], conn)[0]
    finally:
        conn.close()

def get_pedidos_by_usuario(user_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM pedidos WHERE usuario_id = %s ORDER BY fecha_pedido DESC", (user_id,))
            pedidos = [_row_to_dict(row, cur) for row in cur.fetchall()]
        return _attach_items_to_pedidos(pedidos, conn)
    finally:
        conn.close()

def create_pedido(data):
    pagado       = data.get('pagado') in (True, 'true', 1, '1', 'on')
    tipo_entrega = data.get('tipo_entrega', 'envio')
    fecha_pedido = data.get('fecha_pedido', '').strip() or None
    usuario_id   = data.get('usuario_id')
    items        = data.get('items', [])
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # Calcular total consultando precios en BD
            monto_total = 0.0
            processed_items = []
            for it in items:
                cur.execute("SELECT precio FROM productos WHERE id = %s", (it['producto_id'],))
                res = cur.fetchone()
                if res:
                    precio = res[0]
                    cantidad = int(it['cantidad'])
                    monto_total += precio * cantidad
                    processed_items.append((it['producto_id'], cantidad, precio))
                    
            if fecha_pedido:
                sql = """
                INSERT INTO pedidos
                    (nombre_cliente, telefono, email, direccion,
                     medio_pago, monto_total, horario_entrega, notas, pagado, tipo_entrega, fecha_pedido, usuario_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                params = (
                    data['nombre_cliente'].strip(), data['telefono'].strip(),
                    data.get('email', '').strip() or None, data['direccion'].strip(),
                    data['medio_pago'], monto_total,
                    data.get('horario_entrega', '').strip() or None,
                    data.get('notas', data.get('notes', '')).strip() or None,
                    pagado, tipo_entrega, fecha_pedido, usuario_id
                )
            else:
                sql = """
                INSERT INTO pedidos
                    (nombre_cliente, telefono, email, direccion,
                     medio_pago, monto_total, horario_entrega, notas, pagado, tipo_entrega, usuario_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                params = (
                    data['nombre_cliente'].strip(), data['telefono'].strip(),
                    data.get('email', '').strip() or None, data['direccion'].strip(),
                    data['medio_pago'], monto_total,
                    data.get('horario_entrega', '').strip() or None,
                    data.get('notas', data.get('notes', '')).strip() or None,
                    pagado, tipo_entrega, usuario_id
                )

            is_sqlite = 'SQLiteConnectionWrapper' in str(type(conn))
            if is_sqlite:
                cur.execute(sql, params)
                cur.execute("SELECT last_insert_rowid()")
                pedido_id = cur.fetchone()[0]
            else:
                sql += " RETURNING id"
                cur.execute(sql, params)
                pedido_id = cur.fetchone()[0]

            for p_id, cant, prec in processed_items:
                if cant > 0:
                    cur.execute(
                        "INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario) VALUES (%s, %s, %s, %s)",
                        (pedido_id, p_id, cant, prec)
                    )
        conn.commit()
        return pedido_id, monto_total
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def update_pedido(pedido_id, data):
    pagado       = data.get('pagado') in (True, 'true', 1, '1', 'on')
    tipo_entrega = data.get('tipo_entrega', 'envio')
    fecha_pedido = data.get('fecha_pedido', '').strip() or None
    items        = data.get('items', [])
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            monto_total = 0.0
            processed_items = []
            for it in items:
                cur.execute("SELECT precio FROM productos WHERE id = %s", (it['producto_id'],))
                res = cur.fetchone()
                if res:
                    precio = res[0]
                    cantidad = int(it['cantidad'])
                    monto_total += precio * cantidad
                    processed_items.append((it['producto_id'], cantidad, precio))

            if fecha_pedido:
                sql = """
                UPDATE pedidos SET
                    nombre_cliente = %s, telefono = %s, email = %s, direccion = %s,
                    medio_pago = %s, monto_total = %s, horario_entrega = %s, notas = %s,
                    estado = %s, pagado = %s, tipo_entrega = %s, fecha_pedido = %s, fecha_actualizacion = NOW()
                WHERE id = %s
                """
                params = (
                    data['nombre_cliente'].strip(), data['telefono'].strip(),
                    data.get('email', '').strip() or None, data['direccion'].strip(),
                    data['medio_pago'], monto_total,
                    data.get('horario_entrega', '').strip() or None,
                    data.get('notas', data.get('notes', '')).strip() or None,
                    data['estado'], pagado, tipo_entrega, fecha_pedido, pedido_id
                )
            else:
                sql = """
                UPDATE pedidos SET
                    nombre_cliente = %s, telefono = %s, email = %s, direccion = %s,
                    medio_pago = %s, monto_total = %s, horario_entrega = %s, notas = %s,
                    estado = %s, pagado = %s, tipo_entrega = %s, fecha_actualizacion = NOW()
                WHERE id = %s
                """
                params = (
                    data['nombre_cliente'].strip(), data['telefono'].strip(),
                    data.get('email', '').strip() or None, data['direccion'].strip(),
                    data['medio_pago'], monto_total,
                    data.get('horario_entrega', '').strip() or None,
                    data.get('notas', data.get('notes', '')).strip() or None,
                    data['estado'], pagado, tipo_entrega, pedido_id
                )
            
            cur.execute(sql, params)
            
            # Recrear items
            cur.execute("DELETE FROM pedido_items WHERE pedido_id = %s", (pedido_id,))
            for p_id, cant, prec in processed_items:
                if cant > 0:
                    cur.execute(
                        "INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario) VALUES (%s, %s, %s, %s)",
                        (pedido_id, p_id, cant, prec)
                    )
                    
        conn.commit()
        return True, monto_total
    except Exception as e:
        conn.rollback()
        raise e
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


def get_stats(fecha=None):
    conn = get_db()
    
    where_clause = ""
    params = []
    if fecha:
        where_clause = "WHERE fecha_pedido::date = %s"
        params.append(fecha)

    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT
                    COALESCE(SUM(monto_total), 0) as recaudacion_total,
                    COALESCE(SUM(CASE WHEN pagado THEN monto_total ELSE 0 END), 0) as ingresos_totales,
                    COALESCE(SUM(CASE WHEN NOT pagado THEN monto_total ELSE 0 END), 0) as recaudacion_pendiente,
                    COUNT(*) as total_pedidos
                FROM pedidos
                {where_clause}
            """, params)
            totales = _row_to_dict(cur.fetchone(), cur)

            if fecha:
                cur.execute("""
                    SELECT p.nombre, COALESCE(SUM(filtered_items.cantidad), 0) as cantidad
                    FROM productos p
                    LEFT JOIN (
                        SELECT pi.producto_id, pi.cantidad
                        FROM pedido_items pi
                        JOIN pedidos ped ON pi.pedido_id = ped.id
                        WHERE ped.fecha_pedido::date = %s
                    ) filtered_items ON p.id = filtered_items.producto_id
                    GROUP BY p.nombre
                """, (fecha,))
            else:
                cur.execute("""
                    SELECT p.nombre, COALESCE(SUM(pi.cantidad), 0) as cantidad
                    FROM productos p
                    LEFT JOIN pedido_items pi ON p.id = pi.producto_id
                    GROUP BY p.nombre
                """)
            por_producto = {row[0]: row[1] for row in cur.fetchall()}

            cur.execute(f"""
                SELECT medio_pago, COALESCE(SUM(monto_total), 0) as total
                FROM pedidos
                {where_clause}
                GROUP BY medio_pago
            """, params)
            ingresos_pago = {row[0]: row[1] for row in cur.fetchall()}

            cur.execute(f"""
                SELECT estado, COUNT(*) as cantidad
                FROM pedidos
                {where_clause}
                GROUP BY estado
            """, params)
            por_estado = {row[0]: row[1] for row in cur.fetchall()}

    finally:
        conn.close()

    return {
        **totales,
        'recaudacion_cobrada': totales.get('ingresos_totales', 0),
        'ingresos_por_pago': ingresos_pago,
        'por_medio_pago': ingresos_pago,
        'por_estado': por_estado,
        'por_producto': por_producto
    }


def get_contactos(fecha=None):
    sql = """
    SELECT 
        nombre_cliente, 
        telefono,
        (SELECT email FROM pedidos p2 WHERE p2.nombre_cliente = p.nombre_cliente AND p2.telefono = p.telefono ORDER BY fecha_pedido DESC LIMIT 1) as email,
        (SELECT direccion FROM pedidos p2 WHERE p2.nombre_cliente = p.nombre_cliente AND p2.telefono = p.telefono ORDER BY fecha_pedido DESC LIMIT 1) as direccion,
        COUNT(*) as total_pedidos,
        SUM(monto_total) as gasto_total,
        MAX(fecha_pedido) as ultimo_pedido
    FROM pedidos p
    WHERE 1=1
    """
    params = []
    if fecha:
        sql += " AND EXISTS (SELECT 1 FROM pedidos p3 WHERE p3.nombre_cliente = p.nombre_cliente AND p3.telefono = p.telefono AND p3.fecha_pedido::date = %s)"
        params.append(fecha)
    
    sql += " GROUP BY nombre_cliente, telefono ORDER BY nombre_cliente ASC"
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return [_row_to_dict(row, cur) for row in cur.fetchall()]
    finally:
        conn.close()


def get_historial_contacto(nombre_cliente, telefono):
    sql = """
    SELECT * FROM pedidos 
    WHERE nombre_cliente = %s AND telefono = %s 
    ORDER BY fecha_pedido DESC
    """
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (nombre_cliente, telefono))
            return [_row_to_dict(row, cur) for row in cur.fetchall()]
    finally:
        conn.close()


def create_usuario(nombre, email, password_hash, rol='user'):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            is_sqlite = 'SQLiteConnectionWrapper' in str(type(conn))
            
            if is_sqlite:
                sql = """
                INSERT INTO usuarios (nombre, email, password_hash, rol)
                VALUES (%s, %s, %s, %s)
                """
                cur.execute(sql, (nombre, email, password_hash, rol))
                cur.execute("SELECT last_insert_rowid()")
                user_id = cur.fetchone()[0]
                cur.execute("SELECT id, nombre, email, rol, created_at FROM usuarios WHERE id = %s", (user_id,))
                row = cur.fetchone()
            else:
                sql = """
                INSERT INTO usuarios (nombre, email, password_hash, rol)
                VALUES (%s, %s, %s, %s)
                RETURNING id, nombre, email, rol, created_at
                """
                cur.execute(sql, (nombre, email, password_hash, rol))
                row = cur.fetchone()
                
            cols = ['id', 'nombre', 'email', 'rol', 'created_at']
            result = {col: _serialize(val) for col, val in zip(cols, row)}
        conn.commit()
        return result
    finally:
        conn.close()


def get_usuario_by_email(email):
    sql = "SELECT id, nombre, email, password_hash, rol, created_at FROM usuarios WHERE email = %s"
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (email,))
            row = cur.fetchone()
            if not row:
                return None
            cols = ['id', 'nombre', 'email', 'password_hash', 'rol', 'created_at']
            return {col: _serialize(val) for col, val in zip(cols, row)}
    finally:
        conn.close()


def get_usuario_by_id(user_id):
    sql = "SELECT id, nombre, email, rol, created_at FROM usuarios WHERE id = %s"
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (user_id,))
            row = cur.fetchone()
            if not row:
                return None
            cols = ['id', 'nombre', 'email', 'rol', 'created_at']
            return {col: _serialize(val) for col, val in zip(cols, row)}
    finally:
        conn.close()


def update_usuario_rol(user_id, nuevo_rol):
    """Actualiza el rol de un usuario existente."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE usuarios SET rol = %s WHERE id = %s",
                (nuevo_rol, user_id)
            )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()

