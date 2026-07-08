import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, ClipboardList, User, Truck } from 'lucide-react-native';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../stores/auth';
import { GlobalHeader } from '../../components/GlobalHeader';

export default function TabLayout() {
  const { user, viewAsCustomer } = useAuth();
  const role = user?.rol || 'user';
  const isRealCustomer = role === 'user' || role === 'customer' || viewAsCustomer;

  // Ocultar/mostrar pestañas dinámicamente según el rol
  const showTab = (tabName: 'index' | 'resumen' | 'envios' | 'perfil') => {
    if (!isRealCustomer) {
      return true; // Admin ve todo
    }
    // user / cliente
    return tabName === 'resumen' || tabName === 'index' || tabName === 'perfil';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <GlobalHeader />
      <View style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#4F46E5', // Color índigo
          tabBarInactiveTintColor: '#94A3B8', // Gris slate suave
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: 'Inter_600SemiBold',
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
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="resumen"
          options={{
            title: isRealCustomer ? 'Inicio' : 'Estadísticas',
            tabBarIcon: ({ color }) => <LayoutDashboard size={20} color={color} strokeWidth={2.5} />,
            href: showTab('resumen') ? undefined : null,
          }}
        />

        <Tabs.Screen
          name="index"
          options={{
            title: 'Pedidos',
            tabBarIcon: ({ color }) => <ClipboardList size={20} color={color} strokeWidth={2.5} />,
            href: showTab('index') ? undefined : null,
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

        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color }) => <User size={20} color={color} strokeWidth={2.5} />,
            href: showTab('perfil') ? undefined : null,
          }}
        />
      </Tabs>
    </View>
    </SafeAreaView>
  );
}
