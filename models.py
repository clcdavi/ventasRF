from datetime import datetime
import bleach
from sqlalchemy import func, or_, case, literal_column
from db import db, Usuario, Producto, Pedido, PedidoItem
from config import ESTADOS, MEDIOS_PAGO, PRECIO_LOCRO_UNITARIO, PRECIO_PASTELITO_DOCENA, PRECIO_PASTELITO_MEDIA_DOCENA, PRECIO_PASTELITO_UNIDAD

# Función auxiliar para serializar
def _serialize(val):
    if isinstance(val, datetime):
        return val.isoformat()
    return val

def _row_to_dict(row, keys):
    if not row:
        return None
    return {k: _serialize(v) for k, v in zip(keys, row)}

def _model_to_dict(obj):
    if not obj:
        return None
    d = {}
    for column in obj.__table__.columns:
        val = getattr(obj, column.name)
        d[column.name] = _serialize(val)
    return d

def _pedido_to_dict(p):
    if not p:
        return None
    d = _model_to_dict(p)
    d['items'] = []
    for item in p.items:
        item_d = _model_to_dict(item)
        if item.producto:
            item_d['producto_nombre'] = item.producto.nombre
        d['items'].append(item_d)
    return d

def init_db():
    # Alembic handles the creation now.
    pass

# ── PRODUCTOS ────────────────────────────────────────────────────────────────
def get_productos(solo_activos=False):
    query = Producto.query
    if solo_activos:
        query = query.filter_by(activo=True)
    productos = query.all()
    return [_model_to_dict(p) for p in productos]

def get_producto_by_id(prod_id):
    p = Producto.query.get(prod_id)
    return _model_to_dict(p)

def create_producto(data):
    p = Producto(
        nombre=data['nombre'],
        descripcion=data.get('descripcion'),
        precio=data['precio'],
        activo=data.get('activo', True)
    )
    db.session.add(p)
    db.session.commit()
    return _model_to_dict(p)

def update_producto(prod_id, data):
    p = Producto.query.get(prod_id)
    if not p:
        return False
    if 'nombre' in data: p.nombre = data['nombre']
    if 'descripcion' in data: p.descripcion = data['descripcion']
    if 'precio' in data: p.precio = data['precio']
    if 'activo' in data: p.activo = data['activo']
    db.session.commit()
    return True

def delete_producto(prod_id):
    p = Producto.query.get(prod_id)
    if not p:
        return False
    # Soft delete (make inactive) since orders may depend on it
    p.activo = False
    db.session.commit()
    return True

# ── PEDIDOS ──────────────────────────────────────────────────────────────────
def get_fechas_pedidos():
    # Return distinct dates of orders
    query = db.session.query(func.date(Pedido.fecha_pedido).label('fecha'))\
        .group_by(func.date(Pedido.fecha_pedido))\
        .order_by(func.date(Pedido.fecha_pedido).desc())
    return [row.fecha for row in query.all()]

def get_all_pedidos(estado=None, medio_pago=None, fecha=None, busqueda=None, tipo_entrega=None, pagado=None, usuario_id_filtro=None, page=None, limit=30):
    query = Pedido.query
    if estado:
        query = query.filter_by(estado=estado)
    if medio_pago:
        query = query.filter_by(medio_pago=medio_pago)
    if pagado is not None:
        query = query.filter_by(pagado=pagado)
    if tipo_entrega:
        query = query.filter_by(tipo_entrega=tipo_entrega)
    if usuario_id_filtro is not None:
        query = query.filter_by(usuario_id=usuario_id_filtro)
    if fecha:
        # SQLite vs Postgres: we can just filter by func.date
        query = query.filter(func.date(Pedido.fecha_pedido) == fecha)
    if busqueda:
        busqueda_like = f"%{busqueda}%"
        query = query.filter(
            or_(
                Pedido.nombre_cliente.ilike(busqueda_like),
                Pedido.telefono.ilike(busqueda_like)
            )
        )
    
    if not fecha:
        from datetime import date
        today_str = date.today().isoformat()
        is_today = case((func.date(Pedido.fecha_pedido) == today_str, 1), else_=2)
        is_pending = case((Pedido.estado == 'Pendiente', 1), else_=2)
        query = query.order_by(is_today, is_pending, Pedido.fecha_pedido.desc())
    else:
        query = query.order_by(Pedido.fecha_pedido.desc())
        
    if page is not None and limit is not None:
        pagination = query.paginate(page=page, per_page=limit, error_out=False)
        return {
            'data': [_pedido_to_dict(p) for p in pagination.items],
            'total': pagination.total,
            'page': pagination.page,
            'pages': pagination.pages
        }
    else:
        return [_pedido_to_dict(p) for p in query.all()]

def get_pedido_by_id(pedido_id):
    p = Pedido.query.get(pedido_id)
    return _pedido_to_dict(p)

def get_pedidos_by_usuario(usuario_id):
    pedidos = Pedido.query.filter_by(usuario_id=usuario_id).order_by(Pedido.fecha_pedido.desc()).all()
    return [_pedido_to_dict(p) for p in pedidos]

def create_pedido(data):
    monto_total = 0.0
    items = data.get('items', [])
    processed_items = []
    
    for item in items:
        prod = Producto.query.get(item['producto_id'])
        if prod:
            precio_unitario = prod.precio
            monto_total += precio_unitario * item['cantidad']
            processed_items.append({
                'producto_id': item['producto_id'],
                'cantidad': item['cantidad'],
                'precio_unitario': precio_unitario
            })

    fecha_pedido_str = data.get('fecha_pedido')
    fecha_pedido_obj = datetime.utcnow()
    if fecha_pedido_str:
        try:
            if len(fecha_pedido_str) == 10:
                fecha_pedido_obj = datetime.strptime(fecha_pedido_str, "%Y-%m-%d")
            else:
                fecha_pedido_obj = datetime.fromisoformat(fecha_pedido_str.replace("Z", "+00:00"))
        except ValueError:
            pass

    nuevo_pedido = Pedido(
        fecha_pedido=fecha_pedido_obj,
        nombre_cliente=bleach.clean(data['nombre_cliente']),
        telefono=bleach.clean(data['telefono']),
        email=bleach.clean(data.get('email', '')),
        direccion=bleach.clean(data['direccion']),
        medio_pago=bleach.clean(data['medio_pago']),
        monto_total=monto_total,
        horario_entrega=bleach.clean(data.get('horario_entrega', '')),
        notas=bleach.clean(data.get('notas', '')),
        estado='Pendiente',
        pagado=data.get('pagado', False),
        tipo_entrega=bleach.clean(data.get('tipo_entrega', 'envio')),
        repartidor=bleach.clean(data.get('repartidor', '')) if data.get('repartidor') else None,
        usuario_id=data.get('usuario_id')
    )
    
    db.session.add(nuevo_pedido)
    db.session.flush() # get the id
    
    for item in processed_items:
        pi = PedidoItem(
            pedido_id=nuevo_pedido.id,
            producto_id=item['producto_id'],
            cantidad=item['cantidad'],
            precio_unitario=item['precio_unitario']
        )
        db.session.add(pi)
        
    db.session.commit()
    return nuevo_pedido.id, monto_total

def update_pedido(pedido_id, data):
    p = Pedido.query.get(pedido_id)
    if not p:
        return False, None
        
    monto_total = 0.0
    items = data.get('items', [])
    processed_items = []
    
    for item in items:
        prod = Producto.query.get(item['producto_id'])
        if prod:
            precio_unitario = prod.precio
            monto_total += precio_unitario * item['cantidad']
            processed_items.append({
                'producto_id': item['producto_id'],
                'cantidad': item['cantidad'],
                'precio_unitario': precio_unitario
            })
        
    p.nombre_cliente = bleach.clean(data.get('nombre_cliente', p.nombre_cliente))
    p.telefono = bleach.clean(data.get('telefono', p.telefono))
    p.email = bleach.clean(data.get('email', p.email or ''))
    
    fecha_pedido_str = data.get('fecha_pedido')
    if fecha_pedido_str:
        try:
            if len(fecha_pedido_str) == 10:
                p.fecha_pedido = datetime.strptime(fecha_pedido_str, "%Y-%m-%d")
            else:
                p.fecha_pedido = datetime.fromisoformat(fecha_pedido_str.replace("Z", "+00:00"))
        except ValueError:
            pass

    new_direccion = bleach.clean(data.get('direccion', p.direccion))
    if new_direccion != p.direccion:
        p.direccion = new_direccion
        p.direccion_editada = True
        
    p.medio_pago = bleach.clean(data.get('medio_pago', p.medio_pago))
    p.horario_entrega = bleach.clean(data.get('horario_entrega', p.horario_entrega or ''))
    p.notas = bleach.clean(data.get('notas', p.notas or ''))
    p.tipo_entrega = bleach.clean(data.get('tipo_entrega', p.tipo_entrega))
    if 'repartidor' in data:
        p.repartidor = bleach.clean(data['repartidor'])
    p.monto_total = monto_total
    
    # Delete old items
    PedidoItem.query.filter_by(pedido_id=p.id).delete()
    
    # Add new items
    for item in processed_items:
        pi = PedidoItem(
            pedido_id=p.id,
            producto_id=item['producto_id'],
            cantidad=item['cantidad'],
            precio_unitario=item['precio_unitario']
        )
        db.session.add(pi)
        
    db.session.commit()
    return True, monto_total

def update_estado(pedido_id, estado):
    if estado not in ESTADOS:
        raise ValueError(f"Estado inválido: {estado}")
    p = Pedido.query.get(pedido_id)
    if not p:
        return False
    p.estado = estado
    db.session.commit()
    return True

def update_pagado(pedido_id, pagado):
    p = Pedido.query.get(pedido_id)
    if not p:
        return False
    p.pagado = pagado
    db.session.commit()
    return True

def update_repartidor(pedido_id, repartidor):
    p = Pedido.query.get(pedido_id)
    if not p:
        return False
    p.repartidor = repartidor
    db.session.commit()
    return True

def delete_pedido(pedido_id):
    p = Pedido.query.get(pedido_id)
    if not p:
        return False, 'not_found'
    
    db.session.delete(p)
    db.session.commit()
    return True, None

def get_stats(fecha=None):
    query = Pedido.query
    if fecha:
        query = query.filter(func.date(Pedido.fecha_pedido) == fecha)
    
    # Totales
    stats_query = db.session.query(
        func.coalesce(func.sum(Pedido.monto_total), 0).label('recaudacion_total'),
        func.coalesce(func.sum(case((Pedido.pagado == True, Pedido.monto_total), else_=0)), 0).label('ingresos_totales'),
        func.coalesce(func.sum(case((Pedido.pagado == False, Pedido.monto_total), else_=0)), 0).label('recaudacion_pendiente'),
        func.count().label('total_pedidos')
    )
    if fecha:
        stats_query = stats_query.filter(func.date(Pedido.fecha_pedido) == fecha)
    
    totales_res = stats_query.first()
    totales = _row_to_dict(totales_res, ['recaudacion_total', 'ingresos_totales', 'recaudacion_pendiente', 'total_pedidos'])

    # Por producto
    if fecha:
        # We need a subquery for filtered items
        subq = db.session.query(PedidoItem.producto_id, PedidoItem.cantidad)\
            .join(Pedido, PedidoItem.pedido_id == Pedido.id)\
            .filter(func.date(Pedido.fecha_pedido) == fecha).subquery()
            
        prod_query = db.session.query(Producto.nombre, func.coalesce(func.sum(subq.c.cantidad), 0))\
            .outerjoin(subq, Producto.id == subq.c.producto_id)\
            .group_by(Producto.nombre)
    else:
        prod_query = db.session.query(Producto.nombre, func.coalesce(func.sum(PedidoItem.cantidad), 0))\
            .outerjoin(PedidoItem, Producto.id == PedidoItem.producto_id)\
            .group_by(Producto.nombre)
            
    por_producto = {row[0]: row[1] for row in prod_query.all()}
    
    # Por medio de pago
    mp_query = db.session.query(Pedido.medio_pago, func.coalesce(func.sum(Pedido.monto_total), 0))
    if fecha: mp_query = mp_query.filter(func.date(Pedido.fecha_pedido) == fecha)
    mp_query = mp_query.group_by(Pedido.medio_pago)
    ingresos_pago = {row[0]: row[1] for row in mp_query.all()}
    
    # Por estado
    st_query = db.session.query(Pedido.estado, func.count())
    if fecha: st_query = st_query.filter(func.date(Pedido.fecha_pedido) == fecha)
    st_query = st_query.group_by(Pedido.estado)
    por_estado = {row[0]: row[1] for row in st_query.all()}
    
    return {
        **totales,
        'recaudacion_cobrada': totales.get('ingresos_totales', 0),
        'ingresos_por_pago': ingresos_pago,
        'por_medio_pago': ingresos_pago,
        'por_estado': por_estado,
        'por_producto': por_producto
    }

def get_contactos(fecha=None):
    # This query uses window functions or subqueries in raw SQL. 
    # Let's do it cleanly in Python by getting the grouped data.
    base_query = db.session.query(
        Pedido.nombre_cliente,
        Pedido.telefono,
        func.count().label('total_pedidos'),
        func.sum(Pedido.monto_total).label('gasto_total'),
        func.max(Pedido.fecha_pedido).label('ultimo_pedido')
    ).group_by(Pedido.nombre_cliente, Pedido.telefono).order_by(Pedido.nombre_cliente.asc())
    
    if fecha:
        # Only clients that ordered on this date
        subq = db.session.query(Pedido.nombre_cliente, Pedido.telefono)\
            .filter(func.date(Pedido.fecha_pedido) == fecha)\
            .group_by(Pedido.nombre_cliente, Pedido.telefono).subquery()
            
        base_query = base_query.join(
            subq, 
            (Pedido.nombre_cliente == subq.c.nombre_cliente) & (Pedido.telefono == subq.c.telefono)
        )
        
    contactos = []
    for row in base_query.all():
        nombre_c, tel, total_p, gasto_t, ult_p = row
        # Fetch latest order to get email and address
        latest = Pedido.query.filter_by(nombre_cliente=nombre_c, telefono=tel).order_by(Pedido.fecha_pedido.desc()).first()
        contactos.append({
            'nombre_cliente': nombre_c,
            'telefono': tel,
            'email': latest.email if latest else '',
            'direccion': latest.direccion if latest else '',
            'total_pedidos': total_p,
            'gasto_total': gasto_t,
            'ultimo_pedido': _serialize(ult_p)
        })
    return contactos

def get_historial_contacto(nombre_cliente, telefono):
    pedidos = Pedido.query.filter_by(nombre_cliente=nombre_cliente, telefono=telefono).order_by(Pedido.fecha_pedido.desc()).all()
    return [_model_to_dict(p) for p in pedidos]

def create_usuario(nombre, email, password_hash, rol='user'):
    u = Usuario(nombre=nombre, email=email, password_hash=password_hash, rol=rol)
    db.session.add(u)
    db.session.commit()
    return {
        'id': u.id,
        'nombre': u.nombre,
        'email': u.email,
        'rol': u.rol,
        'telefono': u.telefono,
        'direccion': u.direccion,
        'created_at': _serialize(u.created_at)
    }

def get_usuario_by_email(email):
    u = Usuario.query.filter_by(email=email).first()
    if not u:
        return None
    return {
        'id': u.id,
        'nombre': u.nombre,
        'email': u.email,
        'password_hash': u.password_hash,
        'rol': u.rol,
        'telefono': u.telefono,
        'direccion': u.direccion,
        'created_at': _serialize(u.created_at)
    }

def get_usuario_by_id(user_id):
    u = Usuario.query.get(user_id)
    if not u:
        return None
    return {
        'id': u.id,
        'nombre': u.nombre,
        'email': u.email,
        'rol': u.rol,
        'telefono': u.telefono,
        'direccion': u.direccion,
        'created_at': _serialize(u.created_at)
    }

def get_all_usuarios():
    usuarios = Usuario.query.order_by(Usuario.created_at.desc()).all()
    return [{
        'id': u.id,
        'nombre': u.nombre,
        'email': u.email,
        'rol': u.rol,
        'telefono': u.telefono,
        'direccion': u.direccion,
        'created_at': _serialize(u.created_at)
    } for u in usuarios]

def update_usuario_rol(user_id, nuevo_rol):
    u = Usuario.query.get(user_id)
    if not u:
        return False
    u.rol = nuevo_rol
    db.session.commit()
    return True

def update_usuario_profile(user_id, data):
    u = Usuario.query.get(user_id)
    if not u:
        return False
    if 'telefono' in data: u.telefono = data['telefono']
    if 'direccion' in data: u.direccion = data['direccion']
    db.session.commit()
    return True

def delete_usuario(user_id):
    u = Usuario.query.get(user_id)
    if not u:
        return False
    # Unlink orders from this user to preserve the restaurant's order history
    Pedido.query.filter_by(usuario_id=user_id).update({'usuario_id': None})
    db.session.delete(u)
    db.session.commit()
    return True
