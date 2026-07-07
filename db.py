from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

db = SQLAlchemy()

def init_db_app(app):
    # Prefer postgres if available, otherwise sqlite
    db_url = os.environ.get('DATABASE_URL')
    if db_url and db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql://', 1)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url or 'sqlite:///ventasrf.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nombre = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text, nullable=False, unique=True)
    password_hash = db.Column(db.Text, nullable=False)
    rol = db.Column(db.Text, nullable=False, default='user')
    telefono = db.Column(db.Text)
    direccion = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class Producto(db.Model):
    __tablename__ = 'productos'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nombre = db.Column(db.Text, nullable=False)
    descripcion = db.Column(db.Text)
    precio = db.Column(db.Float, nullable=False)
    activo = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class Pedido(db.Model):
    __tablename__ = 'pedidos'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    fecha_pedido = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    nombre_cliente = db.Column(db.Text, nullable=False)
    telefono = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text)
    direccion = db.Column(db.Text, nullable=False)
    medio_pago = db.Column(db.Text, nullable=False)
    monto_total = db.Column(db.Float, nullable=False)
    horario_entrega = db.Column(db.Text)
    notas = db.Column(db.Text)
    estado = db.Column(db.Text, nullable=False, default='Pendiente')
    pagado = db.Column(db.Boolean, nullable=False, default=False)
    tipo_entrega = db.Column(db.Text, nullable=False, default='envio')
    repartidor = db.Column(db.Text, nullable=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'))
    fecha_actualizacion = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    direccion_editada = db.Column(db.Boolean, nullable=False, default=False)
    
    # Relaciones ORM
    items = db.relationship('PedidoItem', backref='pedido', lazy=True, cascade='all, delete-orphan')
    usuario = db.relationship('Usuario', lazy=True)

class PedidoItem(db.Model):
    __tablename__ = 'pedido_items'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedidos.id', ondelete='CASCADE'), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Float, nullable=False)
    
    # Relaciones ORM
    producto = db.relationship('Producto', lazy=True)
