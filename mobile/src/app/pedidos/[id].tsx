import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Pressable, 
  ActivityIndicator, 
  Alert, 
  Linking,
  Platform,
  Modal,
  TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Audio } from 'expo-av';
import { api } from '../../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../stores/auth';
import { 
  Phone, 
  MessageCircle, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Clock, 
  FileText,
  User,
  Trash2,
  Edit,
  CheckCircle,
  ShoppingBag,
  Info
} from 'lucide-react-native';

export default function PedidoDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedidoId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isCustomer = user?.rol === 'customer' || user?.rol === 'user';
  const isRepartidor = user?.rol === 'repartidor';

  // Fetch detalle del pedido
  const { data: pedido, isLoading, isError } = useQuery({
    queryKey: ['pedido', pedidoId],
    queryFn: () => api.getPedidoDetail(pedidoId),
    enabled: pedidoId > 0,
    refetchInterval: isCustomer ? 10000 : false, // Poll every 10s for customers
  });

  // Audio state
  const [sound, setSound] = React.useState<Audio.Sound>();
  const prevEstadoRef = React.useRef<string | null>(null);

  // Modal state
  const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);
  const [editAddressModalVisible, setEditAddressModalVisible] = React.useState(false);
  const [editAddressValue, setEditAddressValue] = React.useState('');

  React.useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  React.useEffect(() => {
    async function playSound() {
      // Solo en celular (iOS o Android) - Platform.OS
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        try {
          const { sound: newSound } = await Audio.Sound.createAsync(
            require('../../../assets/notification.wav')
          );
          setSound(newSound);
          await newSound.playAsync();
        } catch (e) {
          console.log('Error playing sound', e);
        }
      }
    }

    if (pedido && isCustomer) {
      if (prevEstadoRef.current && prevEstadoRef.current !== pedido.estado) {
        playSound();
      }
      prevEstadoRef.current = pedido.estado;
    }
  }, [pedido?.estado, isCustomer]);

  // Mutación para cambiar pagado
  const togglePaidMutation = useMutation({
    mutationFn: (pagado: boolean) => api.cambiarPagado(pedidoId, pagado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: () => {
      Alert.alert('Error', 'No se pudo actualizar el pago.');
    }
  });

  // Mutación para cambiar estado
  const changeStatusMutation = useMutation({
    mutationFn: (estado: string) => api.cambiarEstado(pedidoId, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['envios'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'No se pudo actualizar el estado.');
    }
  });

  // Mutación para editar dirección
  const editAddressMutation = useMutation({
    mutationFn: (newAddress: string) => api.cambiarDireccion(pedidoId, newAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      setEditAddressModalVisible(false);
      Alert.alert('Éxito', 'Dirección actualizada correctamente.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'No se pudo actualizar la dirección.');
    }
  });

  // Mutación para eliminar pedido
  const deleteMutation = useMutation({
    mutationFn: () => api.eliminarPedido(pedidoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['fechas-pedidos'] });
      Alert.alert('Éxito', 'Pedido eliminado correctamente.');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Solo se pueden eliminar pedidos en estado Pendiente.');
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

  const handleCall = () => {
    if (!pedido?.telefono) return;
    const cleanPhone = pedido.telefono.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Error', 'No se pudo iniciar la llamada.');
    });
  };

  const handleWhatsApp = () => {
    if (!pedido) return;
    const cleanPhone = pedido.telefono.replace(/[^\d]/g, '');
    const countryCode = cleanPhone.startsWith('54') ? '' : '549';
    const message = `Hola ${pedido.nombre_cliente}, nos comunicamos de Ventas RF con respecto a tu pedido #${pedido.id}...`;
    Linking.openURL(`https://wa.me/${countryCode}${cleanPhone}?text=${encodeURIComponent(message)}`).catch(() => {
      Alert.alert('Error', 'No se pudo abrir WhatsApp.');
    });
  };

  const handleMaps = () => {
    if (!pedido?.direccion) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.direccion)}`).catch(() => {
      Alert.alert('Error', 'No se pudo abrir Google Maps.');
    });
  };

  const handleDelete = () => {
    setDeleteModalVisible(true);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color="#4F46E5" />
        <Text style={styles.infoText}>Cargando detalles del pedido...</Text>
      </View>
    );
  }

  if (isError || !pedido) {
    return (
      <View style={styles.centerContainer}>
        <Info size={24} color="#9f2f2d" style={{ marginBottom: 12 }} />
        <Text style={styles.errorText}>Error al cargar el pedido. Puede que haya sido eliminado.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const statusStyle = getStatusColor(pedido.estado);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Cabecera / ID y Estado */}
        <View style={styles.headerCard}>
          <View style={styles.headerInfo}>
            <Text style={styles.orderId}>Pedido #{pedido.id}</Text>
            <View style={styles.dateRow}>
              <Calendar size={12} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.dateText}>Para el: {pedido.fecha_pedido}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{pedido.estado}</Text>
          </View>
        </View>

        {/* Sección del Cliente */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <User size={14} color="#4F46E5" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Datos del Cliente</Text>
          </View>
          
          <Text style={styles.detailName}>{pedido.nombre_cliente}</Text>
          
          <View style={styles.contactButtonsRow}>
            <Pressable onPress={handleCall} style={styles.contactLinkButton}>
              <Phone size={12} color="#0F172A" style={{ marginRight: 6 }} />
              <Text style={styles.contactLinkText}>{pedido.telefono}</Text>
            </Pressable>
            <Pressable onPress={handleWhatsApp} style={styles.contactWhatsappButton}>
              <MessageCircle size={12} color="#059669" style={{ marginRight: 6 }} />
              <Text style={styles.contactWhatsappText}>WhatsApp</Text>
            </Pressable>
          </View>

          {pedido.email ? <Text style={styles.detailEmail}>{pedido.email}</Text> : null}
          
          <View style={styles.divider} />
          
          <View style={styles.addressContainer}>
            <MapPin size={14} color="#64748B" style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>{pedido.tipo_entrega === 'envio' ? 'Dirección de Envío' : 'Retiro en Iglesia'}</Text>
              <Text style={styles.addressValue}>{pedido.direccion}</Text>
              {pedido.tipo_entrega === 'envio' && (
                <Pressable onPress={handleMaps} style={styles.mapsLink}>
                  <Text style={styles.mapsLinkText}>Ver en Google Maps</Text>
                </Pressable>
              )}
            </View>
            {isCustomer && (pedido.estado === 'Pendiente' || pedido.estado === 'Confirmado') && pedido.tipo_entrega === 'envio' && (
              <Pressable
                onPress={() => {
                  setEditAddressValue(pedido.direccion);
                  setEditAddressModalVisible(true);
                }}
                style={styles.editAddressButton}
              >
                <Edit size={14} color="#4F46E5" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Detalle de Productos */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <ShoppingBag size={14} color="#4F46E5" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Detalle del Pedido</Text>
          </View>

          {pedido.items?.map((item, idx) => (
            item.cantidad > 0 ? (
              <View key={idx} style={styles.productRow}>
                <Text style={styles.productQty}>{item.cantidad}x</Text>
                <Text style={styles.productName}>{item.producto_nombre}</Text>
              </View>
            ) : null
          ))}
        </View>

        {/* Detalles del Pago */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <DollarSign size={14} color="#4F46E5" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Pago y Entrega</Text>
          </View>

          <View style={styles.paymentInfoRow}>
            <Text style={styles.paymentLabel}>Medio de pago</Text>
            <Text style={styles.paymentValue}>{pedido.medio_pago}</Text>
          </View>

          <View style={styles.paymentInfoRow}>
            <Text style={styles.paymentLabel}>Monto total</Text>
            <Text style={styles.paymentTotalValue}>{formatCurrency(pedido.monto_total)}</Text>
          </View>

          <View style={styles.paymentInfoRow}>
            <Text style={styles.paymentLabel}>Estado de pago</Text>
            <View style={[styles.paymentStatusBadge, pedido.pagado ? styles.badgePaid : styles.badgeUnpaid]}>
              <Text style={[styles.paymentStatusBadgeText, pedido.pagado ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
                {pedido.pagado ? 'Cobrado' : 'Pendiente'}
              </Text>
            </View>
          </View>

          {pedido.horario_entrega ? (
            <View style={[styles.paymentInfoRow, { marginTop: 10 }]}>
              <Text style={styles.paymentLabel}>Horario de entrega</Text>
              <View style={styles.timeBadge}>
                <Clock size={12} color="#D97706" style={{ marginRight: 4 }} />
                <Text style={styles.timeBadgeText}>{pedido.horario_entrega}</Text>
              </View>
            </View>
          ) : null}

          {pedido.notas ? (
            <View style={styles.notesBox}>
              <FileText size={14} color="#64748B" style={{ marginRight: 6, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.notesTitle}>Notas de preparación/envío</Text>
                <Text style={styles.notesText}>{pedido.notas}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Acciones del Pedido */}
        {!isCustomer && (
          <>
            <Text style={styles.sectionHeader}>Gestionar Pedido</Text>
            
            {/* Cambiar Estado del Pedido */}
            <View style={styles.actionsCard}>
              <Text style={styles.actionCardTitle}>Actualizar Estado de Preparación</Text>
              <View style={styles.statusButtonsGrid}>
                {['Pendiente', 'En preparación', 'En envío', 'Entregado'].map((st) => (
                  <Pressable
                    key={st}
                    disabled={changeStatusMutation.isPending}
                    onPress={() => changeStatusMutation.mutate(st)}
                    style={[
                      styles.statusSelectButton,
                      pedido.estado === st && styles.statusSelectButtonActive
                    ]}
                  >
                    <Text style={[
                      styles.statusSelectButtonText,
                      pedido.estado === st && styles.statusSelectButtonTextActive
                    ]}>
                      {st}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.divider} />

              {/* Botones de Cobro rápido */}
              <Pressable
                disabled={togglePaidMutation.isPending}
                onPress={() => togglePaidMutation.mutate(!pedido.pagado)}
                style={[styles.bigActionButton, pedido.pagado ? styles.btnUndoPayment : styles.btnConfirmPayment]}
              >
                <CheckCircle size={16} color={pedido.pagado ? '#DC2626' : '#ffffff'} style={{ marginRight: 8 }} strokeWidth={2.5} />
                <Text style={[styles.bigActionButtonText, pedido.pagado ? styles.btnUndoPaymentText : styles.btnConfirmPaymentText]}>
                  {pedido.pagado ? 'Marcar como No Cobrado' : 'Marcar como Cobrado'}
                </Text>
              </Pressable>
            </View>

            {/* Edición y Eliminación (Solo Admins, no Repartidores tampoco) */}
            {!isRepartidor && (
              <View style={styles.dangerZoneRow}>
                <Pressable
                  onPress={() => router.push({
                    pathname: '/pedidos/editar',
                    params: { id: pedido.id }
                  })}
                  style={styles.editButton}
                >
                  <Edit size={14} color="#0F172A" style={{ marginRight: 6 }} />
                  <Text style={styles.editButtonText}>Editar Pedido</Text>
                </Pressable>

                <Pressable
                  onPress={handleDelete}
                  style={styles.deleteButton}
                >
                  <Trash2 size={14} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.deleteButtonText}>Eliminar Pedido</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

      </ScrollView>

      {/* Modal Confirmar Eliminar */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Trash2 size={24} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Eliminar Pedido</Text>
            <Text style={styles.modalMessage}>
              ¿Estás seguro de que deseas eliminar este pedido de forma permanente? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.modalButtonsRow}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.modalDeleteButton}
                onPress={() => {
                  setDeleteModalVisible(false);
                  deleteMutation.mutate();
                }}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>Confirmar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Editar Dirección */}
      <Modal
        visible={editAddressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Dirección</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa la nueva dirección de envío.
            </Text>
            <TextInput
              style={styles.addressInput}
              value={editAddressValue}
              onChangeText={setEditAddressValue}
              placeholder="Ej. San Martín 123"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.modalButtonsRow}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setEditAddressModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.modalDeleteButton}
                onPress={() => editAddressMutation.mutate(editAddressValue)}
                disabled={editAddressMutation.isPending || !editAddressValue.trim() || editAddressValue === pedido.direccion}
              >
                {editAddressMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDeleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8FAFC',
  },
  infoText: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  headerInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  contactButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  contactLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  contactLinkText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  contactWhatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  contactWhatsappText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  detailEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  addressValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  mapsLink: {
    marginTop: 6,
  },
  mapsLinkText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '700',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productQty: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    width: 26,
  },
  productName: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  paymentLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  paymentValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  paymentTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  paymentStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgePaid: {
    backgroundColor: '#ECFDF5',
  },
  badgeUnpaid: {
    backgroundColor: '#FEF2F2',
  },
  paymentStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextPaid: {
    color: '#059669',
  },
  badgeTextUnpaid: {
    color: '#DC2626',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  notesBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 11,
    color: '#334155',
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  actionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  statusButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  statusSelectButton: {
    flex: 1,
    minWidth: '45%',
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  statusSelectButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  statusSelectButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  statusSelectButtonTextActive: {
    color: '#ffffff',
  },
  bigActionButton: {
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  btnConfirmPayment: {
    backgroundColor: '#4F46E5',
  },
  btnUndoPayment: {
    backgroundColor: '#FEF2F2',
  },
  bigActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  btnConfirmPaymentText: {
    color: '#ffffff',
  },
  btnUndoPaymentText: {
    color: '#DC2626',
  },
  dangerZoneRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  editButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  editAddressButton: {
    padding: 6,
    marginLeft: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
  }
});
