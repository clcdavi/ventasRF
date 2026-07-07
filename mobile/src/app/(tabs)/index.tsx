import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl, Pressable, ActivityIndicator, Platform, TextInput, Modal, Image, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { 
  Flame, 
  Calendar, 
  Plus, 
  TrendingUp, 
  ShoppingBag,
  Info,
  RefreshCw,
  CheckCircle,
  ChevronRight,
  LogOut,
  Check,
  ChevronDown,
  MapPin,
  Phone,
  Save,
  X,
  Download,
  Wallet,
  Activity,
  Truck,
  RotateCcw,
  Clock
} from 'lucide-react-native';
import { api } from '../../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../stores/auth';
import { storage } from '../../utils/storage';
import { formatDateToLabel } from '../../utils/date';
import { CustomDropdown } from '../../components/CustomDropdown';

export default function DashboardScreen() {
  const { user, signOut, updateUser } = useAuth();
  const [viewAsCustomer, setViewAsCustomer] = useState(false);
  const isCustomer = user?.rol === 'user' || user?.rol === 'customer' || viewAsCustomer;
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Estados para activar código staff
  const [staffCode, setStaffCode] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showTutorial, setShowTutorial] = useState(false);
  const [profileTelefono, setProfileTelefono] = useState(user?.telefono || '');
  const [profileDireccion, setProfileDireccion] = useState(user?.direccion || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' as 'success' | 'error' | 'info' });

  React.useEffect(() => {
    if (isCustomer) {
      storage.getItem('has_seen_tutorial').then(val => {
        if (!val) {
          setShowTutorial(true);
        }
      });
    }
  }, [isCustomer]);

  const closeTutorial = async () => {
    setShowTutorial(false);
    await storage.setItem('has_seen_tutorial', 'true');
  };

  const handleUpdateProfile = async () => {
    if (!profileTelefono) {
      setAlertConfig({ visible: true, title: 'Atención', message: 'Por favor completa tu teléfono.', type: 'info' });
      return;
    }
    setIsUpdatingProfile(true);
    try {
      const res = await api.updateProfile({ telefono: profileTelefono, direccion: profileDireccion });
      if (res.ok) {
        await updateUser(res.user);
        setAlertConfig({ visible: true, title: '¡Excelente!', message: 'Perfil actualizado correctamente.', type: 'success' });
      }
    } catch (e) {
      setAlertConfig({ visible: true, title: 'Error', message: 'Hubo un problema al actualizar el perfil.', type: 'error' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpgradeRole = async () => {
    if (!staffCode.trim()) {
      setErrorMsg('Debes ingresar un código.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setUpgrading(true);
    try {
      const res = await api.upgradeRole(staffCode.trim());
      setSuccessMsg(res.message);
      setStaffCode('');
      // Actualizar el estado de usuario global
      await updateUser(res.user);
    } catch (e: any) {
      setErrorMsg(e.message || 'Error al validar el código.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleExport = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const token = await storage.getItem('authToken');
      const dateParam = selectedDate === 'all' ? '' : `?fecha=${selectedDate}`;
      const url = `http://137.131.245.249:5000/api/export${dateParam}`;

      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        return;
      }

      // @ts-ignore
      const fileUri = `${FileSystem.documentDirectory}ventas_${selectedDate}.xlsx`;
      const downloadResumed = FileSystem.createDownloadResumable(
        url,
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const result = await downloadResumed.downloadAsync();
      if (result?.uri) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exportar Ventas'
          });
        } else {
          Alert.alert('Éxito', `Archivo guardado en: ${result.uri}`);
        }
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'No se pudo exportar el archivo.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pendiente': return <Clock size={16} color="#EF4444" />;
      case 'En preparación': return <RotateCcw size={16} color="#3B82F6" />;
      case 'En envío': return <Truck size={16} color="#D97706" />;
      case 'Entregado': return <CheckCircle size={16} color="#10B981" />;
      default: return <Activity size={16} color="#64748B" />;
    }
  };

  const { data: stats, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['stats', selectedDate],
    queryFn: () => api.getStats(selectedDate === 'all' ? undefined : selectedDate),
    enabled: !isCustomer,
  });

  const { data: misPedidos, isLoading: isLoadingPedidos, refetch: refetchPedidos, isRefetching: isRefetchingPedidos } = useQuery({
    queryKey: ['mis-pedidos'],
    queryFn: () => api.getMisPedidos(),
    enabled: isCustomer,
  });

  const { data: fechasPedidos = [] } = useQuery({
    queryKey: ['fechas-pedidos'],
    queryFn: () => api.getFechasPedidos(),
    enabled: !isCustomer,
  });

  // Effect to select the most recent date as default if current is not in the list
  React.useEffect(() => {
    if (!isCustomer && fechasPedidos.length > 0) {
      if (selectedDate !== 'all' && !fechasPedidos.includes(selectedDate)) {
        setSelectedDate(fechasPedidos[0]);
      }
    }
  }, [fechasPedidos]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(value);
  };

  const calculateDocenas = (batata: number, membrillo: number) => {
    const total = batata + membrillo;
    if (total === 0) return '0';
    const docenas = Math.floor(total / 12);
    const unidades = total % 12;
    if (unidades === 0) return `${docenas} doc.`;
    return `${docenas} doc. y ${unidades} un.`;
  };

  if (isCustomer) {
    const activePedido = misPedidos?.find(p => p.estado !== 'Entregado');
    const isRealCustomer = user?.rol === 'user' || user?.rol === 'customer';
    const userInitial = user?.nombre?.charAt(0)?.toUpperCase() ?? '?';
    const firstName = user?.nombre?.split(' ')[0] ?? 'Cliente';
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* ── Encabezado rediseñado — consistente con el login ── */}
        <View style={styles.customerHeader}>
          {/* Avatar con inicial */}
          <View style={styles.customerAvatar}>
            <Text style={styles.customerAvatarText}>{userInitial}</Text>
          </View>
          {/* Saludo y marca */}
          <View style={styles.customerHeaderText}>
            <Text style={styles.customerHeaderGreeting}>¡Hola, {firstName}! 👋</Text>
            <Text style={styles.customerHeaderBrand}>Ventas RF</Text>
          </View>
          {/* Acciones */}
          <View style={styles.headerActions}>
            {user?.rol === 'admin' && (
              <Pressable
                onPress={() => setViewAsCustomer(false)}
                style={({ pressed }) => [
                  styles.toggleViewButton,
                  pressed && styles.buttonPressed
                ]}
              >
                <Text style={styles.toggleViewButtonText}>Gestión</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                refetchPedidos();
              }}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.buttonPressed
              ]}
            >
              <RefreshCw size={18} color="#4A5568" />
            </Pressable>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                signOut();
              }}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.buttonPressed
              ]}
            >
              <LogOut size={18} color="#EF4444" />
            </Pressable>
          </View>
        </View>

        <Modal visible={showTutorial} transparent animationType="fade">
          <View style={styles.tutorialOverlay}>
            <View style={styles.tutorialContent}>
              <View style={styles.tutorialIconWrapper}>
                <ShoppingBag size={32} color="#4F46E5" />
              </View>
              <Text style={styles.tutorialTitle}>¡Bienvenido a Ventas RF!</Text>
              <Text style={styles.tutorialText}>
                Comienza a disfrutar de nuestros productos en 3 simples pasos:{'\n\n'}
                1. Explora el menú y elige tus favoritos.{'\n'}
                2. Selecciona envío a domicilio o retiro.{'\n'}
                3. Sigue el estado de tu pedido en tiempo real.
              </Text>
              <Pressable style={styles.tutorialButton} onPress={closeTutorial}>
                <Text style={styles.tutorialButtonText}>¡Entendido!</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Modal de Alertas (Reemplazo de window.alert) */}
        <Modal visible={alertConfig.visible} transparent animationType="fade">
          <View style={styles.tutorialOverlay}>
            <View style={styles.tutorialContent}>
              <View style={[styles.tutorialIconWrapper, alertConfig.type === 'success' ? {backgroundColor: '#D1FAE5'} : alertConfig.type === 'error' ? {backgroundColor: '#FEE2E2'} : {backgroundColor: '#EEF2FF'}]}>
                {alertConfig.type === 'success' ? <CheckCircle size={32} color="#10B981" /> : alertConfig.type === 'error' ? <Info size={32} color="#EF4444" /> : <Info size={32} color="#4F46E5" />}
              </View>
              <Text style={styles.tutorialTitle}>{alertConfig.title}</Text>
              <Text style={[styles.tutorialText, { textAlign: 'center' }]}>{alertConfig.message}</Text>
              <Pressable style={[styles.tutorialButton, alertConfig.type === 'success' ? {backgroundColor: '#10B981'} : alertConfig.type === 'error' ? {backgroundColor: '#EF4444'} : {}]} onPress={() => setAlertConfig({ ...alertConfig, visible: false })}>
                <Text style={styles.tutorialButtonText}>Aceptar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetchingPedidos} onRefresh={refetchPedidos} tintColor="#4F46E5" />
          }
        >
          {/* Carrusel de Promociones */}
          <View style={styles.carouselContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
              <Pressable 
                style={({ pressed }) => [styles.carouselCard, pressed && { opacity: 0.8 }]}
                onPress={() => router.push('/pedidos/nuevo')}
              >
                <Image source={require('../../../assets/images/locro.jpg')} style={styles.carouselImagePlaceholder} />
                <Text style={styles.carouselTitle}>Porción de Locro</Text>
              </Pressable>
              <Pressable 
                style={({ pressed }) => [styles.carouselCard, pressed && { opacity: 0.8 }]}
                onPress={() => router.push('/pedidos/nuevo')}
              >
                <Image source={require('../../../assets/images/pastelitos.jpg')} style={styles.carouselImagePlaceholder} />
                <Text style={styles.carouselTitle}>Pastelitos por docena</Text>
              </Pressable>
            </ScrollView>
          </View>

          {(!user?.telefono) && (
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <Info size={20} color="#F59E0B" />
                <Text style={styles.profileTitle}>Completa tu perfil</Text>
              </View>
              <Text style={styles.profileDesc}>Para agilizar tu entrega, guarda tu número de teléfono de contacto.</Text>
              
              <View style={styles.profileInputWrapper}>
                <Phone size={16} color="#94A3B8" />
                <TextInput
                  style={styles.profileInput as any}
                  placeholder="Teléfono"
                  value={profileTelefono}
                  onChangeText={setProfileTelefono}
                  keyboardType="phone-pad"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <Pressable 
                style={styles.profileSaveButton} 
                onPress={handleUpdateProfile}
                disabled={isUpdatingProfile}
              >
                {isUpdatingProfile ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Save size={16} color="#FFF" />
                    <Text style={styles.profileSaveText}>Guardar Datos</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Card: Realizar Pedido */}
          <View style={[styles.doubleBezelOuter, { marginTop: 20 }]}>
            <View style={styles.doubleBezelInner}>
              <Text style={styles.customerWelcomeTitle}>¿Qué vas a pedir hoy?</Text>
              <Text style={styles.customerWelcomeDesc}>
                Disfruta del mejor locro y los pastelitos más ricos en este evento. ¡Realiza tu pedido y síguelo en tiempo real!
              </Text>
              
              <Pressable 
                onPress={() => router.push('/pedidos/nuevo')}
                style={({ pressed }) => [
                  styles.customerActionButton, 
                  pressed && styles.buttonPressed
                ]}
              >
                <Plus size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.customerActionButtonText}>Realizar Nuevo Pedido</Text>
              </Pressable>
            </View>
          </View>

          {isLoadingPedidos ? (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#4F46E5" />
              <Text style={{ marginTop: 10, color: '#64748B', fontSize: 13, fontWeight: '600' }}>Cargando tus pedidos...</Text>
            </View>
          ) : activePedido ? (
            <View style={{ marginTop: 24 }}>
              <Text style={styles.sectionTitle}>Seguimiento de tu Pedido Activo</Text>
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

          {/* Listado de pedidos anteriores */}
          {misPedidos && misPedidos.length > (activePedido ? 1 : 0) && (
            <View style={{ marginTop: 24 }}>
              <Text style={styles.sectionTitle}>Historial de Pedidos</Text>
              {misPedidos
                .filter(p => p.id !== activePedido?.id)
                .slice(0, 5)
                .map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/pedidos/${p.id}`)}
                    style={styles.historyCard}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyId}>Pedido #{p.id}</Text>
                      <Text style={styles.historyDate}>{p.fecha_pedido}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.historyValue}>{formatCurrency(p.monto_total)}</Text>
                      <Text style={[styles.historyStatus, { color: p.estado === 'Entregado' ? '#10B981' : '#EF4444' }]}>
                        {p.estado}
                      </Text>
                    </View>
                  </Pressable>
                ))}
            </View>
          )}

          {/* Activar código Staff — link discreto para clientes reales */}
          {isRealCustomer && !successMsg && (
            <Pressable
              onPress={() => setStaffCode(prev => prev ? '' : ' ')}
              style={styles.staffToggleLink}
            >
              <Text style={styles.staffToggleLinkText}>¿Eres parte del staff? Activar acceso →</Text>
            </Pressable>
          )}

          {/* Panel colapsable de código staff */}
          {isRealCustomer && staffCode.trim().length >= 0 && staffCode !== '' && !successMsg && (
            <View style={styles.staffCardDiscrete}>
              <Text style={styles.staffTitle}>Acceso Staff</Text>
              <View style={styles.staffInputRow}>
                <TextInput
                  style={styles.staffInput}
                  placeholder="Código de Staff"
                  placeholderTextColor="#94A3B8"
                  value={staffCode.trim()}
                  onChangeText={setStaffCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <Pressable
                  onPress={handleUpgradeRole}
                  disabled={upgrading}
                  style={({ pressed }) => [
                    styles.staffButton,
                    pressed && styles.buttonPressed,
                    upgrading && { opacity: 0.7 }
                  ]}
                >
                  {upgrading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.staffButtonText}>Activar</Text>
                  )}
                </Pressable>
              </View>
              {errorMsg ? <Text style={styles.staffErrorMsg}>{errorMsg}</Text> : null}
            </View>
          )}
          {isRealCustomer && successMsg ? <Text style={[styles.staffSuccessMsg, { textAlign: 'center', marginVertical: 12 }]}>{successMsg}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const datesList = fechasPedidos.map(dateStr => ({
    label: formatDateToLabel(dateStr),
    value: dateStr
  })).concat([{ label: 'Histórico', value: 'all' }]);

  const adminUserInitial = user?.nombre?.charAt(0)?.toUpperCase() ?? '?';
  const adminFirstName = user?.nombre?.split(' ')[0] ?? 'Admin';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Encabezado Admin al estilo Cliente */}
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
            onPress={() => setViewAsCustomer(true)}
            style={({ pressed }) => [
              styles.toggleViewButton,
              pressed && styles.buttonPressed
            ]}
          >
            <Text style={styles.toggleViewButtonText}>Vista Cliente</Text>
          </Pressable>
          <Pressable 
            onPress={() => refetch()} 
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

      {/* Selector de Evento / Fecha (Dropdown) */}
      <View style={styles.selectorContainer}>
        <Pressable 
          style={styles.dropdownButton}
          onPress={() => setIsDropdownOpen(true)}
        >
          <Calendar size={18} color="#4F46E5" style={{ marginRight: 8 }} />
          <Text style={styles.dropdownButtonText}>
            {datesList.find(d => d.value === selectedDate)?.label || 'Seleccionar fecha...'}
          </Text>
          <ChevronDown size={18} color="#94A3B8" style={{ marginLeft: 'auto' }} />
        </Pressable>
      </View>

      <CustomDropdown
        visible={isDropdownOpen}
        title="Seleccionar Fecha"
        options={datesList.map(d => ({ label: d.label, value: d.value, icon: <Calendar size={16} color="#64748B" /> }))}
        selectedValue={selectedDate}
        onSelect={(val) => {
          setSelectedDate(val as string);
          setIsDropdownOpen(false);
        }}
        onClose={() => setIsDropdownOpen(false)}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={styles.loadingText}>Cargando resumen...</Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Info size={36} color="#EF4444" />
          <Text style={styles.errorText}>No se pudo establecer conexión con el servidor.</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Reintentar Conexión</Text>
          </Pressable>
        </View>
      ) : stats ? (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#4F46E5" />
          }
        >
          {/* Tarjeta de Recaudación Principal (Double-Bezel Architecture) */}
          <View style={styles.doubleBezelOuter}>
            <View style={styles.doubleBezelInner}>
              <View style={styles.heroHeader}>
                <Text style={styles.heroLabel}>Total Recaudado</Text>
                <View style={styles.trendBadge}>
                  <TrendingUp size={12} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.trendText}>Caja</Text>
                </View>
              </View>
              <Text style={styles.heroValue}>{formatCurrency(stats.recaudacion_total || 0)}</Text>
              
              <View style={styles.heroDivider} />
              
              <View style={styles.heroGrid}>
                {/* Cobrado */}
                <View style={styles.heroStatItem}>
                  <View style={styles.subStatHeader}>
                    <View style={[styles.subStatIndicator, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.heroStatLabel}>Cobrado</Text>
                  </View>
                  <Text style={[styles.heroStatValue, { color: '#10B981' }]}>
                    {formatCurrency(stats.recaudacion_cobrada || 0)}
                  </Text>
                </View>
                {/* Pendiente */}
                <View style={styles.heroStatItem}>
                  <View style={styles.subStatHeader}>
                    <View style={[styles.subStatIndicator, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.heroStatLabel}>Pendiente</Text>
                  </View>
                  <Text style={[styles.heroStatValue, { color: '#D97706' }]}>
                    {formatCurrency(stats.recaudacion_pendiente || 0)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Distribución por Medios de Pago */}
          <Text style={styles.sectionTitle}>Cobrado por Medio de Pago</Text>
          <View style={{ gap: 12 }}>
            {stats.por_medio_pago && Object.keys(stats.por_medio_pago).length > 0 ? (
              Object.entries(stats.por_medio_pago).map(([method, amount]) => {
                const total = stats.recaudacion_total || 1;
                const percent = Math.round((amount / total) * 100);
                return (
                  <View key={method} style={styles.productCard}>
                    <View style={[styles.iconWrapper, { backgroundColor: '#EEF2FF' }]}>
                      <Wallet size={20} color="#4F46E5" />
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productValue}>{formatCurrency(amount)}</Text>
                      <Text style={styles.productLabel}>{method} ({percent}%)</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={{ fontSize: 13, color: '#64748B', marginLeft: 4 }}>No hay datos de pago registrados.</Text>
            )}
          </View>

          {/* Pedidos por Estado */}
          <Text style={styles.sectionTitle}>Pedidos por Estado</Text>
          <View style={{ gap: 12 }}>
            {stats.por_estado && Object.keys(stats.por_estado).length > 0 ? (
              Object.entries(stats.por_estado).map(([state, count]) => {
                const totalOrders = stats.total_pedidos || 1;
                const percent = Math.round((count / totalOrders) * 100);
                return (
                  <View key={state} style={styles.productCard}>
                    <View style={[styles.iconWrapper, { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                      {getStatusIcon(state)}
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productValue}>{count} {count === 1 ? 'pedido' : 'pedidos'}</Text>
                      <Text style={styles.productLabel}>{state} ({percent}%)</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={{ fontSize: 13, color: '#64748B', marginLeft: 4 }}>No hay pedidos registrados.</Text>
            )}
          </View>


          {/* Cantidades de Productos */}
          <Text style={styles.sectionTitle}>Cantidades del Evento</Text>
          <View style={{ gap: 12 }}>
            {Object.entries(stats.por_producto || {}).map(([nombre, cantidad]) => (
              <View key={nombre} style={styles.productCard}>
                <View style={[styles.iconWrapper, { backgroundColor: '#EEF2FF' }]}>
                  <ShoppingBag size={20} color="#4F46E5" />
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productValue}>{cantidad}</Text>
                  <Text style={styles.productLabel}>{nombre}</Text>
                </View>
              </View>
            ))}
            {Object.keys(stats.por_producto || {}).length === 0 && (
              <Text style={{ fontSize: 13, color: '#64748B', marginLeft: 4 }}>No hay pedidos registrados.</Text>
            )}
          </View>

          {/* Total Pedidos Registrados */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryContent}>
              <CheckCircle size={18} color="#4F46E5" />
              <Text style={styles.summaryText}>Pedidos Registrados</Text>
            </View>
            <Text style={styles.summaryValue}>{stats.total_pedidos || 0}</Text>
          </View>

          {/* Accesos Rápidos */}
          <View style={styles.actionsContainer}>
            <Pressable 
              onPress={() => router.push('/pedidos/nuevo')}
              style={({ pressed }) => [
                styles.actionButton, 
                styles.actionPrimary, 
                pressed && styles.buttonPressed
              ]}
            >
              <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.actionButtonText}>Nuevo Pedido</Text>
            </Pressable>

            <Pressable 
              onPress={handleExport}
              style={({ pressed }) => [
                styles.actionButton, 
                styles.actionSecondary, 
                pressed && styles.buttonPressed,
                { marginBottom: 8 }
              ]}
            >
              <Text style={styles.actionButtonTextSecondary}>Exportar a Excel</Text>
              <Download size={16} color="#4F46E5" style={{ marginLeft: 4 }} />
            </Pressable>
          </View>

        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA', // Fondo claro y cálido
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  // ── Estilos del nuevo header de cliente ──────────────────────────────
  customerHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  customerAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  customerHeaderText: {
    flex: 1,
  },
  customerHeaderGreeting: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  customerHeaderBrand: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  // ── Estilos del panel de staff discreto ──────────────────────────────
  staffToggleLink: {
    marginTop: 28,
    marginBottom: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  staffToggleLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
  staffCardDiscrete: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  selectorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownMenuTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  // Double-Bezel Architecture para la Tarjeta de Recaudación Principal
  doubleBezelOuter: {
    backgroundColor: '#E2E8F0',
    borderRadius: 24,
    padding: 6,
    marginTop: 14,
  },
  doubleBezelInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  trendText: {
    fontSize: 10,
    color: '#137333',
    fontWeight: '700',
  },
  heroValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
    letterSpacing: -1,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  heroGrid: {
    flexDirection: 'row',
  },
  heroStatItem: {
    flex: 1,
  },
  subStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  subStatIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  heroStatLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
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
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  productLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 14,
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
  detailCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bulletGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  detailName: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  summaryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4F46E5',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  actionPrimary: {
    backgroundColor: '#4F46E5',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  actionSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  actionButtonTextSecondary: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  customerWelcomeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  customerWelcomeDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  customerActionButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
  },
  customerActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  activeOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
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
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
      },
    }),
  },
  historyId: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  historyValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  historyStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  toggleViewButton: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  toggleViewButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
    textTransform: 'uppercase',
  },
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    marginBottom: 40,
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
  staffTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  staffDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  staffInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
    marginRight: 8,
  },
  staffButton: {
    height: 38,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  staffErrorMsg: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  staffSuccessMsg: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tutorialContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
      android: { elevation: 10 },
      web: { boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }
    })
  },
  tutorialIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tutorialTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  tutorialText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  tutorialButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  tutorialButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  carouselContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  carouselCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
    })
  },
  carouselImagePlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  carouselTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  profileCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B45309',
    marginLeft: 8,
  },
  profileDesc: {
    fontSize: 13,
    color: '#D97706',
    marginBottom: 16,
    lineHeight: 18,
  },
  profileInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 44,
  },
  profileInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  profileSaveButton: {
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  profileSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
});
