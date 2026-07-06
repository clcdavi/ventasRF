export interface PedidoItem {
  producto_id: number;
  cantidad: number;
  producto_nombre?: string;
}

export interface Pedido {
  id: number;
  fecha_pedido: string;
  nombre_cliente: string;
  telefono: string;
  email?: string;
  direccion: string;
  items?: PedidoItem[];
  medio_pago: string;
  monto_total: number;
  horario_entrega?: string;
  notas?: string;
  estado: string;
  pagado: boolean;
  tipo_entrega: string;
  repartidor?: string;
}

export interface Stats {
  total_pedidos: number;
  por_producto: Record<string, number>;
  recaudacion_total: number;
  recaudacion_pendiente: number;
  recaudacion_cobrada: number;
  por_medio_pago: Record<string, number>;
  por_estado: Record<string, number>;
}

export interface Contacto {
  nombre_cliente: string;
  telefono: string;
  email?: string;
  direccion: string;
  ultimo_pedido?: string;
  total_pedidos: number;
}

export interface Precios {
  locro_unitario: number;
  pastelito_docena: number;
  pastelito_media_docena: number;
  pastelito_unidad: number;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion?: string;
  precio: number;
  activo: boolean;
}

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol?: string;
}

