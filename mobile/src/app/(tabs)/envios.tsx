import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  Pressable, 
  ActivityIndicator, 
  Linking, 
  Alert,
  Platform
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Pedido } from '../../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Phone, 
  MessageCircle, 
  MapPin, 
  CheckCircle, 
  Clock, 
  Calendar,
  Flame,
  ShoppingBag,
  Info
} from 'lucide-react-native';

export default function EnviosScreen() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-25'); // Default 25 de Mayo

  // Obtener pedidos de tipo 'envio' que no estén Entregados
  const { data: envios, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['envios', selectedDate],
    queryFn: () => api.getEnviosPendientes(selectedDate === 'all' ? undefined : selectedDate),
  });

  // Mutación para cambiar el estado a 'Entregado' directamente
  const markAsDeliveredMutation = useMutation({
    mutationFn: (id: number) => api.cambiarEstado(id, 'Entregado'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: () => {
      Alert.alert('Error', 'No se pudo actualizar el estado del pedido.');
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Error', 'No se pudo iniciar la llamada.');
    });
  };

  const handleWhatsApp = (pedido: Pedido) => {
    const cleanPhone = pedido.telefono.replace(/[^\d]/g, '');
    
    const totalPastelitos = pedido.cantidad_pastelito_batata + pedido.cantidad_pastelito_membrillo;
    let productsText = '';
    if (pedido.cantidad_locro > 0) productsText += `\n- ${pedido.cantidad_locro} porciones de Locro`;
    if (totalPastelitos > 0) productsText += `\n- ${totalPastelitos} Pastelitos`;

    const message = `Hola ${pedido.nombre_cliente}, te escribimos de Ventas RF. Tu pedido está en camino a tu domicilio (${pedido.direccion}). ${productsText}\nTotal: ${formatCurrency(pedido.monto_total)} (${pedido.pagado ? 'Cobrado' : 'A cobrar'}). ¡Muchas gracias!`;
    const encodedMessage = encodeURIComponent(message);
    
    const countryCode = cleanPhone.startsWith('54') ? '' : '549';
    
    Linking.openURL(`https://wa.me/${countryCode}${cleanPhone}?text=${encodedMessage}`).catch(() => {
      Alert.alert('Error', 'No se pudo abrir WhatsApp.');
    });
  };

  const handleMaps = (address: string) => {
    const query = encodeURIComponent(address);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {
      Alert.alert('Error', 'No se pudo abrir Google Maps.');
    });
  };

  const renderEnvioItem = ({ item }: { item: Pedido }) => {
    const totalPastelitos = item.cantidad_pastelito_batata + item.cantidad_pastelito_membrillo;
    return (
      <View style={styles.envioCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.clientName}>{item.nombre_cliente}</Text>
            {item.horario_entrega ? (
              <View style={styles.timeContainer}>
                <Clock size={12} color="#D97706" style={{ marginRight: 4 }} />
                <Text style={styles.timeText}>{item.horario_entrega}</Text>
              </View>
            ) : (
              <Text style={styles.timeTextEmpty}>Sin horario preferido</Text>
            )}
          </View>
          <View style={[styles.paymentBadge, item.pagado ? styles.paymentBadgePaid : styles.paymentBadgePending]}>
            <Text style={[styles.paymentBadgeText, item.pagado ? styles.paymentBadgeTextPaid : styles.paymentBadgeTextPending]}>
              {item.pagado ? 'Cobrado' : 'A Cobrar'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.addressRow}>
          <MapPin size={16} color="#64748B" style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={styles.addressText}>{item.direccion}</Text>
        </View>

        {/* Resumen de Productos */}
        <View style={styles.productsRow}>
          {item.cantidad_locro > 0 && (
            <View style={[styles.productBadge, { borderColor: '#FCA5A5' }]}>
              <Flame size={12} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.productBadgeText}>Locro: {item.cantidad_locro}</Text>
            </View>
          )}
          {totalPastelitos > 0 && (
            <View style={[styles.productBadge, { borderColor: '#FCD34D' }]}>
              <ShoppingBag size={12} color="#D97706" style={{ marginRight: 4 }} />
              <Text style={styles.productBadgeText}>Pastelitos: {totalPastelitos}</Text>
            </View>
          )}
        </View>

        {item.notas ? (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notas de entrega</Text>
            <Text style={styles.notesText}>{item.notas}</Text>
          </View>
        ) : null}

        <View style={styles.cardDivider} />

        {/* Acciones de Reparto */}
        <View style={styles.actionsRow}>
          {/* Llamada */}
          <Pressable 
            onPress={() => handleCall(item.telefono)}
            style={({ pressed }) => [
              styles.actionIconButton,
              { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
              pressed && styles.buttonPressed
            ]}
          >
            <Phone size={16} color="#3B82F6" />
          </Pressable>

          {/* WhatsApp */}
          <Pressable 
            onPress={() => handleWhatsApp(item)}
            style={({ pressed }) => [
              styles.actionIconButton,
              { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
              pressed && styles.buttonPressed
            ]}
          >
            <MessageCircle size={16} color="#10B981" />
          </Pressable>

          {/* Mapa */}
          <Pressable 
            onPress={() => handleMaps(item.direccion)}
            style={({ pressed }) => [
              styles.actionIconButton,
              { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
              pressed && styles.buttonPressed
            ]}
          >
            <MapPin size={16} color="#D97706" />
          </Pressable>

          {/* Botón Entregado */}
          <Pressable 
            onPress={() => {
              Alert.alert(
                'Entregar Pedido',
                `¿Marcar el pedido de ${item.nombre_cliente} como Entregado?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { 
                    text: 'Confirmar', 
                    style: 'default',
                    onPress: () => markAsDeliveredMutation.mutate(item.id)
                  }
                ]
              );
            }}
            style={({ pressed }) => [
              styles.deliverButton,
              pressed && styles.buttonPressed
            ]}
          >
            <CheckCircle size={14} color="#FFFFFF" style={{ marginRight: 6 }} strokeWidth={3} />
            <Text style={styles.deliverButtonText}>Entregado</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const datesList = [
    { label: '25 de Mayo', value: '2026-05-25' },
    { label: '1 de Mayo', value: '2026-05-01' },
    { label: 'Todos', value: 'all' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Selector de Evento */}
      <View style={styles.selectorContainer}>
        {datesList.map((d) => (
          <Pressable
            key={d.value}
            onPress={() => setSelectedDate(d.value)}
            style={({ pressed }) => [
              styles.selectorChip,
              selectedDate === d.value && styles.selectorChipActive,
              pressed && styles.buttonPressed
            ]}
          >
            <Calendar 
              size={14} 
              color={selectedDate === d.value ? '#FFFFFF' : '#718096'} 
              style={{ marginRight: 6 }} 
            />
            <Text style={[
              styles.selectorChipText,
              selectedDate === d.value && styles.selectorChipTextActive
            ]}>
              {d.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Listado */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={styles.infoText}>Cargando hoja de ruta...</Text>
        </View>
      ) : (
        <FlatList
          data={envios}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderEnvioItem}
          contentContainerStyle={styles.listContent}
          onRefresh={refetch}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Info size={28} color="#94A3B8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No hay envíos pendientes para esta fecha.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  selectorContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    gap: 10,
  },
  selectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  selectorChipActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  selectorChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  selectorChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 90, // Evitar solapamiento con la pestaña flotante
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  infoText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  envioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
  },
  timeTextEmpty: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  paymentBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  paymentBadgePaid: {
    backgroundColor: '#ECFDF5',
  },
  paymentBadgePending: {
    backgroundColor: '#FEF2F2',
  },
  paymentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  paymentBadgeTextPaid: {
    color: '#10B981',
  },
  paymentBadgeTextPending: {
    color: '#EF4444',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  productsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  productBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  productBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  notesContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#94A3B8',
  },
  notesLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 12,
    color: '#334155',
    marginTop: 3,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliverButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  deliverButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  }
});
