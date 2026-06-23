import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl, ActivityIndicator, Pressable, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Wallet, 
  ShoppingBag, 
  Flame, 
  Calendar, 
  Activity,
  CheckCircle,
  Truck,
  RotateCcw,
  Clock,
  Info
} from 'lucide-react-native';

export default function StatsScreen() {
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-25'); // Default 25 de Mayo

  const { data: stats, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['stats', 'details', selectedDate],
    queryFn: () => api.getStats(selectedDate === 'all' ? undefined : selectedDate),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(value);
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

  const datesList = [
    { label: '25 de Mayo', value: '2026-05-25' },
    { label: '1 de Mayo', value: '2026-05-01' },
    { label: 'Histórico', value: 'all' },
  ];

  const paidPercentage = stats?.recaudacion_total 
    ? Math.round((stats.recaudacion_cobrada / stats.recaudacion_total) * 100) 
    : 0;

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

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={styles.infoText}>Analizando estadísticas...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Info size={28} color="#EF4444" style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>Error al cargar estadísticas.</Text>
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
          {/* Progreso de Cobros (Neumorphic Card) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Avance de Cobranza</Text>
            <View style={styles.progressHeader}>
              <Text style={styles.progressPercent}>{paidPercentage}% cobrado</Text>
              <Text style={styles.progressRatio}>
                {formatCurrency(stats.recaudacion_cobrada)} de {formatCurrency(stats.recaudacion_total)}
              </Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${paidPercentage}%` }]} />
            </View>
            <View style={styles.progressLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>Cobrado ({formatCurrency(stats.recaudacion_cobrada)})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendText}>Pendiente ({formatCurrency(stats.recaudacion_pendiente)})</Text>
              </View>
            </View>
          </View>

          {/* Distribución por Medios de Pago */}
          <View style={styles.card}>
            <View style={styles.rowTitle}>
              <View style={[styles.iconTitleCircle, { backgroundColor: '#EEF2F6' }]}>
                <Wallet size={16} color="#4F46E5" />
              </View>
              <Text style={styles.cardTitle}>Cobrado por Medio de Pago</Text>
            </View>
            {stats.por_medio_pago && Object.keys(stats.por_medio_pago).length > 0 ? (
              Object.entries(stats.por_medio_pago).map(([method, amount]) => {
                const total = stats.recaudacion_total || 1;
                const percent = Math.round((amount / total) * 100);
                return (
                  <View key={method} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{method}</Text>
                      <Text style={styles.itemPercent}>{percent}% de la recaudación</Text>
                    </View>
                    <Text style={styles.itemValue}>{formatCurrency(amount)}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No hay datos de pago registrados.</Text>
            )}
          </View>

          {/* Estado de Preparación / Envío */}
          <View style={styles.card}>
            <View style={styles.rowTitle}>
              <View style={[styles.iconTitleCircle, { backgroundColor: '#EEF2F6' }]}>
                <Activity size={16} color="#4F46E5" />
              </View>
              <Text style={styles.cardTitle}>Pedidos por Estado</Text>
            </View>
            {stats.por_estado && Object.keys(stats.por_estado).length > 0 ? (
              Object.entries(stats.por_estado).map(([state, count]) => {
                const totalOrders = stats.total_pedidos || 1;
                const percent = Math.round((count / totalOrders) * 100);
                return (
                  <View key={state} style={styles.itemRow}>
                    <View style={styles.itemInfoRow}>
                      <View style={[styles.statusIconCircle, { backgroundColor: '#F8F9FA' }]}>
                        {getStatusIcon(state)}
                      </View>
                      <Text style={styles.itemName}>{state}</Text>
                    </View>
                    <View style={styles.badgeCountContainer}>
                      <Text style={styles.badgeCountText}>{count} {count === 1 ? 'pedido' : 'pedidos'}</Text>
                      <Text style={styles.badgePercentText}>{percent}%</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No hay pedidos registrados.</Text>
            )}
          </View>

          {/* Consolidado de Unidades de Productos */}
          <View style={styles.card}>
            <View style={styles.rowTitle}>
              <View style={[styles.iconTitleCircle, { backgroundColor: '#EEF2F6' }]}>
                <ShoppingBag size={16} color="#4F46E5" />
              </View>
              <Text style={styles.cardTitle}>Productos Vendidos</Text>
            </View>
            
            {/* Fila Locro */}
            <View style={styles.productRow}>
              <View style={[styles.productIconCircle, { backgroundColor: '#FEF2F2' }]}>
                <Flame size={18} color="#EF4444" />
              </View>
              <View style={styles.productTextContainer}>
                <Text style={styles.productName}>Locro</Text>
                <Text style={styles.productDetail}>{stats.total_locro || 0} porciones</Text>
              </View>
            </View>

            {/* Fila Pastelitos Batata */}
            <View style={styles.productRow}>
              <View style={[styles.productIconCircle, { backgroundColor: '#FFFBEB' }]}>
                <ShoppingBag size={18} color="#F59E0B" />
              </View>
              <View style={styles.productTextContainer}>
                <Text style={styles.productName}>Pastelitos de Batata</Text>
                <Text style={styles.productDetail}>{stats.total_batata || 0} unidades</Text>
              </View>
            </View>

            {/* Fila Pastelitos Membrillo */}
            <View style={styles.productRow}>
              <View style={[styles.productIconCircle, { backgroundColor: '#FEF2F2' }]}>
                <ShoppingBag size={18} color="#EF4444" />
              </View>
              <View style={styles.productTextContainer}>
                <Text style={styles.productName}>Pastelitos de Membrillo</Text>
                <Text style={styles.productDetail}>{stats.total_membrillo || 0} unidades</Text>
              </View>
            </View>
          </View>

        </ScrollView>
      ) : null}
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 90, // Margen para evitar solapamiento con la pestaña flotante
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
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
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
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconTitleCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  progressRatio: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemInfo: {
    flex: 1,
  },
  itemInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  itemPercent: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  itemValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgeCountContainer: {
    alignItems: 'flex-end',
  },
  badgeCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgePercentText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '600',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productTextContainer: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  productDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 12,
    fontWeight: '500',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  }
});
