import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar, View, Text, useWindowDimensions, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../stores/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2, // 2 minutos
      refetchOnWindowFocus: true,
    },
  },
});

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = Platform.OS === 'web' && width > 768;

  const appContent = (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerShadowVisible: false,
        headerTintColor: '#111111',
        headerTitleStyle: {
          fontFamily: 'System',
          fontWeight: '600',
          fontSize: 16,
        },
        contentStyle: {
          backgroundColor: '#fbfbfa', // Bone/Off-White cálido
        },
      }}
    >
      {/* Flujo de Autenticación */}
      <Stack.Screen 
        name="(auth)" 
        options={{ headerShown: false }} 
      />

      {/* Navegación por Pestañas */}
      <Stack.Screen 
        name="(tabs)" 
        options={{ headerShown: false }} 
      />
    
      {/* Detalle de Pedido */}
      <Stack.Screen 
        name="pedidos/[id]" 
        options={{ 
          title: 'Detalle de Pedido',
          headerTitleStyle: {
            fontFamily: 'System',
            fontWeight: '600',
            fontSize: 16,
          }
        }} 
      />
      
      {/* Formularios */}
      <Stack.Screen 
        name="pedidos/nuevo" 
        options={{ 
          title: 'Nuevo Pedido', 
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="pedidos/editar" 
        options={{ 
          title: 'Editar Pedido', 
          presentation: 'modal',
        }} 
      />
    </Stack>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          {isLargeScreen ? (
            <View style={styles.desktopContainer}>
              {/* Sección Izquierda: Branding e Instrucciones */}
              <View style={styles.desktopLeft}>
                <View style={styles.glassCard}>
                  <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>RF</Text>
                  </View>
                  <Text style={styles.desktopTitle}>PedidosRF</Text>
                  <Text style={styles.desktopSubtitle}>
                    Bienvenido al sistema de pedidos y gestión. Esta interfaz premium te permite realizar pedidos, ver tus estadísticas de ventas y coordinar repartos.
                  </Text>
                  <View style={styles.badgeContainer}>
                    <View style={styles.infoBadge}>
                      <Text style={styles.infoBadgeText}>✨ Interfaz Optimizada</Text>
                    </View>
                    <View style={styles.infoBadgeOutline}>
                      <Text style={styles.infoBadgeTextOutline}>📱 Accesible desde Celular</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Sección Derecha: Marco del Celular con la App */}
              <View style={styles.desktopRight}>
                <View style={styles.desktopAppFrame}>
                  {appContent}
                </View>
              </View>
            </View>
          ) : (
            appContent
          )}
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'radial-gradient(circle at 10% 20%, #e2e8f0 0%, #f8fafc 90%)',
    } : {}),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 60,
  } as any,
  desktopLeft: {
    flex: 1,
    paddingRight: 60,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  glassCard: {
    maxWidth: 480,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    } : {}),
    padding: 48,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 4,
  } as any,
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -1,
  },
  desktopTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 20,
    letterSpacing: -1.5,
  },
  desktopSubtitle: {
    fontSize: 18,
    color: '#475569',
    lineHeight: 28,
    marginBottom: 36,
    fontWeight: '500',
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  infoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#4F46E5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  infoBadgeText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoBadgeOutline: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  infoBadgeTextOutline: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  desktopRight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  desktopAppFrame: {
    width: 400,
    height: 800,
    ...(Platform.OS === 'web' ? { maxHeight: '90vh' } : {}),
    backgroundColor: '#ffffff',
    borderRadius: 48,
    borderWidth: 12,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.15,
    shadowRadius: 60,
    elevation: 12,
  } as any,
});
