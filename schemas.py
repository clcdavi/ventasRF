from marshmallow import Schema, fields, validate, ValidationError
from config import MEDIOS_PAGO, ESTADOS

class PedidoSchema(Schema):
    nombre_cliente = fields.String(required=True, validate=validate.Length(min=1, max=100))
    telefono = fields.String(required=True, validate=validate.Regexp(r"^[+0-9\s()-]+$"))
    email = fields.Email(allow_none=True)
    direccion = fields.String(required=True, validate=validate.Length(min=1, max=255))
    cantidad_locro = fields.Integer(load_default=0, validate=validate.Range(min=0))
    cantidad_pastelito_batata = fields.Integer(load_default=0, validate=validate.Range(min=0))
    cantidad_pastelito_membrillo = fields.Integer(load_default=0, validate=validate.Range(min=0))
    medio_pago = fields.String(required=True, validate=validate.OneOf(MEDIOS_PAGO))
    horario_entrega = fields.String(allow_none=True, validate=validate.Length(max=100))
    notas = fields.String(allow_none=True, validate=validate.Length(max=500))
    tipo_entrega = fields.String(load_default='envio', validate=validate.OneOf(['envio', 'retiro']))
    fecha_pedido = fields.String(allow_none=True)
    estado = fields.String(allow_none=True)
    pagado = fields.Boolean(allow_none=True)
    items = fields.List(fields.Dict(), allow_none=True)

class CambioEstadoSchema(Schema):
    estado = fields.String(required=True, validate=validate.OneOf(ESTADOS))

class LoginSchema(Schema):
    codigo = fields.String(required=True, validate=validate.Length(min=1))

pedido_schema = PedidoSchema()
cambio_estado_schema = CambioEstadoSchema()
login_schema = LoginSchema()
