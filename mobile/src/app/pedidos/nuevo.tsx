import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput, 
  Pressable, 
  ActivityIndicator, 
  Alert,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Minus, Plus, Check, Save } from 'lucide-react-native';
import { CustomAlert } from '../../components/CustomAlert';
import { useAuth } from '../../stores/auth';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function NuevoPedidoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isCustomer = user?.rol === 'customer' || user?.rol === 'user';

  const { data: productos = [] } = useQuery({
    queryKey: ['productos', 'activos'],
    queryFn: () => api.getProductos(true),
  });

  const [isForOther, setIsForOther] = useState(false);
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [direccion, setDireccion] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'envio' | 'retiro'>('envio');
  const [horario, setHorario] = useState('');
  const [medioPago, setMedioPago] = useState('efectivo');
  const [pagado, setPagado] = useState(false);
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
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]); // Current date as default
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fechaDate, setFechaDate] = useState(new Date());
  const [notas, setNotas] = useState('');

  // items[producto_id] = cantidad
  const [items, setItems] = useState<Record<number, number>>({});

  const { data: misPedidos } = useQuery({
    queryKey: ['mis-pedidos'],
    queryFn: () => api.getMisPedidos(),
  });

  const handleToggleForOther = () => {
    if (!isForOther) {
      setNombre('');
      setTelefono('');
      setEmail('');
      setDireccion('');
    } else {
      setNombre(user?.nombre || '');
      setEmail(user?.email || '');
      setTelefono('');
      setDireccion('');
    }
    setIsForOther(!isForOther);
  };

  useEffect(() => {
    // Si no es para otro cliente y hay pedidos anteriores
    if (!isForOther && misPedidos && misPedidos.length > 0) {
      const ultimoPedido = misPedidos[0]; // Assuming they are ordered by date DESC
      
      // Auto-fill telefono if empty
      if (!telefono && ultimoPedido.telefono) {
        setTelefono(ultimoPedido.telefono);
      }
      
      // Auto-fill direccion if empty (and not setting to 'Retiro en Iglesia' if that was their last)
      if (!direccion && ultimoPedido.direccion && ultimoPedido.direccion !== 'Retiro en Iglesia') {
        setDireccion(ultimoPedido.direccion);
      }
    }
  }, [isForOther, misPedidos]);

  useEffect(() => {
    if (tipoEntrega === 'retiro') {
      setDireccion('Retiro en Iglesia');
      setHorario('');
    } else if (direccion === 'Retiro en Iglesia') {
      setDireccion('');
    }
  }, [tipoEntrega]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFechaDate(selectedDate);
      setFecha(selectedDate.toISOString().split('T')[0]);
    }
  };

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

  const createMutation = useMutation({
    mutationFn: api.crearPedido,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['mis-pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['fechas-pedidos'] });
      showAlert('Éxito', 'Pedido registrado correctamente.', 'success', () => router.back());
    },
    onError: (err: any) => {
      showAlert('Error', err.message || 'No se pudo guardar el pedido.', 'error');
    }
  });

  const showAlert = (title: string, msg: string, type: 'success' | 'error' | 'info' = 'info', onCloseCb?: () => void) => {
    if (Platform.OS === 'web' && type !== 'success') {
      window.alert(`${title}: ${msg}`);
      if (onCloseCb) onCloseCb();
      return;
    }
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
    if (!(nombre || '').trim()) return showAlert('Validación', 'El nombre del cliente es obligatorio.');
    if (!(telefono || '').trim()) return showAlert('Validación', 'El teléfono es obligatorio.');
    if (!(direccion || '').trim()) return showAlert('Validación', 'La dirección es obligatoria.');
    if (totalCantidades === 0) return showAlert('Validación', 'Debes agregar al menos un producto.');
    if (!(fecha || '').trim()) return showAlert('Validación', 'La fecha del evento es obligatoria.');

    const payloadItems = Object.entries(items)
      .filter(([id, cant]) => cant > 0)
      .map(([id, cant]) => ({ producto_id: parseInt(id), cantidad: cant }));

    const payload: any = {
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
      pagado: isCustomer ? false : pagado,
      estado: 'Pendiente'
    };

    createMutation.mutate(payload);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

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
          
          {!isCustomer && (
            <Pressable 
              style={styles.clientToggleRow}
              onPress={handleToggleForOther}
            >
              <View style={[styles.checkbox, isForOther && styles.checkboxChecked]}>
                {isForOther && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.toggleText}>Generar pedido para otro cliente</Text>
            </Pressable>
          )}
          
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
            <Text style={{ fontSize: 13, color: '#787774' }}>No hay productos activos disponibles.</Text>
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

          <Text style={styles.label}>Fecha del evento *</Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 36,
                backgroundColor: '#ffffff',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: '#eaeaea',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 13,
                color: '#111111',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          ) : (
            <>
              <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#111111', fontFamily: 'System' }}>
                    {fecha}
                  </Text>
                </View>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={fechaDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  style={{ marginTop: 10 }}
                />
              )}
            </>
          )}
          
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

          {!isCustomer && (
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
          )}

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
          <Text style={styles.footerTotalLabel}>Total a pagar</Text>
          <Text style={styles.footerTotalValue}>{formatCurrency(total)}</Text>
        </View>
        <Pressable 
          disabled={createMutation.isPending}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton, 
            pressed && styles.pressed,
            createMutation.isPending && styles.submitButtonDisabled
          ]}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Save size={14} color="#ffffff" style={{ marginRight: 6 }} strokeWidth={2.5} />
              <Text style={styles.submitButtonText}>Registrar</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  errorMsg: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  clientToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleRow: {
    flexDirection: 'row',
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
  pressed: { opacity: 0.9 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  }
});
