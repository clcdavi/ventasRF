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
  Platform
} from 'react-native';
import { useEffect } from 'react';

import { API_BASE_URL } from '../../services/config';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { 
  Search, 
  Check, 
  Info,
  Flame,
  ShoppingBag,
  Phone,
  ChevronDown,
  Calendar,
  Plus,
  Truck
} from 'lucide-react-native';
import { api, PaginatedPedidos } from '../../services/api';
import { Pedido } from '../../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../stores/auth';
import { formatDateToLabel } from '../../utils/date';
import { CustomDropdown } from '../../components/CustomDropdown';

export default function PedidosScreen() {
  const queryClient = useQueryClient();
  const { user, viewAsCustomer } = useAuth();
  const isCustomer = user?.rol === 'customer' || user?.rol === 'user' || viewAsCustomer;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEstado, setSelectedEstado] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [activeOrderForStatus, setActiveOrderForStatus] = useState<Pedido | null>(null);

  const { 
    data: pedidosData, 
    isLoading, 
    refetch, 
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['pedidos', selectedEstado, selectedDate, searchQuery, isCustomer],
    queryFn: async ({ pageParam = 1 }) => {
      if (isCustomer) {
        const data = await api.getMisPedidos();
        return { data, total: data.length, page: 1, pages: 1 } as PaginatedPedidos;
      }
      return api.getPedidos({
          estado: selectedEstado || undefined,
          fecha: selectedDate === 'all' ? undefined : selectedDate,
          q: searchQuery || undefined,
          page: pageParam,
          limit: 15,
      }) as Promise<PaginatedPedidos>;
    },
    getNextPageParam: (lastPage) => {
      if (isCustomer || Array.isArray(lastPage)) return undefined;
      const paginated = lastPage as PaginatedPedidos;
      return paginated.page < paginated.pages ? paginated.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const pedidos = isCustomer 
    ? ((pedidosData?.pages[0] as unknown as PaginatedPedidos)?.data) || []
    : (pedidosData?.pages.flatMap(page => (page as PaginatedPedidos).data) || []);

  const totalPedidos = isCustomer
    ? pedidos.length
    : (pedidosData?.pages?.[0] as unknown as PaginatedPedidos)?.total ?? 0;

  const activePedido = isCustomer ? pedidos?.find((p: any) => p.estado !== 'Entregado') : null;


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
              {typeof item.fecha_pedido === 'string' && item.fecha_pedido.trim() !== '' ? (
                <View style={[styles.phoneRow, { marginTop: 2 }]}>
                  <Calendar size={10} color="#94A3B8" style={{ marginRight: 4 }} />
                  <Text style={styles.clientPhone}>{formatDateToLabel(item.fecha_pedido.substring(0, 10))}</Text>
                </View>
              ) : null}
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
            <Text style={[styles.addressText, item.direccion_editada && { color: '#D97706', fontWeight: 'bold' }]} numberOfLines={1}>
              {item.tipo_entrega === 'envio' ? `🛵 Enviar a: ${item.direccion}` : '⛪ Retira en Iglesia'}
              {item.direccion_editada ? ' (Editada)' : ''}
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
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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

      {!isCustomer && (
        <View style={styles.filterDateRow}>
          <View style={{ flex: 1, paddingHorizontal: 20, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.dateLabel}>Filtrar por evento</Text>
              {!isLoading && (
                <View style={styles.counterBadge}>
                  <Text style={styles.counterBadgeText}>
                    {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
            <Pressable 
              style={styles.dropdownButton}
              onPress={() => setIsDateDropdownOpen(true)}
            >
              <Calendar size={18} color="#4F46E5" style={{ marginRight: 8 }} />
              <Text style={styles.dropdownButtonText}>
                {selectedDate === 'all' 
                  ? 'Todos los eventos' 
                  : datesList.find(d => d.value === selectedDate)?.label || 'Seleccionar...'}
              </Text>
              <ChevronDown size={18} color="#94A3B8" style={{ marginLeft: 'auto' }} />
            </Pressable>
          </View>
        </View>
      )}

      <CustomDropdown
        visible={isDateDropdownOpen}
        title="Filtrar por Evento"
        options={[
          { label: 'Todos los eventos', value: 'all' },
          ...datesList.map(d => ({ label: d.label, value: d.value }))
        ]}
        selectedValue={selectedDate}
        onSelect={(val) => {
          setSelectedDate(val as string);
          setIsDateDropdownOpen(false);
        }}
        onClose={() => setIsDateDropdownOpen(false)}
      />

      {!isCustomer && (
        <View style={styles.actionButtonsContainer}>
          <Pressable onPress={() => router.push('/pedidos/nuevo')} style={styles.actionBtnPrimary}>
            <Plus size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnPrimaryText}>Nuevo Pedido</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/admin/productos')} style={styles.actionBtnSecondary}>
            <ShoppingBag size={16} color="#4F46E5" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnSecondaryText}>Productos</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/envios')} style={styles.actionBtnSecondary}>
            <Truck size={16} color="#4F46E5" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnSecondaryText}>Ver Reparto</Text>
          </Pressable>
        </View>
      )}

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

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={styles.loaderText}>Cargando pedidos...</Text>
        </View>
      ) : (
        <FlatList
          data={isCustomer ? pedidos.filter(p => p.id !== activePedido?.id) : pedidos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPedidoItem}
          contentContainerStyle={styles.listContent}
          onRefresh={refetch}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            isCustomer ? (
              <View style={{ marginBottom: 20 }}>
                {activePedido ? (
                  <View>
                    <Text style={styles.sectionTitleTracker}>Seguimiento de tu Pedido Activo</Text>
                    <View style={styles.activeOrderCard}>
                      <View style={styles.activeOrderHeader}>
                        <Text style={styles.activeOrderId}>Pedido #{activePedido.id}</Text>
                        <Text style={styles.activeOrderDate}>Fecha: {activePedido.fecha_pedido}</Text>
                      </View>

                      {/* Progress bar */}
                      <View style={styles.progressTracker}>
                        {['Pendiente', 'En preparación', 'En reparto', 'Entregado'].map((stage, idx) => {
                          const stagesList = ['Pendiente', 'En preparación', 'En envío', 'Entregado'];
                          const activeIndex = stagesList.indexOf(activePedido.estado);
                          const isCompleted = idx <= activeIndex;
                          const isCurrent = idx === activeIndex;

                          return (
                            <View key={stage} style={styles.progressStep}>
                              <View style={styles.stepCircleWrapper}>
                                {idx > 0 && (
                                  <View style={[styles.stepLine, idx <= activeIndex && styles.stepLineCompleted]} />
                                )}
                                <View style={[
                                  styles.stepCircle, 
                                  isCompleted && styles.stepCircleCompleted,
                                  isCurrent && styles.stepCircleCurrent
                                ]}>
                                  {isCompleted && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
                                </View>
                              </View>
                              <Text style={[
                                styles.stepLabel, 
                                isCompleted && styles.stepLabelCompleted,
                                isCurrent && styles.stepLabelCurrent
                              ]}>
                                {stage}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      <View style={styles.activeOrderFooter}>
                        <Text style={styles.activeOrderTotalLabel}>Total a pagar</Text>
                        <Text style={styles.activeOrderTotalValue}>
                          {formatCurrency(activePedido.monto_total)} ({activePedido.pagado ? 'Cobrado' : 'A cobrar'})
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noActiveOrderContainer}>
                    <Info size={20} color="#94A3B8" style={{ marginRight: 8 }} />
                    <Text style={styles.noActiveOrderText}>No tienes pedidos activos en este momento.</Text>
                  </View>
                )}
                {pedidos && pedidos.length > (activePedido ? 1 : 0) && (
                  <Text style={[styles.sectionTitleTracker, { marginTop: 24 }]}>Historial de Pedidos</Text>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            (!isCustomer || pedidos.length === 0) ? (
              <View style={styles.emptyContainer}>
                <Info size={28} color="#94A3B8" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyText}>
                  {isCustomer 
                    ? 'Aún no tienes pedidos registrados en tu historial.' 
                    : 'No se encontraron pedidos con estos filtros.'}
                </Text>
                {isCustomer && (
                  <Pressable
                    style={{ marginTop: 20, backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                    onPress={() => router.push('/pedidos/nuevo')}
                  >
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Hacer un Pedido</Text>
                  </Pressable>
                )}
              </View>
            ) : null
          }
          onEndReached={() => {
            if (hasNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color="#4F46E5" />
              </View>
            ) : null
          }
        />
      )}

      <CustomDropdown
        visible={statusModalVisible}
        title="Cambiar Estado"
        options={estadosList.map(est => ({ label: est, value: est }))}
        selectedValue={activeOrderForStatus?.estado || ''}
        onSelect={(val) => {
          if (activeOrderForStatus) {
            cambiarEstadoMutation.mutate({ id: activeOrderForStatus.id, estado: val as string });
          }
          setStatusModalVisible(false);
        }}
        onClose={() => setStatusModalVisible(false)}
      />

      {isCustomer && (
        <Pressable 
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => router.push('/pedidos/nuevo')}
        >
          <Plus size={24} color="#FFFFFF" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  sectionTitleTracker: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  activeOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    ...Platform.select({
      ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  activeOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activeOrderId: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeOrderDate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  progressTracker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: 12,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  stepLine: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#E2E8F0',
    left: '-50%',
    right: '50%',
    top: 8,
    zIndex: -1,
  },
  stepLineCompleted: {
    backgroundColor: '#4F46E5',
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  stepCircleCompleted: {
    backgroundColor: '#4F46E5',
  },
  stepCircleCurrent: {
    backgroundColor: '#4F46E5',
    borderWidth: 3,
    borderColor: '#C7D2FE',
  },
  stepLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  stepLabelCompleted: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  stepLabelCurrent: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  activeOrderFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeOrderTotalLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  activeOrderTotalValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  noActiveOrderContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noActiveOrderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  searchOuter: {
    paddingHorizontal: 20,
    marginTop: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  counterBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dropdownButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#4F46E5',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 150,
  },
  cardOuter: {
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#F1F5F9',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  actionBtnPrimary: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnSecondaryText: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 999,
  },
  fabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  }
});
