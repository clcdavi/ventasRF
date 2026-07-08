import { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Users, ShoppingCart, Activity, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';

const API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8080/api' : '/api';
const SOCKET_URL = import.meta.env.DEV ? 'http://127.0.0.1:8080' : '/';

interface User {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  created_at: string;
}

interface Pedido {
  id: number;
  nombre_cliente: string;
  monto_total: number;
  estado: string;
  fecha_pedido: string;
}

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'usuarios' | 'pedidos'>('dashboard');

  const fetchData = async () => {
    try {
      const [usersRes, pedidosRes] = await Promise.all([
        axios.get(`${API_URL}/usuarios`),
        axios.get(`${API_URL}/pedidos`)
      ]);
      setUsers(usersRes.data);
      const pedidosData = pedidosRes.data;
      setPedidos(Array.isArray(pedidosData) ? pedidosData : pedidosData.data || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching data", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = io(SOCKET_URL);
    
    socket.on('usuarios_actualizados', (data) => {
      console.log('Update usuarios', data);
      fetchData();
    });

    socket.on('pedidos_actualizados', (data) => {
      console.log('Update pedidos', data);
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const totalVentas = pedidos.reduce((acc, curr) => acc + curr.monto_total, 0);
  const pedidosPendientes = pedidos.filter(p => p.estado.toLowerCase() === 'pendiente').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderContent = () => {
    if (currentTab === 'usuarios') {
      return (
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Todos los Usuarios</h2>
            <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-medium">
              Total: {users.length}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="p-4 font-medium text-muted-foreground">ID</th>
                    <th className="p-4 font-medium text-muted-foreground">Nombre</th>
                    <th className="p-4 font-medium text-muted-foreground">Email</th>
                    <th className="p-4 font-medium text-muted-foreground">Rol</th>
                    <th className="p-4 font-medium text-muted-foreground">Fecha Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4 text-muted-foreground">#{u.id}</td>
                      <td className="p-4 font-medium">{u.nombre}</td>
                      <td className="p-4">{u.email}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">No hay usuarios registrados</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (currentTab === 'pedidos') {
      return (
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Todos los Pedidos</h2>
            <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-medium">
              Total: {pedidos.length}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="p-4 font-medium text-muted-foreground">ID</th>
                    <th className="p-4 font-medium text-muted-foreground">Cliente</th>
                    <th className="p-4 font-medium text-muted-foreground">Monto Total</th>
                    <th className="p-4 font-medium text-muted-foreground">Estado</th>
                    <th className="p-4 font-medium text-muted-foreground">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pedidos.map(p => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4 text-primary font-medium">#{p.id}</td>
                      <td className="p-4">{p.nombre_cliente}</td>
                      <td className="p-4 font-bold">${p.monto_total.toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`flex w-max items-center px-2.5 py-1 rounded-full text-xs font-medium border border-border ${p.estado.toLowerCase() === 'pendiente' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                          {p.estado.toLowerCase() === 'pendiente' ? <Clock size={12} className="mr-1" /> : <CheckCircle2 size={12} className="mr-1" />}
                          {p.estado}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(p.fecha_pedido).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {pedidos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">No hay pedidos registrados</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    // Default: dashboard
    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground font-medium">Usuarios Registrados</h3>
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                <Users size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold">{users.length}</p>
          </div>
          
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground font-medium">Pedidos Totales</h3>
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <ShoppingCart size={24} />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <p className="text-3xl font-bold">{pedidos.length}</p>
              {pedidosPendientes > 0 && (
                <span className="text-sm text-orange-500 flex items-center">
                  <Clock size={14} className="mr-1" /> {pedidosPendientes} pendientes
                </span>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground font-medium">Ventas Totales</h3>
              <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                <Activity size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold">${totalVentas.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-card/50">
              <h3 className="text-lg font-semibold">Usuarios Recientes</h3>
              <button onClick={() => setCurrentTab('usuarios')} className="text-sm text-primary hover:underline flex items-center">
                Ver todos <ArrowUpRight size={16} className="ml-1" />
              </button>
            </div>
            <div className="p-0 flex-1 overflow-auto max-h-[400px]">
              <ul className="divide-y divide-border">
                {users.slice(0, 10).map((u) => (
                  <li key={u.id} className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between">
                    <div>
                      <p className="font-medium">{u.nombre}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                      {u.rol}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-card/50">
              <h3 className="text-lg font-semibold">Pedidos Recientes</h3>
              <button onClick={() => setCurrentTab('pedidos')} className="text-sm text-primary hover:underline flex items-center">
                Ver todos <ArrowUpRight size={16} className="ml-1" />
              </button>
            </div>
            <div className="p-0 flex-1 overflow-auto max-h-[400px]">
              <ul className="divide-y divide-border">
                {pedidos.slice(0, 10).map((p) => (
                  <li key={p.id} className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between">
                    <div>
                      <p className="font-medium text-primary">Pedido #{p.id}</p>
                      <p className="text-sm">{p.nombre_cliente}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${p.monto_total}</p>
                      <span className={`text-xs flex items-center justify-end mt-1 ${p.estado.toLowerCase() === 'pendiente' ? 'text-orange-500' : 'text-green-500'}`}>
                        {p.estado.toLowerCase() === 'pendiente' ? <Clock size={12} className="mr-1" /> : <CheckCircle2 size={12} className="mr-1" />}
                        {p.estado}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-xl hidden md:flex flex-col">
        <div className="p-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
            AdminRF
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Panel de Control</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setCurrentTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${currentTab === 'dashboard' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Activity size={20} />
            <span>Dashboard</span>
          </button>
          <button 
            onClick={() => setCurrentTab('usuarios')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${currentTab === 'usuarios' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Users size={20} />
            <span>Usuarios</span>
          </button>
          <button 
            onClick={() => setCurrentTab('pedidos')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${currentTab === 'pedidos' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <ShoppingCart size={20} />
            <span>Pedidos</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            {currentTab === 'dashboard' ? 'Resumen General' : currentTab === 'usuarios' ? 'Gestión de Usuarios' : 'Gestión de Pedidos'}
          </h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-sm text-muted-foreground">En vivo</span>
            </div>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
}

export default App;
