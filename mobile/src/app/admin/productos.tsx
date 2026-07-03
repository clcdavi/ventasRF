import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl, Pressable, TextInput, Alert, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Plus, Save, Trash2, Edit2, X } from 'lucide-react-native';
import { api } from '../../services/api';
import { Producto } from '../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../stores/auth';

export default function AdminProductosScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Producto>>({});
  const [isAdding, setIsAdding] = useState(false);

  // Redirigir si no es admin
  useEffect(() => {
    if (user && user.rol !== 'admin') {
      router.replace('/');
    }
  }, [user]);

  const { data: productos, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['admin-productos'],
    queryFn: () => api.getProductos(), // get all products, active and inactive
    enabled: user?.rol === 'admin',
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Producto>) => api.createProducto(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-productos'] });
      setIsAdding(false);
      setEditForm({});
      if (Platform.OS !== 'web') {
        Alert.alert('Éxito', 'Producto agregado');
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'No se pudo crear');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Producto> }) => api.updateProducto(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-productos'] });
      setEditingId(null);
      setEditForm({});
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'No se pudo actualizar');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteProducto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-productos'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'No se pudo eliminar');
    }
  });

  const handleSave = () => {
    if (!editForm.nombre || !editForm.precio) {
      Alert.alert('Atención', 'Nombre y precio son obligatorios');
      return;
    }
    
    if (isAdding) {
      createMutation.mutate({
        nombre: editForm.nombre,
        precio: Number(editForm.precio),
        activo: editForm.activo !== undefined ? editForm.activo : true,
      });
    } else if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          nombre: editForm.nombre,
          precio: Number(editForm.precio),
          activo: editForm.activo,
        }
      });
    }
  };

  const handleToggleActivo = (producto: Producto) => {
    updateMutation.mutate({
      id: producto.id,
      data: { ...producto, activo: !producto.activo }
    });
  };

  const handleDelete = (id: number) => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar este producto?')) {
        deleteMutation.mutate(id);
      }
    } else {
      Alert.alert('Eliminar', '¿Estás seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate(id) }
      ]);
    }
  };

  const startEdit = (p: Producto) => {
    setIsAdding(false);
    setEditingId(p.id);
    setEditForm({ ...p, precio: p.precio.toString() as any });
  };

  const startAdd = () => {
    setEditingId(null);
    setIsAdding(true);
    setEditForm({ nombre: '', precio: '' as any, activo: true });
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setEditForm({});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ArrowLeft size={20} color="#4F46E5" />
        </Pressable>
        <Text style={styles.headerTitle}>Productos</Text>
        <Pressable 
          onPress={startAdd}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#4F46E5" />}
      >
        <Text style={styles.description}>
          Agrega, edita o habilita/deshabilita los productos para que aparezcan en la sección de "Nuevo Pedido".
        </Text>

        {(isAdding || editingId) && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{isAdding ? 'Nuevo Producto' : 'Editar Producto'}</Text>
            
            <Text style={styles.label}>Nombre del producto</Text>
            <TextInput
              style={styles.input}
              value={editForm.nombre}
              onChangeText={(t) => setEditForm({ ...editForm, nombre: t })}
              placeholder="Ej: Empanadas (Docena)"
            />

            <Text style={styles.label}>Precio</Text>
            <TextInput
              style={styles.input}
              value={editForm.precio?.toString()}
              onChangeText={(t) => setEditForm({ ...editForm, precio: t.replace(/[^0-9]/g, '') as any })}
              placeholder="Ej: 3500"
              keyboardType="numeric"
            />

            <View style={styles.switchRow}>
              <Text style={styles.label}>Habilitado para pedidos</Text>
              <Switch
                value={editForm.activo}
                onValueChange={(val) => setEditForm({ ...editForm, activo: val })}
                trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.formActions}>
              <Pressable onPress={cancelEdit} style={[styles.btnAction, styles.btnCancel]}>
                <X size={16} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </Pressable>
              
              <Pressable 
                onPress={handleSave} 
                style={[styles.btnAction, styles.btnSave, (createMutation.isPending || updateMutation.isPending) && { opacity: 0.7 }]}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Save size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnSaveText}>{isAdding ? 'Crear' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {productos?.map(p => (
          <View key={p.id} style={[styles.productCard, !p.activo && styles.productCardInactive]}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{p.nombre}</Text>
              <Text style={styles.productPrice}>${p.precio}</Text>
            </View>
            
            <View style={styles.productActions}>
              <Switch
                value={p.activo}
                onValueChange={() => handleToggleActivo(p)}
                trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                thumbColor="#FFFFFF"
                style={{ marginRight: 12 }}
              />
              
              <Pressable onPress={() => startEdit(p)} style={styles.iconBtn}>
                <Edit2 size={18} color="#64748B" />
              </Pressable>
              
              <Pressable onPress={() => handleDelete(p.id)} style={styles.iconBtn}>
                <Trash2 size={18} color="#EF4444" />
              </Pressable>
            </View>
          </View>
        ))}

        {productos?.length === 0 && !isLoading && !isAdding && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay productos configurados.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
    lineHeight: 18,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  productCardInactive: {
    opacity: 0.6,
    backgroundColor: '#F1F5F9',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '800',
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 8,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4F46E5',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnAction: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#F1F5F9',
  },
  btnCancelText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  btnSave: {
    backgroundColor: '#4F46E5',
  },
  btnSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  }
});
