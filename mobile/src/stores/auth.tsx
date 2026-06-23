import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { storage } from '../utils/storage';
import { User } from '../types';
import { api } from '../services/api';
import { View, ActivityIndicator, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configurar Google Sign-In con las credenciales creadas
if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: '470092085691-g3qhlkdmgu2gkrj2qt6o428ja146e7t8.apps.googleusercontent.com',
    iosClientId: '470092085691-3s97ong1eao7ja6ae329h99muj9hh8ca.apps.googleusercontent.com',
    offlineAccess: false,
  });
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, contrasenia: string) => Promise<void>;
  signUp: (nombre: string, email: string, contrasenia: string, codigoStaff?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  // Verificar la sesión al montar el componente
  useEffect(() => {
    checkAuth();
  }, []);

  // Proteger rutas según el estado de autenticación
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      // Si no hay token y no está en el grupo de auth, redirigir a login
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      // Si hay token y está en login/register, redirigir al panel principal o repartidor
      if (user?.rol === 'repartidor') {
        router.replace('/(tabs)/envios');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [token, segments, isLoading, user]);

  async function checkAuth() {
    try {
      const storedToken = await storage.getItem('authToken');
      const storedUser = await storage.getItem('authUser');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Opcional: Validar token con el backend en segundo plano
        try {
          // Podemos llamar a un endpoint de verificar sesión en el api
          const freshUser = await api.getMe(storedToken);
          setUser(freshUser);
          await storage.setItem('authUser', JSON.stringify(freshUser));
        } catch (e) {
          console.warn('[Auth] Error al refrescar datos de usuario desde el servidor:', e);
          // Si el servidor retorna explícitamente no autorizado (por ejemplo, token expirado), deslogueamos
          if (e instanceof Error && e.message.includes('401')) {
            await signOut();
          }
        }
      }
    } catch (error) {
      console.error('[Auth] Error al verificar autenticación persistida:', error);
      await signOut();
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(email: string, contrasenia: string) {
    setIsLoading(true);
    try {
      const data = await api.login({ email, contrasenia });
      setToken(data.token);
      setUser(data.user);
      
      await storage.setItem('authToken', data.token);
      await storage.setItem('authUser', JSON.stringify(data.user));
    } catch (error) {
      console.error('[Auth] Error en signIn:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function signUp(nombre: string, email: string, contrasenia: string, codigoStaff?: string) {
    setIsLoading(true);
    try {
      const data = await api.register({ nombre, email, contrasenia, codigoStaff });
      setToken(data.token);
      setUser(data.user);
      
      await storage.setItem('authToken', data.token);
      await storage.setItem('authUser', JSON.stringify(data.user));
    } catch (error) {
      console.error('[Auth] Error en signUp:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (Platform.OS === 'web') {
      throw new Error('El inicio de sesión con Google no está disponible en la versión web.');
    }
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      
      if (response.type === 'success') {
        const idToken = response.data.idToken;
        if (!idToken) {
          throw new Error('No se recibió el ID Token de Google.');
        }
        
        const data = await api.loginGoogle(idToken);
        setToken(data.token);
        setUser(data.user);
        
        await SecureStore.setItemAsync('authToken', data.token);
        await SecureStore.setItemAsync('authUser', JSON.stringify(data.user));
      } else {
        throw { code: 'SIGN_IN_CANCELLED', message: 'Inicio de sesión cancelado por el usuario.' };
      }
    } catch (error: any) {
      if (error?.code === 'SIGN_IN_CANCELLED' || error?.code === '12501') {
        console.log('[Auth] Google Sign-in cancelled by user');
      } else {
        console.error('[Auth] Error en signInWithGoogle:', error);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    setIsLoading(true);
    try {
      setToken(null);
      setUser(null);
      await storage.deleteItem('authToken');
      await storage.deleteItem('authUser');
      // Desloguearse también del SDK de Google si estaba logueado
      try {
        if (GoogleSignin.hasPreviousSignIn()) {
          await GoogleSignin.signOut();
        }
      } catch (e) {
        console.warn('[Auth] Error al desloguearse de Google:', e);
      }
    } catch (error) {
      console.error('[Auth] Error en signOut:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator size="small" color="#4F46E5" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
