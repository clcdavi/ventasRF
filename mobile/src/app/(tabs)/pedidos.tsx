import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TextInput, 
  Pressable, 
  ActivityIndicator, 
  Alert,
  ScrollView,
  Platform,
  Modal
} from 'react-native';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../../services/config';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { 
  Search, 
  Check, 
  Info,
  Flame,
  ShoppingBag,
  Phone,
  ChevronRight
} from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import { api } from '../../services/api';
import { Pedido } from '../../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../stores/auth';
import { formatDateToLabel } from '../../utils/date';

export default function PedidosScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isCustomer = user?.rol === 'customer' || user?.rol === 'user';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEstado, setSelectedEstado] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-25'); // Default 25 de Mayo
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [activeOrderForStatus, setActiveOrderForStatus] = useState<Pedido | null>(null);

  const { data: pedidos, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['pedidos', selectedEstado, selectedDate, searchQuery, isCustomer],
    queryFn: () => isCustomer 
      ? api.getMisPedidos()
      : api.getPedidos({
          estado: selectedEstado || undefined,
          fecha: selectedDate === 'all' ? undefined : selectedDate,
          q: searchQuery || undefined,
        }),
    // refetchInterval eliminado gracias a WebSockets
  });

  useEffect(() => {
    // Conectar a WebSocket
    const socket = io(API_BASE_URL);
    
    socket.on('connect', () => {
      console.log('Conectado al servidor WebSocket');
    });

    socket.on('pedidos_actualizados', (data) => {
      console.log('Pedidos actualizados:', data);
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  const { data: fechasPedidos = [] } = useQuery({
    queryKey: ['fechas-pedidos'],
    queryFn: () => api.getFechasPedidos(),
    enabled: !isCustomer,
  });

  React.useEffect(() => {
    if (!isCustomer && fechasPedidos.length > 0) {
      if (selectedDate !== 'all' && !fechasPedidos.includes(selectedDate)) {
        setSelectedDate(fechasPedidos[0]);
      }
    }
  }, [fechasPedidos]);

  // Mutación para cambiar el estado de pago
  const togglePaidMutation = useMutation({
    mutationFn: ({ id, pagado }: { id: number; pagado: boolean }) => api.cambiarPagado(id, pagado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err) => {
      Alert.alert('Error', 'No se pudo actualizar el estado de pago.');
    }
  });

  // Mutación para cambiar el estado del pedido
  const cambiarEstadoMutation = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) => api.cambiarEstado(id, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setStatusModalVisible(false);
      setActiveOrderForStatus(null);
    },
    onError: (err) => {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendiente': return { bg: '#FFF5F5', text: '#EF4444' };
      case 'En preparación': return { bg: '#EFF6FF', text: '#3B82F6' };
      case 'En envío': return { bg: '#FFFBEB', text: '#D97706' };
      case 'Entregado': return { bg: '#ECFDF5', text: '#10B981' };
      default: return { bg: '#F8FAFC', text: '#64748B' };
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(value);
  };

  const renderPedidoItem = ({ item }: { item: Pedido }) => {
    const statusStyle = getStatusColor(item.estado);
    return (
      <View style={styles.cardOuter}>
        <Pressable 
          style={({ pressed }) => [
            styles.pedidoCard,
            pressed && styles.cardPressed
          ]}
          onPress={() => router.push(`/pedidos/${item.id}`)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{item.nombre_cliente}</Text>
              <View style={styles.phoneRow}>
                <Phone size={10} color="#94A3B8" style={{ marginRight: 4 }} />
                <Text style={styles.clientPhone}>{item.telefono}</Text>
              </View>
            </View>
            <Pressable 
              onPress={() => {
                if (!isCustomer) {
                  setActiveOrderForStatus(item);
                  setStatusModalVisible(true);
                }
              }}
              style={({ pressed }) => [
                styles.statusBadge, 
                { backgroundColor: statusStyle.bg },
                !isCustomer && pressed && { opacity: 0.7 }
              ]}
            >
              <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.estado}</Text>
            </Pressable>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.cardBody}>
            <Text style={styles.addressText} numberOfLines={1}>
              {item.tipo_entrega === 'envio' ? `🛵 Enviar a: ${item.direccion}` : '⛪ Retira en Iglesia'}
            </Text>

            <View style={styles.productsSummary}>
              {item.items?.map((prodItem, idx) => {
                const isLocro = prodItem.producto_nombre?.toLowerCase().includes('locro');
                return (
                  <View key={idx} style={[styles.productBadge, { borderColor: isLocro ? '#FEE2E2' : '#FEF3C7', backgroundColor: isLocro ? '#FEF2F2' : '#FFFBEB' }]}>
                    {isLocro ? (
                      <Flame size={11} color="#EF4444" style={{ marginRight: 4 }} />
                    ) : (
                      <ShoppingBag size={11} color="#D97706" style={{ marginRight: 4 }} />
                    )}
                    <Text style={styles.productBadgeText}>{prodItem.producto_nombre}: {prodItem.cantidad}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.totalLabel}>TOTAL DEL PEDIDO</Text>
              <Text style={styles.totalValue}>{formatCurrency(item.monto_total)}</Text>
            </View>
            
            {/* Checkbox para Pago rápido */}
            <Pressable
              disabled={isCustomer}
              style={({ pressed }) => [
                styles.paidCheckboxContainer,
                !isCustomer && pressed && styles.checkboxPressed
              ]}
              onPress={() => togglePaidMutation.mutate({ id: item.id, pagado: !item.pagado })}
            >
              {item.pagado ? (
                <View style={[styles.checkbox, styles.checkboxChecked]}>
                  <Check size={10} color="#FFFFFF" strokeWidth={4} />
                </View>
              ) : (
                <View style={styles.checkbox} />
              )}
              <Text style={[styles.paidText, item.pagado && styles.paidTextActive]}>
                {item.pagado ? 'Cobrado' : 'No Cobrado'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </View>
    );
  };

  const estadosList = ['Pendiente', 'En preparación', 'En envío', 'Entregado'];
  const datesList = fechasPedidos.map(dateStr => ({
    label: formatDateToLabel(dateStr),
    value: dateStr
  })).concat([{ label: 'Todos', value: 'all' }]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Buscador de Alto Impacto Neumórfico (Inset look) */}
      {!isCustomer && (
        <View style={styles.searchOuter}>
          <View style={styles.searchContainer}>
            <Search size={18} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              placeholder="Buscar cliente, dirección o teléfono..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>
      )}

      {/* Selector de Evento */}
      {!isCustomer && (
        <View style={[styles.filterDateRow, { alignItems: 'center' }]}>
          <Text style={styles.dateLabel}>Filtrar fecha:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedDate}
              onValueChange={(itemValue) => setSelectedDate(itemValue)}
              style={styles.picker}
            >
              {datesList.map((d) => (
                <Picker.Item key={d.value} label={d.label} value={d.value} />
              ))}
            </Picker>
          </View>
        </View>
      )}

      {/* Filtros de Estado */}
      {!isCustomer && (
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <Pressable
              onPress={() => setSelectedEstado('')}
              style={({ pressed }) => [
                styles.filterChip, 
                selectedEstado === '' && styles.filterChipActive,
                pressed && styles.checkboxPressed
              ]}
            >
              <Text style={[styles.filterChipText, selectedEstado === '' && styles.filterChipTextActive]}>Todos los estados</Text>
            </Pressable>
            {estadosList.map((est) => (
              <Pressable
                key={est}
                onPress={() => setSelectedEstado(est)}
                style={({ pressed }) => [
                  styles.filterChip, 
                  selectedEstado === est && styles.filterChipActive,
                  pressed && styles.checkboxPressed
                ]}
              >
                <Text style={[styles.filterChipText, selectedEstado === est && styles.filterChipTextActive]}>{est}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Listado */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={styles.loaderText}>Cargando pedidos...</Text>
        </View>
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPedidoItem}
          contentContainerStyle={styles.listContent}
          onRefresh={refetch}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Info size={28} color="#94A3B8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No se encontraron pedidos con estos filtros.</Text>
            </View>
          }
        />
      )}

      {/* Modal para cambiar estado */}
      <Modal
        visible={statusModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setStatusModalVisible(false)}
        >
          <View style={styles.dropdownMenu}>
            <Text style={styles.modalTitle}>Cambiar Estado</Text>
            {estadosList.map((est) => (
              <Pressable
                key={est}
                onPress={() => {
                  if (activeOrderForStatus) {
                    cambiarEstadoMutation.mutate({ id: activeOrderForStatus.id, estado: est });
                  }
                }}
                style={({ pressed }) => [
                  styles.dropdownMenuItem,
                  activeOrderForStatus?.estado === est && styles.dropdownMenuItemActive,
                  pressed && { backgroundColor: '#F1F5F9' }
                ]}
              >
                <Text style={[
                  styles.dropdownMenuText,
                  activeOrderForStatus?.estado === est && styles.dropdownMenuTextActive
                ]}>
                  {est}
                </Text>
                {activeOrderForStatus?.estado === est && (
                  <Check size={16} color="#4F46E5" style={{ marginLeft: 'auto' }} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EBF0F5', // Fondo con tinte grisáceo/azulado suave para resaltar el neumorfismo
  },
  searchOuter: {
    paddingHorizontal: 20,
    marginTop: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E6ED', // Inset neumórfico (fondo ligeramente más oscuro que el fondo general)
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D9E6',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D3748',
    fontWeight: '600',
    paddingVertical: 0,
  },
  filterDateRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 10,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  pickerContainer: {
    flex: 1,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    height: 36,
    width: '100%',
    color: '#1E293B',
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 13,
    ...({ outline: 'none' } as any),
  },
  dateChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#E0E6ED',
    borderWidth: 1,
    borderColor: '#D1D9E6',
  },
  dateChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A5568',
  },
  dateChipTextActive: {
    color: '#4F46E5', // Color índigo activo en lugar de fondo negro plano
  },
  filterContainer: {
    marginTop: 14,
    marginBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#E0E6ED',
    borderWidth: 1,
    borderColor: '#D1D9E6',
  },
  filterChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A5568',
  },
  filterChipTextActive: {
    color: '#4F46E5', // Color índigo activo
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 95,
  },
  // Double-Bezel outer para lograr el efecto neumórfico extruido
  cardOuter: {
    backgroundColor: '#E6ECF5',
    borderRadius: 24,
    padding: 6,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: -4, height: -4 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
    }),
  },
  pedidoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#A3B1C6',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientInfo: {
    flex: 1,
    paddingRight: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D3748',
    letterSpacing: -0.3,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  clientPhone: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#EBF0F5',
    marginVertical: 12,
  },
  cardBody: {
    marginBottom: 8,
  },
  addressText: {
    fontSize: 13,
    color: '#4A5568',
    fontWeight: '700',
  },
  productsSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  productBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D3748',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EBF0F5',
    paddingTop: 14,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 9,
    color: '#A0AEC0',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D3748',
    marginTop: 2,
  },
  paidCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  paidText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#718096',
  },
  paidTextActive: {
    color: '#10B981',
  },
  checkboxPressed: {
    opacity: 0.7,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 14,
    color: '#718096',
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: { elevation: 10 },
    }),
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    marginLeft: 4,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 2,
  },
  dropdownMenuItemActive: {
    backgroundColor: '#EEF2FF',
  },
  dropdownMenuText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  dropdownMenuTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  }
});
