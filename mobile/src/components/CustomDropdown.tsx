import React from 'react';
import { StyleSheet, Text, View, Modal, Pressable, Platform, ScrollView } from 'react-native';
import { Check, ChevronDown, Calendar, Search, Tag, X } from 'lucide-react-native';

interface DropdownOption {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

interface CustomDropdownProps {
  visible: boolean;
  title?: string;
  options: DropdownOption[];
  selectedValue: string | number;
  onSelect: (value: string | number) => void;
  onClose: () => void;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.dropdownContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.modalTitle}>{title || 'Seleccionar opción'}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={20} color="#64748B" />
            </Pressable>
          </View>
          
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {options.map((opt) => {
              const isActive = selectedValue === opt.value;
              return (
                <Pressable
                  key={opt.value.toString()}
                  onPress={() => onSelect(opt.value)}
                  style={({ pressed }) => [
                    styles.dropdownMenuItem,
                    isActive && styles.dropdownMenuItemActive,
                    pressed && { backgroundColor: '#F8FAFC' }
                  ]}
                >
                  {opt.icon && (
                    <View style={styles.iconContainer}>
                      {opt.icon}
                    </View>
                  )}
                  <Text style={[
                    styles.dropdownMenuText,
                    isActive && styles.dropdownMenuTextActive
                  ]}>
                    {opt.label}
                  </Text>
                  {isActive && (
                    <Check size={18} color="#4F46E5" style={{ marginLeft: 'auto' }} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Darker, premium overlay
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    paddingVertical: 10,
    maxHeight: '80%', // Limit height in case of many options
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        backdropFilter: 'blur(10px)',
      }
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
  },
  scrollView: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 4,
  },
  dropdownMenuItemActive: {
    backgroundColor: '#EEF2FF',
  },
  iconContainer: {
    marginRight: 12,
  },
  dropdownMenuText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '600',
  },
  dropdownMenuTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
});
