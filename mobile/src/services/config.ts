import { Platform } from 'react-native';

// URL base del servidor Oracle Cloud (producción)
const ORACLE_CLOUD_URL = 'http://137.131.245.249';

/**
 * Determina la URL del backend según la plataforma.
 *
 * - Web producción: ruta relativa vacía (Nginx proxy /api/ → Flask).
 * - Web desarrollo local: apunta al Flask local en puerto 8080.
 * - Android/iOS nativo: apunta directamente al servidor Oracle Cloud.
 */
const getBackendUrl = (): string => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8080';
      }
      // Producción web: ruta relativa → Nginx proxy
      return '';
    }
  }

  // Android / iOS nativo → Oracle Cloud directo
  return ORACLE_CLOUD_URL;
};

export const API_BASE_URL = getBackendUrl();

console.log('[ventasRF] Backend URL:', API_BASE_URL || '(relative — Nginx proxy)');

