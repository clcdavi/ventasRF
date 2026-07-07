import { storage } from '../utils/storage';
import { API_BASE_URL } from './config';
import { Pedido, Stats, Contacto, Precios, User, Producto } from '../types';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const token = await storage.getItem('authToken');
    const authHeaders: Record<string, string> = {};
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! Status: ${response.status}`;
      try {
        const errJson = await response.json();
        errorMessage = errJson.error || errJson.errores?.join(', ') || errorMessage;
      } catch {}
      throw new Error(errorMessage);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`[API Error] Failed to fetch ${url}:`, error);
    throw error;
  }
}

export interface PaginatedPedidos {
  data: Pedido[];
  total: number;
  page: number;
  pages: number;
}

export const api = {
  // Obtener listado de pedidos con filtros y paginación
  getPedidos: (filters?: {
    estado?: string;
    medio_pago?: string;
    fecha?: string;
    q?: string;
    tipo_entrega?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
    }
    const query = params.toString();
    // Si enviamos page, el backend retorna PaginatedPedidos
    if (filters?.page !== undefined) {
      return fetchJson<PaginatedPedidos>(`/api/pedidos${query ? `?${query}` : ''}`);
    }
    return fetchJson<Pedido[]>(`/api/pedidos${query ? `?${query}` : ''}`);
  },

  // Obtener fechas de pedidos
  getFechasPedidos: () => {
    return fetchJson<string[]>('/api/pedidos/fechas');
  },

  // Obtener pedidos del usuario logueado (clientes)
  getMisPedidos: () => {
    return fetchJson<Pedido[]>('/api/pedidos/mis-pedidos');
  },

  // Obtener detalle de un pedido
  getPedidoDetail: (id: number) => {
    return fetchJson<Pedido>(`/api/pedidos/${id}`);
  },

  // Crear un pedido
  crearPedido: (pedido: Omit<Pedido, 'id' | 'monto_total'>) => {
    return fetchJson<{ ok: boolean; id: number; monto_total: number }>('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify(pedido),
    });
  },

  // Editar un pedido completo
  editarPedido: (id: number, pedido: Partial<Pedido>) => {
    return fetchJson<{ ok: boolean; monto_total: number }>(`/api/pedidos/${id}/editar`, {
      method: 'POST',
      body: JSON.stringify(pedido),
    });
  },

  // Cambiar estado de pago (pagado / no pagado)
  cambiarPagado: (id: number, pagado: boolean) => {
    return fetchJson<{ ok: boolean; pagado: boolean }>(`/api/pedidos/${id}/pagado`, {
      method: 'PUT',
      body: JSON.stringify({ pagado }),
    });
  },

  // Cambiar estado del pedido (Pendiente -> En preparación, etc.)
  cambiarEstado: (id: number, estado: string) => {
    return fetchJson<{ ok: boolean; estado: string }>(`/api/pedidos/${id}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado }),
    });
  },

  // Cambiar dirección del pedido (solo Pendiente o Confirmado)
  cambiarDireccion: (id: number, direccion: string) => {
    return fetchJson<{ ok: boolean; direccion: string; direccion_editada: boolean }>(`/api/pedidos/${id}/direccion`, {
      method: 'PUT',
      body: JSON.stringify({ direccion }),
    });
  },

  // Asignar o cambiar repartidor
  cambiarRepartidor: (id: number, repartidor: string) => {
    return fetchJson<{ ok: boolean }>(`/api/pedidos/${id}/repartidor`, {
      method: 'PUT',
      body: JSON.stringify({ repartidor }),
    });
  },

  // Eliminar un pedido (solo permitido si está Pendiente)
  eliminarPedido: (id: number) => {
    return fetchJson<{ ok: boolean }>(`/api/pedidos/${id}`, {
      method: 'DELETE',
    });
  },

  // Obtener estadísticas agregadas
  getStats: (fecha?: string) => {
    const query = fecha ? `?fecha=${fecha}` : '';
    return fetchJson<Stats>(`/api/stats${query}`);
  },

  // Obtener la configuración actual de precios (deprecated, use getProductos)
  getPrecios: () => {
    return fetchJson<Precios>('/api/precios');
  },

  // Obtener productos
  getProductos: (activos?: boolean) => {
    const query = activos !== undefined ? `?activos=${activos}` : '';
    return fetchJson<Producto[]>(`/api/productos${query}`);
  },

  createProducto: (data: Partial<Producto>) => {
    return fetchJson<Producto>('/api/productos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateProducto: (id: number, data: Partial<Producto>) => {
    return fetchJson<Producto>(`/api/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteProducto: (id: number) => {
    return fetchJson<{ ok: boolean }>(`/api/productos/${id}`, {
      method: 'DELETE',
    });
  },

  // Obtener contactos / directorio de clientes
  getContactos: (fecha?: string) => {
    const query = fecha ? `?fecha=${fecha}` : '';
    return fetchJson<Contacto[]>(`/api/contactos${query}`);
  },

  // Obtener historial de pedidos de un cliente específico
  getHistorialContacto: (nombre: string, telefono: string) => {
    const params = new URLSearchParams({ nombre, telefono });
    return fetchJson<Pedido[]>(`/api/contactos/historial?${params.toString()}`);
  },

  // Obtener envíos pendientes (para reparto)
  getEnviosPendientes: (fecha?: string) => {
    const query = fecha ? `?fecha=${fecha}` : '';
    return fetchJson<Pedido[]>(`/api/pedidos/envios${query}`);
  },

  // Autenticación: Iniciar sesión
  login: (credentials: { email: string; contrasenia: string }) => {
    return fetchJson<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: credentials.email,
        contrasenia: credentials.contrasenia,
        password: credentials.contrasenia,
      }),
    });
  },

  // Autenticación: Registrarse
  register: (fields: { nombre: string; email: string; contrasenia: string; codigoStaff?: string }) => {
    return fetchJson<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nombre: fields.nombre,
        name: fields.nombre,
        email: fields.email,
        contrasenia: fields.contrasenia,
        password: fields.contrasenia,
        codigo_staff: fields.codigoStaff,
      }),
    });
  },

  // Autenticación: Iniciar sesión con Google
  loginGoogle: (idToken: string) => {
    return fetchJson<{ token: string; user: User }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  // Autenticación: Obtener datos de mi perfil
  getMe: (token?: string) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return fetchJson<User>('/api/auth/me', { headers });
  },

  // Cambiar rol ingresando un código de staff
  upgradeRole: (codigo: string) => {
    return fetchJson<{ ok: boolean; user: User; message: string }>('/api/auth/upgrade-role', {
      method: 'POST',
      body: JSON.stringify({ codigo }),
    });
  },

  // Autenticación: Actualizar perfil de usuario
  updateProfile: (data: { telefono?: string; direccion?: string }) => {
    return fetchJson<{ ok: boolean; user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
