import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, Pressable, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Info, Phone, Save, LogOut, CheckCircle, ShieldAlert, Trash2, MapPin } from 'lucide-react-native';
import { useAuth } from '../../stores/auth';
import { api } from '../../services/api';
import { router } from 'expo-router';

export default function PerfilScreen() {
  const { user, updateUser, signOut } = useAuth();
  
  const [profileTelefono, setProfileTelefono] = useState(user?.telefono || '');
  const [profileDireccion, setProfileDireccion] = useState(user?.direccion || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' as 'success' | 'error' | 'info' });

  const [staffCode, setStaffCode] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [isDeleting, setIsDeleting] = useState(false);

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
      await updateUser(res.user);
      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
    } catch (e: any) {
      setErrorMsg(e.message || 'Error al validar el código.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Eliminar Cuenta",
      "¿Estás seguro de que deseas eliminar tu cuenta? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, Eliminar", 
          style: "destructive", 
          onPress: async () => {
            setIsDeleting(true);
            try {
              await api.deleteAccount();
              await signOut();
              router.replace('/auth');
            } catch (error) {
              setAlertConfig({ visible: true, title: 'Error', message: 'No se pudo eliminar la cuenta.', type: 'error' });
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/auth');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Modal de Alertas */}
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

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.headerSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.nombre?.charAt(0).toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.userName}>{user?.nombre}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.rol === 'user' ? 'Cliente' : 'Staff'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Información de Contacto</Text>
          
          <View style={styles.inputWrapper}>
            <Phone size={18} color="#94A3B8" />
            <TextInput
              style={styles.input}
              placeholder="Teléfono"
              value={profileTelefono}
              onChangeText={setProfileTelefono}
              keyboardType="phone-pad"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.inputWrapper}>
            <MapPin size={18} color="#94A3B8" />
            <TextInput
              style={styles.input}
              placeholder="Dirección (Opcional)"
              value={profileDireccion}
              onChangeText={setProfileDireccion}
              placeholderTextColor="#94A3B8"
            />
          </View>

          <Pressable 
            style={styles.saveButton} 
            onPress={handleUpdateProfile}
            disabled={isUpdatingProfile}
          >
            {isUpdatingProfile ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Save size={18} color="#FFF" />
                <Text style={styles.saveButtonText}>Guardar Datos</Text>
              </>
            )}
          </Pressable>
        </View>

        {(user?.rol === 'user' || user?.rol === 'customer') && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Acceso Staff</Text>
            <Text style={styles.staffDesc}>Si eres administrador o repartidor, ingresa el código aquí.</Text>
            <View style={styles.staffInputRow}>
              <TextInput
                style={styles.staffInput}
                placeholder="Código de Staff"
                placeholderTextColor="#94A3B8"
                value={staffCode}
                onChangeText={setStaffCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable
                onPress={handleUpgradeRole}
                disabled={upgrading}
                style={({ pressed }) => [
                  styles.staffButton,
                  pressed && { opacity: 0.8 },
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
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
            {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}
          </View>
        )}

        <View style={styles.actionsContainer}>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <LogOut size={20} color="#4F46E5" />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </Pressable>
          
          <Pressable onPress={handleDeleteAccount} disabled={isDeleting} style={styles.deleteButton}>
            {isDeleting ? <ActivityIndicator size="small" color="#EF4444" /> : <Trash2 size={20} color="#EF4444" />}
            <Text style={styles.deleteText}>Eliminar Cuenta</Text>
          </Pressable>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  staffDesc: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  staffInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  staffInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  staffButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  staffButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 8,
  },
  successText: {
    color: '#10B981',
    fontSize: 13,
    marginTop: 8,
  },
  actionsContainer: {
    marginTop: 12,
    gap: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#4F46E5',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tutorialContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  tutorialIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  tutorialTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center',
  },
  tutorialText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 32,
  },
  tutorialButton: {
    backgroundColor: '#4F46E5',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  tutorialButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
