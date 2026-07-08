import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { RefreshCw, LogOut } from 'lucide-react-native';
import { useAuth } from '../stores/auth';
import { useQueryClient } from '@tanstack/react-query';

export function GlobalHeader() {
  const { user, signOut, viewAsCustomer, setViewAsCustomer } = useAuth();
  const queryClient = useQueryClient();

  const isRealCustomer = user?.rol === 'customer' || user?.rol === 'user';
  if (isRealCustomer) {
    return null; // El cliente no necesita ver esta barra superior
  }

  const adminUserInitial = user?.nombre?.charAt(0)?.toUpperCase() ?? '?';
  const adminFirstName = user?.nombre?.split(' ')[0] ?? 'Admin';

  return (
    <View style={styles.customerHeader}>
      {/* Avatar con inicial */}
      <View style={styles.customerAvatar}>
        <Text style={styles.customerAvatarText}>{adminUserInitial}</Text>
      </View>
      {/* Saludo y marca */}
      <View style={styles.customerHeaderText}>
        <Text style={styles.customerHeaderGreeting}>¡Hola, {adminFirstName}! 👋</Text>
        <Text style={styles.customerHeaderBrand}>Panel de Gestión</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          onPress={() => {
            const newValue = !viewAsCustomer;
            setViewAsCustomer(newValue);
            if (newValue) {
              // Si cambia a vista cliente, lo llevamos a Inicio
              require('expo-router').router.push('/(tabs)/resumen');
            } else {
              // Si cambia a vista gestión, lo llevamos a Pedidos
              require('expo-router').router.push('/(tabs)/');
            }
          }}
          style={({ pressed }) => [
            styles.toggleViewButton,
            pressed && styles.buttonPressed,
            viewAsCustomer && styles.toggleViewButtonActive
          ]}
        >
          <Text style={[styles.toggleViewButtonText, viewAsCustomer && styles.toggleViewButtonTextActive]}>
            {viewAsCustomer ? 'Vista Gestión' : 'Vista Cliente'}
          </Text>
        </Pressable>
        <Pressable 
          onPress={() => queryClient.invalidateQueries()} 
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.buttonPressed
          ]}
        >
          <RefreshCw size={18} color="#4A5568" />
        </Pressable>
        <Pressable 
          onPress={() => signOut()} 
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.buttonPressed
          ]}
        >
          <LogOut size={18} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  customerHeaderText: {
    flex: 1,
  },
  customerHeaderGreeting: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  customerHeaderBrand: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleViewButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleViewButtonActive: {
    backgroundColor: '#4F46E5',
  },
  toggleViewButtonText: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleViewButtonTextActive: {
    color: '#FFFFFF',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
