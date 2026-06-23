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
import { calcularTotal, DEFAULT_PRICES } from '../../utils/pricing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Minus, Plus, Save, Info } from 'lucide-react-native';

export default function EditarPedidoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedidoId = parseInt(id || '0', 10);

  // Cargar precios
  const { data: serverPrices } = useQuery({
    queryKey: ['precios'],
    queryFn: api.getPrecios,
  });
  const precios = serverPrices || DEFAULT_PRICES;

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

  // Cantidades
  const [locro, setLocro] = useState(0);
  const [batata, setBatata] = useState(0);
  const [membrillo, setMembrillo] = useState(0);

  // Poblar formulario cuando se carga el pedido
  useEffect(() => {
    if (pedido) {
      setNombre(pedido.nombre_cliente);
      setTelefono(pedido.telefono);
      setEmail(pedido.email || '');
      setDireccion(pedido.direccion);
      setTipoEntrega(pedido.tipo_entrega);
      setHorario(pedido.horario_entrega || '');
      setMedioPago(pedido.medio_pago);
      setPagado(pedido.pagado);
      setFecha(pedido.fecha_pedido);
      setEstado(pedido.estado);
      setNotas(pedido.notas || '');
      setLocro(pedido.cantidad_locro);
      setBatata(pedido.cantidad_pastelito_batata);
      setMembrillo(pedido.cantidad_pastelito_membrillo);
    }
  }, [pedido]);

  // Auto-completar dirección si es retiro
  useEffect(() => {
    if (tipoEntrega === 'retiro') {
      setDireccion('Retiro en Iglesia');
      setHorario('');
    }
  }, [tipoEntrega]);

  // Cálculo en tiempo real
  const total = calcularTotal(locro, batata, membrillo, precios);

  // Mutación para editar el pedido
  const editMutation = useMutation({
    mutationFn: (payload: any) => api.editarPedido(pedidoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      Alert.alert('Éxito', 'Pedido actualizado correctamente.');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'No se pudo actualizar el pedido.');
    }
  });

  const handleSubmit = () => {
    if (!nombre.trim()) return Alert.alert('Validación', 'El nombre del cliente es obligatorio.');
    if (!telefono.trim()) return Alert.alert('Validación', 'El teléfono es obligatorio.');
    if (!direccion.trim()) return Alert.alert('Validación', 'La dirección es obligatoria.');
    if (locro + batata + membrillo === 0) return Alert.alert('Validación', 'Debes agregar al menos un producto.');

    const payload = {
      nombre_cliente: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim() || undefined,
      direccion: direccion.trim(),
      cantidad_locro: locro,
      cantidad_pastelito_batata: batata,
      cantidad_pastelito_membrillo: membrillo,
      medio_pago: medioPago,
      tipo_entrega: tipoEntrega,
      horario_entrega: horario.trim() || undefined,
      fecha_pedido: fecha,
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

  const handleQtyChange = (product: 'locro' | 'batata' | 'membrillo', change: number) => {
    if (product === 'locro') setLocro(prev => Math.max(0, prev + change));
    if (product === 'batata') setBatata(prev => Math.max(0, prev + change));
    if (product === 'membrillo') setMembrillo(prev => Math.max(0, prev + change));
  };

  if (isLoadingPedido) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color="#111111" />
        <Text style={styles.infoText}>Cargando pedido original...</Text>
      </View>
    );
  }

  if (isError || !pedido) {
    return (
      <View style={styles.centerContainer}>
        <Info size={24} color="#9f2f2d" style={{ marginBottom: 12 }} />
        <Text style={styles.errorText}>No se pudo encontrar el pedido para editar.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Sección Datos Personales */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos del Cliente</Text>

          <Text style={styles.label}>Nombre y Apellido *</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholderTextColor="#787774"
          />

          <Text style={styles.label}>Teléfono *</Text>
          <TextInput
            style={styles.input}
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            placeholderTextColor="#787774"
          />

          <Text style={styles.label}>Email (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#787774"
          />
        </View>

        {/* Sección Estado del Pedido */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estado General</Text>
          <Text style={styles.label}>Estado del Pedido</Text>
          <View style={styles.pickerRow}>
            {['Pendiente', 'En preparación', 'En envío', 'Entregado'].map((st) => (
              <Pressable
                key={st}
                onPress={() => setEstado(st)}
                style={[
                  styles.pickerButton,
                  estado === st && styles.pickerButtonActive,
                  { minWidth: '45%', marginVertical: 4 }
                ]}
              >
                <Text style={[styles.pickerButtonText, estado === st && styles.pickerButtonTextActive]}>
                  {st}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Modalidad Entrega */}
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
            editable={tipoEntrega === 'envio'}
            placeholderTextColor="#787774"
          />

          {tipoEntrega === 'envio' && (
            <>
              <Text style={styles.label}>Horario preferido</Text>
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

          {/* Fila Locro */}
          <View style={styles.productRow}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>Porciones de Locro</Text>
              <Text style={styles.productPrice}>{formatCurrency(precios.locro_unitario)} /u</Text>
            </View>
            <View style={styles.qtyContainer}>
              <Pressable onPress={() => handleQtyChange('locro', -1)} style={styles.qtyBtn}>
                <Minus size={12} color="#111111" />
              </Pressable>
              <Text style={styles.qtyValue}>{locro}</Text>
              <Pressable onPress={() => handleQtyChange('locro', 1)} style={styles.qtyBtn}>
                <Plus size={12} color="#111111" />
              </Pressable>
            </View>
          </View>

          {/* Fila Pastelitos Batata */}
          <View style={styles.productRow}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>Pastelitos de Batata</Text>
              <Text style={styles.productPrice}>{formatCurrency(precios.pastelito_unidad)} /u</Text>
            </View>
            <View style={styles.qtyContainer}>
              <Pressable onPress={() => handleQtyChange('batata', -1)} style={styles.qtyBtn}>
                <Minus size={12} color="#111111" />
              </Pressable>
              <Text style={styles.qtyValue}>{batata}</Text>
              <Pressable onPress={() => handleQtyChange('batata', 1)} style={styles.qtyBtn}>
                <Plus size={12} color="#111111" />
              </Pressable>
            </View>
          </View>

          {/* Fila Pastelitos Membrillo */}
          <View style={styles.productRow}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>Pastelitos de Membrillo</Text>
              <Text style={styles.productPrice}>{formatCurrency(precios.pastelito_unidad)} /u</Text>
            </View>
            <View style={styles.qtyContainer}>
              <Pressable onPress={() => handleQtyChange('membrillo', -1)} style={styles.qtyBtn}>
                <Minus size={12} color="#111111" />
              </Pressable>
              <Text style={styles.qtyValue}>{membrillo}</Text>
              <Pressable onPress={() => handleQtyChange('membrillo', 1)} style={styles.qtyBtn}>
                <Plus size={12} color="#111111" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Pago y Configuración */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Información de Pago y Fecha</Text>

          <Text style={styles.label}>Fecha del evento / Pedido</Text>
          <View style={styles.pickerRow}>
            {['2026-05-25', '2026-05-01'].map((dt) => (
              <Pressable
                key={dt}
                onPress={() => setFecha(dt)}
                style={[styles.pickerButton, fecha === dt && styles.pickerButtonActive]}
              >
                <Text style={[styles.pickerButtonText, fecha === dt && styles.pickerButtonTextActive]}>
                  {dt === '2026-05-25' ? '25 de Mayo' : '1 de Mayo'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Medio de Pago</Text>
          <View style={styles.pickerRow}>
            {['efectivo', 'transferencia', 'tarjeta'].map((method) => (
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

          <Text style={styles.label}>Notas adicionales</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notas}
            onChangeText={setNotas}
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
          disabled={editMutation.isPending}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.pressed,
            editMutation.isPending && styles.submitButtonDisabled
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
  container: {
    flex: 1,
    backgroundColor: '#fbfbfa',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 110,
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
    color: '#9f2f2d',
    fontSize: 13,
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
    fontSize: 13,
    fontFamily: 'SF Pro Display',
  },
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
    fontFamily: 'SF Pro Display',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#787774',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'SF Pro Display',
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
    fontFamily: 'SF Pro Display',
  },
  inputDisabled: {
    backgroundColor: '#f9f9f8',
    borderColor: '#eaeaea',
    color: '#787774',
  },
  textArea: {
    height: 70,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
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
  pickerButtonActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  pickerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#787774',
    fontFamily: 'SF Pro Display',
  },
  pickerButtonTextActive: {
    color: '#ffffff',
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1ef',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2f3437',
    fontFamily: 'SF Pro Display',
  },
  productPrice: {
    fontSize: 11,
    color: '#787774',
    marginTop: 2,
    fontFamily: 'SF Pro Display',
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
    fontFamily: 'SF Pro Display',
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
    fontFamily: 'SF Pro Display',
  },
  toggleSublabel: {
    fontSize: 11,
    color: '#787774',
    marginTop: 2,
    fontFamily: 'SF Pro Display',
  },
  switch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#eaeaea',
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: '#346538',
  },
  switchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffffff',
  },
  switchKnobActive: {
    transform: [{ translateX: 18 }],
  },
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
  totalBlock: {
    flex: 1,
  },
  footerTotalLabel: {
    fontSize: 10,
    color: '#787774',
    fontWeight: '500',
    fontFamily: 'SF Pro Display',
    textTransform: 'uppercase',
  },
  footerTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginTop: 2,
    fontFamily: 'SF Pro Display',
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
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
    fontFamily: 'SF Pro Display',
  },
  pressed: {
    opacity: 0.9,
  }
});
