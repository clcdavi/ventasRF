import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Minus, Plus, Save, Info, X, Check } from 'lucide-react-native';
import { CustomAlert } from '../../components/CustomAlert';

export default function EditarPedidoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedidoId = parseInt(id || '0', 10);

  // Cargar productos
  const { data: productos = [] } = useQuery({
    queryKey: ['productos', 'activos'],
    queryFn: () => api.getProductos(true),
  });

  // Cargar detalles del pedido original
  const { data: pedido, isLoading: isLoadingPedido, isError } = useQuery({
    queryKey: ['pedido', 'edit', pedidoId],
    queryFn: () => api.getPedidoDetail(pedidoId),
    enabled: pedidoId > 0,
  });

  // Estados del Formulario
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'envio' | 'retiro'>('envio');
  const [horario, setHorario] = useState('');
  const [medioPago, setMedioPago] = useState('efectivo');
  const [pagado, setPagado] = useState(false);
  const [fecha, setFecha] = useState('2026-05-25');
  const [estado, setEstado] = useState('Pendiente');
  const [notas, setNotas] = useState('');
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onClose?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info'
  });

  // items[producto_id] = cantidad
  const [items, setItems] = useState<Record<number, number>>({});

  // Poblar formulario cuando se carga el pedido
  useEffect(() => {
    if (pedido) {
      setNombre(pedido.nombre_cliente);
      setTelefono(pedido.telefono);
      setEmail(pedido.email || '');
      setDireccion(pedido.direccion);
      if (pedido.tipo_entrega === 'envio' || pedido.tipo_entrega === 'retiro') {
        setTipoEntrega(pedido.tipo_entrega as 'envio' | 'retiro');
      } else {
        setTipoEntrega('envio');
      }
      setHorario(pedido.horario_entrega || '');
      setMedioPago(pedido.medio_pago);
      setPagado(pedido.pagado);
      setFecha(pedido.fecha_pedido ? pedido.fecha_pedido.substring(0, 10) : '2026-05-25');
      setEstado(pedido.estado);
      setNotas(pedido.notas || '');

      if (pedido.items) {
        const loadedItems: Record<number, number> = {};
        pedido.items.forEach(it => {
          loadedItems[it.producto_id] = it.cantidad;
        });
        setItems(loadedItems);
      }
    }
  }, [pedido]);

  // Auto-completar dirección si es retiro
  useEffect(() => {
    if (tipoEntrega === 'retiro') {
      setDireccion('Retiro en Iglesia');
      setHorario('');
    }
  }, [tipoEntrega]);

  const handleQtyChange = (productoId: number, change: number) => {
    setItems(prev => {
      const current = prev[productoId] || 0;
      const next = Math.max(0, current + change);
      return { ...prev, [productoId]: next };
    });
  };

  const total = productos.reduce((sum, p) => {
    const cant = items[p.id] || 0;
    return sum + (cant * p.precio);
  }, 0);

  const totalCantidades = Object.values(items).reduce((sum, cant) => sum + cant, 0);

  // Mutación para editar el pedido
  const editMutation = useMutation({
    mutationFn: (payload: any) => api.editarPedido(pedidoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      showAlert('Éxito', 'Pedido actualizado correctamente.', 'success', () => router.back());
    },
    onError: (err: any) => {
      showAlert('Error', err.message || 'No se pudo actualizar el pedido.', 'error');
    }
  });

  const showAlert = (title: string, msg: string, type: 'success' | 'error' | 'info' = 'info', onCloseCb?: () => void) => {
    setAlertConfig({
      visible: true,
      title,
      message: msg,
      type,
      onClose: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        if (onCloseCb) onCloseCb();
      }
    });
  };

  const handleSubmit = () => {
    if (!nombre.trim()) return showAlert('Validación', 'El nombre del cliente es obligatorio.', 'error');
    if (!telefono.trim()) return showAlert('Validación', 'El teléfono es obligatorio.', 'error');
    if (!direccion.trim()) return showAlert('Validación', 'La dirección es obligatoria.', 'error');
    if (totalCantidades === 0) return showAlert('Validación', 'Debes agregar al menos un producto.', 'error');
    if (!fecha.trim()) return showAlert('Validación', 'La fecha del evento es obligatoria.', 'error');

    const payloadItems = Object.entries(items)
      .filter(([id, cant]) => cant > 0)
      .map(([id, cant]) => ({ producto_id: parseInt(id), cantidad: cant }));

    const payload = {
      nombre_cliente: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim() || undefined,
      direccion: direccion.trim(),
      items: payloadItems,
      medio_pago: medioPago,
      tipo_entrega: tipoEntrega,
      horario_entrega: horario.trim() || undefined,
      fecha_pedido: fecha.trim(),
      notas: notas.trim() || undefined,
      pagado,
      estado
    };

    editMutation.mutate(payload);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  if (isLoadingPedido) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color="#111111" />
        <Text style={styles.infoText}>Cargando pedido original...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <Info size={32} color="#787774" style={{ marginBottom: 10 }} />
        <Text style={styles.infoText}>No se pudo cargar el pedido. Verifica tu conexión.</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <CustomAlert 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={alertConfig.onClose || (() => setAlertConfig(prev => ({ ...prev, visible: false })))}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Sección Datos Personales */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos del Cliente</Text>
          
          <Text style={styles.label}>Nombre y Apellido *</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ej: Juan Pérez"
            placeholderTextColor="#787774"
          />

          <Text style={styles.label}>Teléfono *</Text>
          <TextInput
            style={styles.input}
            value={telefono}
            onChangeText={setTelefono}
            placeholder="Ej: 3416554433"
            keyboardType="phone-pad"
            placeholderTextColor="#787774"
          />

          <Text style={styles.label}>Email (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Ej: cliente@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#787774"
          />
        </View>

        {/* Sección Entrega */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Modalidad de Entrega</Text>
          
          <View style={styles.pickerRow}>
            <Pressable
              onPress={() => setTipoEntrega('envio')}
              style={[styles.pickerButton, tipoEntrega === 'envio' && styles.pickerButtonActive]}
            >
              <Text style={[styles.pickerButtonText, tipoEntrega === 'envio' && styles.pickerButtonTextActive]}>
                Envío a domicilio
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTipoEntrega('retiro')}
              style={[styles.pickerButton, tipoEntrega === 'retiro' && styles.pickerButtonActive]}
            >
              <Text style={[styles.pickerButtonText, tipoEntrega === 'retiro' && styles.pickerButtonTextActive]}>
                Retiro en Iglesia
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Dirección *</Text>
          <TextInput
            style={[styles.input, tipoEntrega === 'retiro' && styles.inputDisabled]}
            value={direccion}
            onChangeText={setDireccion}
            placeholder={tipoEntrega === 'retiro' ? 'Retiro en Iglesia' : 'Ej: Calle Falsa 123, Piso 2'}
            editable={tipoEntrega === 'envio'}
            placeholderTextColor="#787774"
          />

          {tipoEntrega === 'envio' && (
            <>
              <Text style={styles.label}>Horario preferido (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={horario}
                onChangeText={setHorario}
                placeholder="Ej: De 12:00 a 14:00"
                placeholderTextColor="#787774"
              />
            </>
          )}
        </View>

        {/* Cantidades / Productos */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Productos</Text>
          
          {productos.length === 0 ? (
            <Text style={{ fontSize: 13, color: '#787774' }}>Cargando productos...</Text>
          ) : (
            productos.map(p => (
              <View key={p.id} style={styles.productRow}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{p.nombre}</Text>
                  <Text style={styles.productPrice}>{formatCurrency(p.precio)} {p.descripcion ? `- ${p.descripcion}` : ''}</Text>
                </View>
                <View style={styles.qtyContainer}>
                  <Pressable onPress={() => handleQtyChange(p.id, -1)} style={styles.qtyBtn}>
                    <Minus size={12} color="#111111" />
                  </Pressable>
                  <Text style={styles.qtyValue}>{items[p.id] || 0}</Text>
                  <Pressable onPress={() => handleQtyChange(p.id, 1)} style={styles.qtyBtn}>
                    <Plus size={12} color="#111111" />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Pago y Configuración */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Información de Pago y Fecha</Text>

          <Text style={styles.label}>Fecha del evento (YYYY-MM-DD) *</Text>
          <TextInput
            style={styles.input}
            value={fecha}
            onChangeText={setFecha}
            placeholder="Ej: 2026-05-25"
            placeholderTextColor="#787774"
          />
          
          <Text style={styles.label}>Medio de Pago</Text>
          <View style={styles.pickerRow}>
            {['efectivo', 'transferencia'].map((method) => (
              <Pressable
                key={method}
                onPress={() => setMedioPago(method)}
                style={[styles.pickerButton, medioPago === method && styles.pickerButtonActive, { flex: 1 }]}
              >
                <Text style={[styles.pickerButtonText, medioPago === method && styles.pickerButtonTextActive, { textTransform: 'capitalize' }]}>
                  {method}
                </Text>
              </Pressable>
            ))}
          </View>

          {medioPago === 'transferencia' && (
            <View style={{ backgroundColor: '#f9f9f8', padding: 12, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#eaeaea', marginBottom: 10 }}>
              <Text style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>Alias: <Text style={{fontWeight: 'bold'}}>buffet.rf</Text></Text>
              <Text style={{ fontSize: 13, color: '#334155' }}>Comprobante al: <Text style={{fontWeight: 'bold'}}>11 6464-0003</Text></Text>
            </View>
          )}

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>¿Está cobrado?</Text>
              <Text style={styles.toggleSublabel}>Marca si el cliente ya abonó el pedido</Text>
            </View>
            <Pressable 
              onPress={() => setPagado(prev => !prev)}
              style={[styles.switch, pagado && styles.switchActive]}
            >
              <View style={[styles.switchKnob, pagado && styles.switchKnobActive]} />
            </Pressable>
          </View>

          <Text style={styles.label}>Estado del Pedido</Text>
          <View style={styles.estadoContainer}>
            {['Pendiente', 'En preparación', 'Entregado'].map((st) => (
              <Pressable
                key={st}
                onPress={() => setEstado(st)}
                style={[
                  styles.estadoChip,
                  estado === st && styles.estadoChipActive,
                  estado === st && st === 'Entregado' && styles.estadoChipEntregado
                ]}
              >
                <Text style={[
                  styles.estadoText,
                  estado === st && styles.estadoTextActive
                ]}>
                  {st}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Notas adicionales</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notas}
            onChangeText={setNotas}
            placeholder="Ej: Tocar timbre fuerte, dejar en portería, etc."
            multiline
            numberOfLines={3}
            placeholderTextColor="#787774"
          />
        </View>

      </ScrollView>

      {/* Footer Fijo con Total y Botón Guardar */}
      <View style={styles.footer}>
        <View style={styles.totalBlock}>
          <Text style={styles.footerTotalLabel}>Total actualizado</Text>
          <Text style={styles.footerTotalValue}>{formatCurrency(total)}</Text>
        </View>
        <Pressable 
          disabled={editMutation.isPending || totalCantidades === 0}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton, 
            pressed && styles.pressed,
            (editMutation.isPending || totalCantidades === 0) && styles.submitButtonDisabled
          ]}
        >
          {editMutation.isPending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Save size={14} color="#ffffff" style={{ marginRight: 6 }} strokeWidth={2.5} />
              <Text style={styles.submitButtonText}>Guardar</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbfbfa' },
  infoText: { fontSize: 13, color: '#787774', marginTop: 10, fontFamily: 'System' },
  retryButton: { marginTop: 20, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#111111', borderRadius: 6 },
  retryButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#fbfbfa' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 110 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#787774',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#787774',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
  input: {
    height: 36,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eaeaea',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#111111',
    fontFamily: 'System',
  },
  inputDisabled: {
    backgroundColor: '#f9f9f8',
    borderColor: '#eaeaea',
    color: '#787774',
  },
  textArea: { height: 70, paddingTop: 8, textAlignVertical: 'top' },
  pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pickerButton: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eaeaea',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerButtonActive: { backgroundColor: '#111111', borderColor: '#111111' },
  pickerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#787774',
    fontFamily: 'System',
  },
  pickerButtonTextActive: { color: '#ffffff' },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1ef',
  },
  productInfo: { flex: 1 },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2f3437',
    fontFamily: 'System',
  },
  productPrice: {
    fontSize: 11,
    color: '#787774',
    marginTop: 2,
    fontFamily: 'System',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eaeaea',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f8',
  },
  qtyValue: {
    width: 30,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
    fontFamily: 'System',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f1ef',
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2f3437',
    fontFamily: 'System',
  },
  toggleSublabel: {
    fontSize: 11,
    color: '#787774',
    marginTop: 2,
    fontFamily: 'System',
  },
  switch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#eaeaea',
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: { backgroundColor: '#346538' },
  switchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffffff',
  },
  switchKnobActive: { transform: [{ translateX: 18 }] },
  estadoContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  estadoChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eaeaea',
    backgroundColor: '#ffffff',
  },
  estadoChipActive: { backgroundColor: '#111111', borderColor: '#111111' },
  estadoChipEntregado: { backgroundColor: '#346538', borderColor: '#346538' },
  estadoText: { fontSize: 11, color: '#787774', fontWeight: '500', fontFamily: 'System' },
  estadoTextActive: { color: '#ffffff', fontWeight: '600' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#eaeaea',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  totalBlock: { flex: 1 },
  footerTotalLabel: {
    fontSize: 10,
    color: '#787774',
    fontWeight: '500',
    fontFamily: 'System',
    textTransform: 'uppercase',
  },
  footerTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginTop: 2,
    fontFamily: 'System',
  },
  submitButton: {
    backgroundColor: '#111111',
    borderRadius: 6,
    height: 38,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
    fontFamily: 'System',
  },
  pressed: { opacity: 0.9 }
});
