import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key) || null;
      } catch (e) {
        console.error('Error reading from localStorage:', e);
        return null;
      }
    } else {
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    }
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error('Error removing from localStorage:', e);
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        // Ignorar si el item no existe
      }
    }
  }
};
