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
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(ddl_usuarios)
            cur.execute(ddl_pedidos)
            cur.execute("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagado BOOLEAN NOT NULL DEFAULT FALSE")
            cur.execute("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_entrega TEXT NOT NULL DEFAULT 'envio'")
            cur.execute("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id)")
        conn.commit()
    finally:
        conn.close()


def calcular_total(qty_locro, qty_batata, qty_membrillo):
    total_locro = qty_locro * PRECIO_LOCRO_UNITARIO
    total_unidades = qty_batata + qty_membrillo
    
    docenas = total_unidades // 12
    resto = total_unidades % 12
    medias = resto // 6
    unidades = resto % 6
    
    total_pastelitos = (docenas * PRECIO_PASTELITO_DOCENA) + \
                       (medias * PRECIO_PASTELITO_MEDIA_DOCENA) + \
                       (unidades * PRECIO_PASTELITO_UNIDAD)
                       
    return total_locro + total_pastelitos


def create_pedido(data):
    qty_locro     = int(data.get('cantidad_locro', 0))
    qty_batata    = int(data.get('cantidad_pastelito_batata', 0))
    qty_membrillo = int(data.get('cantidad_pastelito_membrillo', 0))
    monto_total   = calcular_total(qty_locro, qty_batata, qty_membrillo)

    pagado       = data.get('pagado') in (True, 'true', '1', 'on')
    tipo_entrega = data.get('tipo_entrega', 'envio')
    fecha_pedido = data.get('fecha_pedido', '').strip() or None
    usuario_id   = data.get('usuario_id')

    if fecha_pedido:
        sql = """
        INSERT INTO pedidos
            (nombre_cliente, telefono, email, direccion,
             cantidad_locro, cantidad_pastelito_batata, cantidad_pastelito_membrillo,
             medio_pago, monto_total, horario_entrega, notas, pagado, tipo_entrega, fecha_pedido, usuario_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
            data.get('notes', '').strip() or data.get('notas', '').strip() or None,
            pagado,
            tipo_entrega,
            fecha_pedido,
            usuario_id
        )
    else:
        sql = """
        INSERT INTO pedidos
            (nombre_cliente, telefono, email, direccion,
             cantidad_locro, cantidad_pastelito_batata, cantidad_pastelito_membrillo,
             medio_pago, monto_total, horario_entrega, notas, pagado, tipo_entrega, usuario_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
            data.get('notes', '').strip() or data.get('notas', '').strip() or None,
            pagado,
            tipo_entrega,
            usuario_id
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


def get_pedidos_by_usuario(user_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM pedidos WHERE usuario_id = %s ORDER BY fecha_pedido DESC", (user_id,))
            return [_row_to_dict(row, cur) for row in cur.fetchall()]
    finally:
        conn.close()


def update_pagado(pedido_id, pagado):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE pedidos SET pagado = %s, fecha_actualizacion = NOW() WHERE id = %s",
                (pagado, pedido_id)
            )
        conn.commit()
        return cur.rowcount > 0
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

    pagado       = data.get('pagado') in (True, 'true', '1', 'on')
    tipo_entrega = data.get('tipo_entrega', 'envio')
    fecha_pedido = data.get('fecha_pedido', '').strip() or None

    if fecha_pedido:
        sql = """
        UPDATE pedidos SET
            nombre_cliente = %s, telefono = %s, email = %s, direccion = %s,
            cantidad_locro = %s, cantidad_pastelito_batata = %s, cantidad_pastelito_membrillo = %s,
            medio_pago = %s, monto_total = %s, horario_entrega = %s, notas = %s,
            estado = %s, pagado = %s, tipo_entrega = %s, fecha_pedido = %s, fecha_actualizacion = NOW()
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
            pagado,
            tipo_entrega,
            fecha_pedido,
            pedido_id,
        )
    else:
        sql = """
        UPDATE pedidos SET
            nombre_cliente = %s, telefono = %s, email = %s, direccion = %s,
            cantidad_locro = %s, cantidad_pastelito_batata = %s, cantidad_pastelito_membrillo = %s,
            medio_pago = %s, monto_total = %s, horario_entrega = %s, notas = %s,
            estado = %s, pagado = %s, tipo_entrega = %s, fecha_actualizacion = NOW()
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
            pagado,
            tipo_entrega,
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
                    COALESCE(SUM(cantidad_locro), 0) as total_locro,
                    COALESCE(SUM(cantidad_pastelito_batata), 0) as total_batata,
                    COALESCE(SUM(cantidad_pastelito_membrillo), 0) as total_membrillo,
                    COALESCE(SUM(monto_total), 0) as recaudacion_total,
                    COALESCE(SUM(CASE WHEN pagado THEN monto_total ELSE 0 END), 0) as ingresos_totales,
                    COALESCE(SUM(CASE WHEN NOT pagado THEN monto_total ELSE 0 END), 0) as recaudacion_pendiente,
                    COUNT(*) as total_pedidos
                FROM pedidos
                {where_clause}
            """, params)
            totales = _row_to_dict(cur.fetchone(), cur)

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
            return {col: _serialize(val) for col, val in zip(cols, row)}
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

