import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Pressable, 
  ActivityIndicator, 
  Alert, 
  Linking 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  });

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

  // Mutación para eliminar pedido
  const deleteMutation = useMutation({
    mutationFn: () => api.eliminarPedido(pedidoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      Alert.alert('Éxito', 'Pedido eliminado correctamente.');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Solo se pueden eliminar pedidos en estado Pendiente.');
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendiente': return { bg: '#fdebec', text: '#9f2f2d' }; // Pale Red
      case 'En preparación': return { bg: '#e1f3fe', text: '#026aa2' }; // Pale Blue
      case 'En envío': return { bg: '#fbf3db', text: '#956400' }; // Pale Yellow
      case 'Entregado': return { bg: '#edf3ec', text: '#346538' }; // Pale Green
      default: return { bg: '#f1f1ef', text: '#787774' };
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
    Alert.alert(
      'Eliminar Pedido',
      '¿Estás seguro de que deseas eliminar este pedido de forma permanente? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: () => deleteMutation.mutate()
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color="#111111" />
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
              <Calendar size={12} color="#787774" style={{ marginRight: 6 }} />
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
            <User size={14} color="#111111" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Datos del Cliente</Text>
          </View>
          
          <Text style={styles.detailName}>{pedido.nombre_cliente}</Text>
          
          <View style={styles.contactButtonsRow}>
            <Pressable onPress={handleCall} style={styles.contactLinkButton}>
              <Phone size={12} color="#111111" style={{ marginRight: 6 }} />
              <Text style={styles.contactLinkText}>{pedido.telefono}</Text>
            </Pressable>
            <Pressable onPress={handleWhatsApp} style={styles.contactWhatsappButton}>
              <MessageCircle size={12} color="#346538" style={{ marginRight: 6 }} />
              <Text style={styles.contactWhatsappText}>WhatsApp</Text>
            </Pressable>
          </View>

          {pedido.email ? <Text style={styles.detailEmail}>{pedido.email}</Text> : null}
          
          <View style={styles.divider} />
          
          <View style={styles.addressContainer}>
            <MapPin size={14} color="#787774" style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>{pedido.tipo_entrega === 'envio' ? 'Dirección de Envío' : 'Retiro en Iglesia'}</Text>
              <Text style={styles.addressValue}>{pedido.direccion}</Text>
              {pedido.tipo_entrega === 'envio' && (
                <Pressable onPress={handleMaps} style={styles.mapsLink}>
                  <Text style={styles.mapsLinkText}>Ver en Google Maps</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Detalle de Productos */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <ShoppingBag size={14} color="#111111" style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Detalle del Pedido</Text>
          </View>

          {pedido.cantidad_locro > 0 && (
            <View style={styles.productRow}>
              <Text style={styles.productQty}>{pedido.cantidad_locro}x</Text>
              <Text style={styles.productName}>Porción de Locro</Text>
            </View>
          )}

          {pedido.cantidad_pastelito_batata > 0 && (
            <View style={styles.productRow}>
              <Text style={styles.productQty}>{pedido.cantidad_pastelito_batata}x</Text>
              <Text style={styles.productName}>Pastelito de Batata</Text>
            </View>
          )}

          {pedido.cantidad_pastelito_membrillo > 0 && (
            <View style={styles.productRow}>
              <Text style={styles.productQty}>{pedido.cantidad_pastelito_membrillo}x</Text>
              <Text style={styles.productName}>Pastelito de Membrillo</Text>
            </View>
          )}
        </View>

        {/* Detalles del Pago */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <DollarSign size={14} color="#111111" style={{ marginRight: 8 }} />
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
                <Clock size={12} color="#956400" style={{ marginRight: 4 }} />
                <Text style={styles.timeBadgeText}>{pedido.horario_entrega}</Text>
              </View>
            </View>
          ) : null}

          {pedido.notas ? (
            <View style={styles.notesBox}>
              <FileText size={14} color="#787774" style={{ marginRight: 6, marginTop: 2 }} />
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
                <CheckCircle size={16} color={pedido.pagado ? '#9f2f2d' : '#ffffff'} style={{ marginRight: 8 }} strokeWidth={2.5} />
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
                  <Edit size={14} color="#111111" style={{ marginRight: 6 }} />
                  <Text style={styles.editButtonText}>Editar Pedido</Text>
                </Pressable>

                <Pressable
                  onPress={handleDelete}
                  style={styles.deleteButton}
                >
                  <Trash2 size={14} color="#9f2f2d" style={{ marginRight: 6 }} />
                  <Text style={styles.deleteButtonText}>Eliminar Pedido</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fbfbfa',
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
    backgroundColor: '#fbfbfa',
  },
  infoText: {
    marginTop: 8,
    color: '#787774',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'SF Pro Display',
  },
  errorText: {
    fontSize: 13,
    color: '#9f2f2d',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'SF Pro Display',
  },
  backButton: {
    backgroundColor: '#111111',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: 'SF Pro Display',
    fontSize: 13,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  headerInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    fontFamily: 'SF Pro Display',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#787774',
    fontWeight: '500',
    fontFamily: 'SF Pro Display',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'SF Pro Display',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#787774',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'SF Pro Display',
  },
  detailName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    fontFamily: 'SF Pro Display',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eaeaea',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  contactLinkText: {
    fontSize: 12,
    color: '#111111',
    fontWeight: '600',
    fontFamily: 'SF Pro Display',
  },
  contactWhatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#edf3ec',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  contactWhatsappText: {
    fontSize: 12,
    color: '#346538',
    fontWeight: '600',
    fontFamily: 'SF Pro Display',
  },
  detailEmail: {
    fontSize: 12,
    color: '#787774',
    marginTop: 6,
    fontFamily: 'SF Pro Display',
  },
  divider: {
    height: 1,
    backgroundColor: '#eaeaea',
    marginVertical: 12,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressLabel: {
    fontSize: 10,
    color: '#787774',
    fontWeight: '500',
    fontFamily: 'SF Pro Display',
  },
  addressValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2f3437',
    marginTop: 2,
    fontFamily: 'SF Pro Display',
  },
  mapsLink: {
    marginTop: 6,
  },
  mapsLinkText: {
    fontSize: 11,
    color: '#026aa2',
    fontWeight: '700',
    fontFamily: 'SF Pro Display',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1ef',
  },
  productQty: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
    width: 26,
    fontFamily: 'SF Pro Display',
  },
  productName: {
    fontSize: 12,
    color: '#2f3437',
    fontWeight: '600',
    fontFamily: 'SF Pro Display',
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  paymentLabel: {
    fontSize: 12,
    color: '#787774',
    fontWeight: '500',
    fontFamily: 'SF Pro Display',
  },
  paymentValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2f3437',
    fontFamily: 'SF Pro Display',
  },
  paymentTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    fontFamily: 'SF Pro Display',
  },
  paymentStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  badgePaid: {
    backgroundColor: '#edf3ec',
  },
  badgeUnpaid: {
    backgroundColor: '#fdebec',
  },
  paymentStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SF Pro Display',
  },
  badgeTextPaid: {
    color: '#346538',
  },
  badgeTextUnpaid: {
    color: '#9f2f2d',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbf3db',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#956400',
    fontFamily: 'SF Pro Display',
  },
  notesBox: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f8',
    borderRadius: 6,
    padding: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#787774',
    fontFamily: 'SF Pro Display',
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 11,
    color: '#2f3437',
    marginTop: 2,
    lineHeight: 14,
    fontFamily: 'SF Pro Display',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#787774',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingLeft: 4,
    fontFamily: 'SF Pro Display',
  },
  actionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2f3437',
    marginBottom: 10,
    fontFamily: 'SF Pro Display',
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
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eaeaea',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  statusSelectButtonActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  statusSelectButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#787774',
    fontFamily: 'SF Pro Display',
  },
  statusSelectButtonTextActive: {
    color: '#ffffff',
  },
  bigActionButton: {
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  btnConfirmPayment: {
    backgroundColor: '#111111',
  },
  btnUndoPayment: {
    backgroundColor: '#fdebec',
  },
  bigActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'SF Pro Display',
  },
  btnConfirmPaymentText: {
    color: '#ffffff',
  },
  btnUndoPaymentText: {
    color: '#9f2f2d',
  },
  dangerZoneRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eaeaea',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  editButtonText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'SF Pro Display',
  },
  deleteButton: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#fdebec',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  deleteButtonText: {
    color: '#9f2f2d',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'SF Pro Display',
  }
});
