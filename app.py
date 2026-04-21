from dotenv import load_dotenv
load_dotenv()

from flask import Flask, render_template, request, jsonify, redirect, url_for, send_file
from config import (ESTADOS, MEDIOS_PAGO,
                    PRECIO_LOCRO_UNITARIO, PRECIO_LOCRO_COMBO,
                    PRECIO_PASTELITO_DOCENA)
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
    pedidos    = models.get_all_pedidos(estado=estado, medio_pago=medio_pago, fecha=fecha)
    return jsonify(pedidos)


@app.route('/api/pedidos/<int:pedido_id>', methods=['GET'])
def detalle_pedido(pedido_id):
    pedido = models.get_pedido_by_id(pedido_id)
    if not pedido:
        return jsonify({'error': 'Pedido no encontrado.'}), 404
    return jsonify(pedido)


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
    return jsonify(models.get_stats())


@app.route('/api/precios', methods=['GET'])
def precios():
    """Expone los precios al frontend para el cálculo en tiempo real."""
    return jsonify({
        'locro_unitario': PRECIO_LOCRO_UNITARIO,
        'locro_combo':    PRECIO_LOCRO_COMBO,
        'pastelito_docena': PRECIO_PASTELITO_DOCENA,
    })


# ── Exportar a Excel ─────────────────────────────────────────────────────────

@app.route('/api/export')
def exportar_excel():
    estado     = request.args.get('estado') or None
    medio_pago = request.args.get('medio_pago') or None
    fecha      = request.args.get('fecha') or None
    pedidos    = models.get_all_pedidos(estado=estado, medio_pago=medio_pago, fecha=fecha)

    wb = Workbook()
    ws = wb.active
    ws.title = 'Pedidos'

    encabezados = [
        'ID', 'Fecha', 'Cliente', 'Teléfono', 'Email', 'Dirección',
        'Locro (porciones)', 'Pastelitos Batata (doc)', 'Pastelitos Membrillo (doc)',
        'Medio de pago', 'Total ($)', 'Horario entrega', 'Notas', 'Estado',
    ]

    header_fill = PatternFill('solid', fgColor='2563EB')
    header_font = Font(bold=True, color='FFFFFF')

    for col_idx, titulo in enumerate(encabezados, start=1):
        cell = ws.cell(row=1, column=col_idx, value=titulo)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center')

    for p in pedidos:
        ws.append([
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
            p.get('horario_entrega') or '',
            p.get('notas') or '',
            p['estado'],
        ])

    anchos = [6, 18, 22, 14, 22, 28, 18, 22, 24, 14, 12, 16, 24, 16]
    for i, ancho in enumerate(anchos, start=1):
        ws.column_dimensions[get_column_letter(i)].width = ancho

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
