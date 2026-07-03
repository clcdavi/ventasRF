import re

with open('models.py', 'r') as f:
    content = f.read()

# Borrar la vieja create_pedido y update_pedido y las relacionadas (calcular_total)
# y borrar todo hasta delete_pedido
content = re.sub(r'def calcular_total\(.*?\n\ndef delete_pedido', 'def delete_pedido', content, flags=re.DOTALL)
content = re.sub(r'def get_all_pedidos\(.*?\n\ndef update_pagado', 'def update_pagado', content, flags=re.DOTALL)

NEW_FUNCTIONS = """
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
    sql = \"\"\"
    INSERT INTO productos (nombre, descripcion, precio, activo)
    VALUES (%s, %s, %s, %s)
    \"\"\"
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
    sql = \"\"\"
    UPDATE productos SET
        nombre = %s, descripcion = %s, precio = %s, activo = %s
    WHERE id = %s
    \"\"\"
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


# ── PEDIDOS Y ITEMS ──────────────────────────────────────────────────────────

def _attach_items_to_pedidos(pedidos, conn):
    if not pedidos:
        return pedidos
    pedido_ids = [p['id'] for p in pedidos]
    placeholders = ','.join(['%s'] * len(pedido_ids))
    with conn.cursor() as cur:
        # Fetch items with product details
        cur.execute(f\"\"\"
            SELECT pi.*, p.nombre as producto_nombre 
            FROM pedido_items pi
            JOIN productos p ON pi.producto_id = p.id
            WHERE pi.pedido_id IN ({placeholders})
        \"\"\", tuple(pedido_ids))
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
                sql = \"\"\"
                INSERT INTO pedidos
                    (nombre_cliente, telefono, email, direccion,
                     medio_pago, monto_total, horario_entrega, notas, pagado, tipo_entrega, fecha_pedido, usuario_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                \"\"\"
                params = (
                    data['nombre_cliente'].strip(), data['telefono'].strip(),
                    data.get('email', '').strip() or None, data['direccion'].strip(),
                    data['medio_pago'], monto_total,
                    data.get('horario_entrega', '').strip() or None,
                    data.get('notas', data.get('notes', '')).strip() or None,
                    pagado, tipo_entrega, fecha_pedido, usuario_id
                )
            else:
                sql = \"\"\"
                INSERT INTO pedidos
                    (nombre_cliente, telefono, email, direccion,
                     medio_pago, monto_total, horario_entrega, notas, pagado, tipo_entrega, usuario_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                \"\"\"
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
                sql = \"\"\"
                UPDATE pedidos SET
                    nombre_cliente = %s, telefono = %s, email = %s, direccion = %s,
                    medio_pago = %s, monto_total = %s, horario_entrega = %s, notas = %s,
                    estado = %s, pagado = %s, tipo_entrega = %s, fecha_pedido = %s, fecha_actualizacion = NOW()
                WHERE id = %s
                \"\"\"
                params = (
                    data['nombre_cliente'].strip(), data['telefono'].strip(),
                    data.get('email', '').strip() or None, data['direccion'].strip(),
                    data['medio_pago'], monto_total,
                    data.get('horario_entrega', '').strip() or None,
                    data.get('notas', data.get('notes', '')).strip() or None,
                    data['estado'], pagado, tipo_entrega, fecha_pedido, pedido_id
                )
            else:
                sql = \"\"\"
                UPDATE pedidos SET
                    nombre_cliente = %s, telefono = %s, email = %s, direccion = %s,
                    medio_pago = %s, monto_total = %s, horario_entrega = %s, notas = %s,
                    estado = %s, pagado = %s, tipo_entrega = %s, fecha_actualizacion = NOW()
                WHERE id = %s
                \"\"\"
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

"""
content = content.replace('def delete_pedido(pedido_id):', NEW_FUNCTIONS + '\ndef delete_pedido(pedido_id):')

with open('models.py', 'w') as f:
    f.write(content)
print("Done")
