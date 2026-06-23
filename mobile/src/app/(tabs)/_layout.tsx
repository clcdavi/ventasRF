import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, ClipboardList, PieChart, Truck } from 'lucide-react-native';
import { Platform, View } from 'react-native';
import { useAuth } from '../../stores/auth';

export default function TabLayout() {
  const { user } = useAuth();
  const role = user?.rol || 'customer';

  // Ocultar/mostrar pestañas dinámicamente según el rol
  const showTab = (tabName: 'index' | 'pedidos' | 'stats' | 'envios') => {
    if (role === 'admin') {
      return true;
    }
    if (role === 'repartidor') {
      return tabName === 'envios';
    }
    // customer / cliente
    return tabName === 'index' || tabName === 'pedidos';
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#4F46E5', // Color índigo de la opción Soft
          tabBarInactiveTintColor: '#94A3B8', // Gris slate suave
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            fontFamily: 'SF Pro Display',
            paddingBottom: 4,
          },
          tabBarStyle: {
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 24 : 16,
            left: 16,
            right: 16,
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            height: 64,
            paddingTop: 8,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            elevation: 4,
            ...Platform.select({
              ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.05,
                shadowRadius: 16,
              },
            }),
          },
          headerShown: false, // Ocultamos el header por defecto para controlarlo por pantalla
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: role === 'customer' ? 'Inicio' : 'Resumen',
            tabBarIcon: ({ color }) => <LayoutDashboard size={20} color={color} strokeWidth={2.5} />,
            href: showTab('index') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="pedidos"
          options={{
            title: role === 'customer' ? 'Mis Pedidos' : 'Pedidos',
            tabBarIcon: ({ color }) => <ClipboardList size={20} color={color} strokeWidth={2.5} />,
            href: showTab('pedidos') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'Estadísticas',
            tabBarIcon: ({ color }) => <PieChart size={20} color={color} strokeWidth={2.5} />,
            href: showTab('stats') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="envios"
          options={{
            title: 'Reparto',
            tabBarIcon: ({ color }) => <Truck size={20} color={color} strokeWidth={2.5} />,
            href: showTab('envios') ? undefined : null,
          }}
        />
      </Tabs>
    </View>
  );
}
