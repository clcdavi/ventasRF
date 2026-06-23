import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  Pressable, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  TouchableWithoutFeedback, 
  Keyboard 
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../stores/auth';
import { Lock, Mail, User, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [esStaff, setEsStaff] = useState(false);
  const [codigoStaff, setCodigoStaff] = useState('');

  const handleRegister = async () => {
    if (!nombre || !email || !password || !confirmPassword) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    try {
      await signUp(nombre.trim(), email.trim().toLowerCase(), password, esStaff ? codigoStaff : undefined);
    } catch (err: any) {
      setError(err?.message || 'Error de conexión. Intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Cabecera / Botón de retroceso */}
            <View style={styles.header}>
              <Link href="/(auth)/login" asChild>
                <Pressable style={styles.backButton}>
                  <ArrowLeft size={20} color="#4F46E5" />
                  <Text style={styles.backButtonText}>Volver al Ingreso</Text>
                </Pressable>
              </Link>
            </View>

            {/* Cabecera de Marca */}
            <View style={styles.brandContainer}>
              <Text style={styles.brandTitle}>Crear Cuenta</Text>
              <Text style={styles.brandSubtitle}>Regístrate para comenzar a administrar pedidos en el sistema.</Text>
            </View>

            {/* Formulario de Registro */}
            <View style={styles.formContainer}>
              {error && (
                <View style={styles.errorAlert}>
                  <AlertCircle size={16} color="#EF4444" style={{ marginRight: 8 }} />
                  <Text style={styles.errorAlertText}>{error}</Text>
                </View>
              )}

              {/* Input Nombre */}
              <Text style={styles.inputLabel}>Nombre Completo</Text>
              <View style={styles.inputWrapper}>
                <User size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Juan Pérez"
                  placeholderTextColor="#94A3B8"
                  value={nombre}
                  onChangeText={(text) => {
                    setNombre(text);
                    if (error) setError(null);
                  }}
                  autoCapitalize="words"
                />
              </View>

              {/* Input Email */}
              <Text style={styles.inputLabel}>Correo Electrónico</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              {/* Input Contraseña */}
              <Text style={styles.inputLabel}>Contraseña</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { paddingRight: 45 }]}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#64748B" />
                  ) : (
                    <Eye size={18} color="#64748B" />
                  )}
                </Pressable>
              </View>

              {/* Input Confirmar Contraseña */}
              <Text style={styles.inputLabel}>Confirmar Contraseña</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Repite la contraseña"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>

              {/* Opción de Staff */}
              <Pressable 
                onPress={() => {
                  setEsStaff(!esStaff);
                  setCodigoStaff('');
                  if (error) setError(null);
                }}
                style={styles.staffToggle}
              >
                <Text style={styles.staffToggleText}>
                  {esStaff ? 'Registrarme como Cliente' : '¿Eres parte del Staff? Regístrate aquí'}
                </Text>
              </Pressable>

              {esStaff && (
                <>
                  <Text style={styles.inputLabel}>Código Secreto de Staff</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Introduce el código de Staff"
                      placeholderTextColor="#94A3B8"
                      value={codigoStaff}
                      onChangeText={(text) => {
                        setCodigoStaff(text);
                        if (error) setError(null);
                      }}
                      autoCapitalize="none"
                    />
                  </View>
                </>
              )}

              {/* Botón de Submit */}
              <Pressable
                onPress={handleRegister}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.buttonPressed,
                  isLoading && styles.submitButtonDisabled
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Registrar Cuenta</Text>
                )}
              </Pressable>
            </View>

            {/* Pie de página */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>¿Ya tienes una cuenta? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable style={({ pressed }) => pressed && styles.linkPressed}>
                  <Text style={styles.linkText}>Ingresa aquí</Text>
                </Pressable>
              </Link>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  header: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.03,
        shadowRadius: 16,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorAlertText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginBottom: 18,
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
  },
  input: {
    flex: 1,
    height: 48,
    paddingLeft: 44,
    paddingRight: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
  },
  submitButton: {
    height: 50,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#64748B',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  linkPressed: {
    opacity: 0.7,
  },
  staffToggle: {
    paddingVertical: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  staffToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    textDecorationLine: 'underline',
  }
});
