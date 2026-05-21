from dotenv import load_dotenv
load_dotenv()

from flask import Flask, render_template, request, jsonify, redirect, url_for, send_file
from config import (ESTADOS, MEDIOS_PAGO,
                    PRECIO_LOCRO_UNITARIO, PRECIO_PASTELITO_DOCENA,
                    PRECIO_PASTELITO_MEDIA_DOCENA, PRECIO_PASTELITO_UNIDAD)
import models
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

app = Flask(__name__)

# ── Inicializar base de datos al arrancar ────────────────────────────────────
with app.app_context():
    models.init_db()


# ── Helpers de validación ────────────────────────────────────────────────────
def validar_pedido(data):
    """Valida los campos obligatorios de un pedido. Retorna lista de errores."""
    errores = []
    if not data.get('nombre_cliente', '').strip():
        errores.append('El nombre del cliente es obligatorio.')
    if not data.get('telefono', '').strip():
        errores.append('El teléfono es obligatorio.')
    if not data.get('direccion', '').strip():
        errores.append('La dirección es obligatoria.')
    if data.get('medio_pago') not in MEDIOS_PAGO:
        errores.append(f"Medio de pago inválido. Debe ser: {', '.join(MEDIOS_PAGO)}.")
    if data.get('tipo_entrega') not in ('envio', 'retiro'):
        errores.append("Tipo de entrega inválido.")
    
    # Validación de formato de email
    email = data.get('email', '').strip()
    if email:
        import re
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", email):
            errores.append('El formato del email es inválido.')

    # Validación de formato de teléfono
    telefono = data.get('telefono', '').strip()
    if telefono:
        import re
        if not re.match(r"^[+0-9\s()-]+$", telefono):
            errores.append('El teléfono contiene caracteres no válidos.')

    # Mitigación XSS: Bloquear caracteres < y > en campos de texto
    for field in ['nombre_cliente', 'direccion', 'notas', 'horario_entrega']:
        val = data.get(field, '')
        if val and ('<' in val or '>' in val):
            errores.append(f'El campo {field.replace("_", " ")} no puede contener los caracteres "<" o ">".')

    try:
        qty_locro     = int(data.get('cantidad_locro', 0))
        qty_batata    = int(data.get('cantidad_pastelito_batata', 0))
        qty_membrillo = int(data.get('cantidad_pastelito_membrillo', 0))
        if qty_locro < 0 or qty_batata < 0 or qty_membrillo < 0:
            errores.append('Las cantidades no pueden ser negativas.')
        if qty_locro + qty_batata + qty_membrillo == 0:
            errores.append('El pedido debe tener al menos un producto.')
    except (ValueError, TypeError):
        errores.append('Las cantidades deben ser números enteros.')
    return errores


# ── Rutas de páginas ─────────────────────────────────────────────────────────

@app.route('/')
def index():
    return redirect(url_for('dashboard'))


@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')


@app.route('/nuevo-pedido')
def nuevo_pedido():
    return render_template('nuevo_pedido.html')


@app.route('/pedidos/<int:pedido_id>/editar', methods=['GET'])
def editar_pedido_form(pedido_id):
    pedido = models.get_pedido_by_id(pedido_id)
    if not pedido:
        return render_template('dashboard.html'), 404
    return render_template('editar_pedido.html', pedido=pedido, estados=ESTADOS)


@app.route('/pedidos/<int:pedido_id>/editar', methods=['POST'])
def editar_pedido_submit(pedido_id):
    pedido = models.get_pedido_by_id(pedido_id)
    if not pedido:
        return jsonify({'error': 'Pedido no encontrado.'}), 404

    data = request.get_json() or request.form.to_dict()
    errores = validar_pedido(data)
    if data.get('estado') not in ESTADOS:
        errores.append(f"Estado inválido.")
    if errores:
        return jsonify({'errores': errores}), 400

    ok, monto_total = models.update_pedido(pedido_id, data)
    if not ok:
        return jsonify({'error': 'No se pudo actualizar el pedido.'}), 500
    return jsonify({'ok': True, 'monto_total': monto_total})


# ── API de pedidos ───────────────────────────────────────────────────────────

@app.route('/pedidos', methods=['POST'])
def crear_pedido():
    data = request.get_json() or request.form.to_dict()
    errores = validar_pedido(data)
    if errores:
        return jsonify({'errores': errores}), 400

    pedido_id, monto_total = models.create_pedido(data)
    return jsonify({'ok': True, 'id': pedido_id, 'monto_total': monto_total}), 201


@app.route('/api/pedidos', methods=['GET'])
def listar_pedidos():
    estado     = request.args.get('estado') or None
    medio_pago = request.args.get('medio_pago') or None
    fecha      = request.args.get('fecha') or None
    busqueda   = request.args.get('q') or None
    pedidos    = models.get_all_pedidos(estado=estado, medio_pago=medio_pago, fecha=fecha, busqueda=busqueda)
    return jsonify(pedidos)


@app.route('/api/pedidos/<int:pedido_id>', methods=['GET'])
def detalle_pedido(pedido_id):
    pedido = models.get_pedido_by_id(pedido_id)
    if not pedido:
        return jsonify({'error': 'Pedido no encontrado.'}), 404
    return jsonify(pedido)


@app.route('/api/pedidos/<int:pedido_id>/pagado', methods=['PUT'])
def cambiar_pagado(pedido_id):
    data = request.get_json()
    if not data or 'pagado' not in data:
        return jsonify({'error': 'Falta el campo pagado.'}), 400
    ok = models.update_pagado(pedido_id, bool(data['pagado']))
    if not ok:
        return jsonify({'error': 'Pedido no encontrado.'}), 404
    return jsonify({'ok': True, 'pagado': data['pagado']})


@app.route('/api/pedidos/<int:pedido_id>/estado', methods=['PUT'])
def cambiar_estado(pedido_id):
    data = request.get_json()
    if not data or 'estado' not in data:
        return jsonify({'error': 'Falta el campo estado.'}), 400
    try:
        ok = models.update_estado(pedido_id, data['estado'])
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    if not ok:
        return jsonify({'error': 'Pedido no encontrado.'}), 404
    return jsonify({'ok': True, 'estado': data['estado']})


@app.route('/api/pedidos/<int:pedido_id>', methods=['DELETE'])
def eliminar_pedido(pedido_id):
    ok, motivo = models.delete_pedido(pedido_id)
    if not ok:
        if motivo == 'not_found':
            return jsonify({'error': 'Pedido no encontrado.'}), 404
        if motivo == 'not_pending':
            return jsonify({'error': 'Solo se pueden eliminar pedidos en estado Pendiente.'}), 409
    return jsonify({'ok': True})


# ── API de estadísticas y configuración ─────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
def estadisticas():
    fecha = request.args.get('fecha') or None
    return jsonify(models.get_stats(fecha=fecha))


@app.route('/api/precios', methods=['GET'])
def precios():
    """Expone los precios al frontend para el cálculo en tiempo real."""
    return jsonify({
        'locro_unitario': PRECIO_LOCRO_UNITARIO,
        'pastelito_docena': PRECIO_PASTELITO_DOCENA,
        'pastelito_media_docena': PRECIO_PASTELITO_MEDIA_DOCENA,
        'pastelito_unidad': PRECIO_PASTELITO_UNIDAD,
    })


# ── Exportar a Excel ─────────────────────────────────────────────────────────

@app.route('/api/export')
def exportar_excel():
    estado     = request.args.get('estado') or None
    medio_pago = request.args.get('medio_pago') or None
    fecha      = request.args.get('fecha') or None
    busqueda   = request.args.get('q') or None
    pedidos    = models.get_all_pedidos(estado=estado, medio_pago=medio_pago, fecha=fecha, busqueda=busqueda)

    wb = Workbook()
    ws = wb.active
    ws.title = 'Pedidos'

    # Habilitar líneas de cuadrícula visibles
    ws.views.sheetView[0].showGridLines = True

    encabezados = [
        'ID', 'Fecha', 'Cliente', 'Teléfono', 'Email', 'Dirección',
        'Locro (porciones)', 'Pastelitos Batata (unidades)', 'Pastelitos Membrillo (unidades)',
        'Medio de pago', 'Total ($)', 'Tipo entrega', 'Horario entrega', 'Notas', 'Estado', 'Pagado',
    ]

    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for col_idx, titulo in enumerate(encabezados, start=1):
        cell = ws.cell(row=1, column=col_idx, value=titulo)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align

    # Estilos de celdas
    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")
    font_body = Font(name="Segoe UI", size=11)

    for row_idx, p in enumerate(pedidos, start=2):
        row_values = [
            p['id'],
            p['fecha_pedido'],
            p['nombre_cliente'],
            p['telefono'],
            p.get('email') or '',
            p['direccion'],
            p['cantidad_locro'],
            p['cantidad_pastelito_batata'],
            p['cantidad_pastelito_membrillo'],
            p['medio_pago'],
            p['monto_total'],
            'Retiro iglesia' if p.get('tipo_entrega') == 'retiro' else 'Envío domicilio',
            p.get('horario_entrega') or '',
            p.get('notas') or '',
            p['estado'],
            'Sí' if p.get('pagado') else 'No',
        ]
        
        for col_idx, val in enumerate(row_values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = font_body
            
            # Formatos de número y alineación
            if col_idx == 11:  # Total ($)
                cell.number_format = '$#,##0'
                cell.alignment = align_right
            elif col_idx in [1, 7, 8, 9]:  # ID y cantidades
                cell.alignment = align_right
            elif col_idx in [2, 4, 10, 12, 13, 15, 16]:  # Fecha, teléfono, pago, tipo entrega, horario, estado, pagado
                cell.alignment = align_center
            else:  # Cliente, dirección, email, notas
                cell.alignment = align_left

    # Auto-ajustar Anchos de Columnas Dinámicamente
    for col_idx, titulo in enumerate(encabezados, start=1):
        col_letter = get_column_letter(col_idx)
        max_len = len(str(titulo))
        for row in range(2, len(pedidos) + 2):
            val = ws.cell(row=row, column=col_idx).value
            if val is not None:
                if col_idx == 11 and isinstance(val, (int, float)):
                    formatted_val = f"${val:,.0f}".replace(",", ".")
                    max_len = max(max_len, len(formatted_val))
                else:
                    max_len = max(max_len, len(str(val)))
        
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(
        buf,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='pedidos_ventasRF.xlsx',
    )


# ── Arranque ─────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, port=8080)
