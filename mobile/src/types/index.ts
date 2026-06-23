export interface Pedido {
  id: number;
  fecha_pedido: string;
  nombre_cliente: string;
  telefono: string;
  email?: string;
  direccion: string;
  cantidad_locro: number;
  cantidad_pastelito_batata: number;
  cantidad_pastelito_membrillo: number;
  medio_pago: string;
  monto_total: number;
  tipo_entrega: 'envio' | 'retiro';
  horario_entrega?: string;
  notas?: string;
  estado: string;
  pagado: boolean;
  created_at?: string;
}

export interface Stats {
  total_pedidos: number;
  total_locro: number;
  total_batata: number;
  total_membrillo: number;
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

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol?: string;
}

