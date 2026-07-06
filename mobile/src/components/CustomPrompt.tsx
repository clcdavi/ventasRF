import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Modal, Pressable, Animated, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { User, X } from 'lucide-react-native';

interface CustomPromptProps {
  visible: boolean;
  title: string;
  message: string;
  defaultValue?: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}

export const CustomPrompt: React.FC<CustomPromptProps> = ({ 
  visible, 
  title, 
  message, 
  defaultValue = '',
  onCancel,
  onSubmit 
}) => {
  const [text, setText] = useState(defaultValue);
  const scaleValue = useRef(new Animated.Value(0.8)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setText(defaultValue);
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 7,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible, defaultValue]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView 
        style={styles.overlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View 
          style={[
            styles.alertBox, 
            { 
              opacity: opacityValue,
              transform: [{ scale: scaleValue }]
            }
          ]}
        >
          <Pressable style={styles.closeIcon} onPress={onCancel}>
            <X size={20} color="#94A3B8" />
          </Pressable>
          
          <View style={styles.iconContainer}>
             <User size={28} color="#4F46E5" />
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Ej: Juan Perez"
            placeholderTextColor="#94A3B8"
            autoFocus
          />

          <View style={styles.buttonRow}>
            <Pressable 
              style={[styles.button, styles.cancelButton]} 
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable 
              style={[styles.button, styles.submitButton]} 
              onPress={() => onSubmit(text)}
            >
              <Text style={styles.submitButtonText}>Asignar</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  closeIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  iconContainer: {
    marginBottom: 16,
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 50,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    width: '100%',
    height: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#0F172A',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  submitButton: {
    backgroundColor: '#4F46E5',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  }
});
