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
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { calcularTotal, DEFAULT_PRICES } from '../../utils/pricing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Minus, Plus, Save } from 'lucide-react-native';
import { useAuth } from '../../stores/auth';

export default function NuevoPedidoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isCustomer = user?.rol === 'customer' || user?.rol === 'user';

  // Cargar precios de la API para asegurar consistencia
  const { data: serverPrices } = useQuery({
    queryKey: ['precios'],
    queryFn: api.getPrecios,
  });

  const precios = serverPrices || DEFAULT_PRICES;

  // Estados del Formulario
  const [nombre, setNombre] = useState(isCustomer ? user?.nombre || '' : '');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState(isCustomer ? user?.email || '' : '');
  const [direccion, setDireccion] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'envio' | 'retiro'>('envio');
  const [horario, setHorario] = useState('');
  const [medioPago, setMedioPago] = useState('efectivo');
  const [pagado, setPagado] = useState(false);
  const [fecha, setFecha] = useState('2026-05-25'); // Default
  const [notas, setNotas] = useState('');

  // Cantidades
  const [locro, setLocro] = useState(0);
  const [batata, setBatata] = useState(0);
  const [membrillo, setMembrillo] = useState(0);

  // Auto-completar dirección si es retiro en iglesia
  useEffect(() => {
    if (tipoEntrega === 'retiro') {
      setDireccion('Retiro en Iglesia');
      setHorario('');
    } else if (direccion === 'Retiro en Iglesia') {
      setDireccion('');
    }
  }, [tipoEntrega]);

  // Cálculo en tiempo real
  const total = calcularTotal(locro, batata, membrillo, precios);

  // Mutación para crear el pedido
  const createMutation = useMutation({
    mutationFn: api.crearPedido,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['mis-pedidos'] });
      Alert.alert('Éxito', 'Pedido registrado correctamente.');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'No se pudo guardar el pedido.');
    }
  });

  const handleSubmit = () => {
    if (!nombre.trim()) {
      return Alert.alert('Validación', 'El nombre del cliente es obligatorio.');
    }
    if (!telefono.trim()) {
      return Alert.alert('Validación', 'El teléfono es obligatorio.');
    }
    if (!direccion.trim()) {
      return Alert.alert('Validación', 'La dirección es obligatoria.');
    }
    if (locro + batata + membrillo === 0) {
      return Alert.alert('Validación', 'Debes agregar al menos un producto.');
    }

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

  const handleQtyChange = (product: 'locro' | 'batata' | 'membrillo', change: number) => {
    if (product === 'locro') setLocro(prev => Math.max(0, prev + change));
    if (product === 'batata') setBatata(prev => Math.max(0, prev + change));
    if (product === 'membrillo') setMembrillo(prev => Math.max(0, prev + change));
  };

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

          <Text style={styles.label}>Fecha del evento</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#fbfbfa',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 110,
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
