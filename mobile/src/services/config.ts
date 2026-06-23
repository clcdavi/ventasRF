import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Determina la URL del backend
const getBackendUrl = () => {
  // Si estamos en la web, detectamos dinámicamente el host y usamos el puerto 8081
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      // Desarrollo local web
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8080';
      }
      return `http://${hostname}:8081`;
    }
  }

  // URL del backend real alojado en Oracle Cloud (Android/iOS nativo)
  return 'http://137.131.245.249:8081';

  // hostUri contiene la IP de la máquina de desarrollo (ej: 192.168.1.50:8081)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = (hostUri as string).split(':')[0];
    return `http://${ip}:8080`; // Puerto de Flask por defecto
  }

  // Fallbacks tradicionales
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8080'; // Acceso al localhost de la máquina desde emulador Android
  }
  return 'http://localhost:8080'; // Simulador iOS o Web
};

export const API_BASE_URL = getBackendUrl();

console.log('[ventasRF Mobile] Backend API Base URL:', API_BASE_URL);
