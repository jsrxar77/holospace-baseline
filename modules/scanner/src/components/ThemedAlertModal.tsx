import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { create } from 'zustand';
import { useThemeStore } from '../store/useThemeStore';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  showAlert: (title: string, message: string, buttons?: AlertButton[]) => void;
  hideAlert: () => void;
}

export const useThemedAlertStore = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: '',
  buttons: [],
  showAlert: (title: string, message: string, buttons = [{ text: 'Entendido', style: 'default' }]) => {
    set({
      visible: true,
      title,
      message,
      buttons
    });
  },
  hideAlert: () => {
    set({ visible: false, title: '', message: '', buttons: [] });
  }
}));

export const showThemedAlert = (title: string, message: string, buttons?: AlertButton[]) => {
  useThemedAlertStore.getState().showAlert(title, message, buttons);
};

export const ThemedAlertModal: React.FC = () => {
  const { visible, title, message, buttons, hideAlert } = useThemedAlertStore();
  const { theme } = useThemeStore();

  if (!visible) return null;

  const isOmarchy = theme.borderRadius === 4;
  const isSoftMinimal = theme.borderRadius === 16;
  const cardRadius = isOmarchy ? 4 : (isSoftMinimal ? 16 : 24);
  const btnRadius = isOmarchy ? 4 : (isSoftMinimal ? 20 : 16);
  const borderWidthVal = isOmarchy ? 2 : (theme.borderWidth || 1);
  const fontFamilyMono = isOmarchy ? 'JetBrains Mono' : 'monospace';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hideAlert}>
      <View style={styles.overlay}>
        <View style={[
          styles.modalCard,
          {
            backgroundColor: isOmarchy ? '#181825' : theme.cardBg,
            borderColor: isOmarchy ? '#313244' : theme.cardBorder,
            borderRadius: cardRadius,
            borderWidth: borderWidthVal
          }
        ]}>
          <Text style={[
            styles.title,
            {
              color: isOmarchy ? '#F8F8F2' : theme.textMain,
              fontFamily: fontFamilyMono
            }
          ]}>
            {title}
          </Text>

          <Text style={[
            styles.message,
            {
              color: isOmarchy ? '#CDD6F4' : theme.textMuted,
              fontFamily: fontFamilyMono
            }
          ]}>
            {message}
          </Text>

          <View style={styles.buttonRow}>
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let bg = theme.emerald;
              let textColor = '#000000';
              let borderColor = theme.emerald;

              if (isCancel) {
                bg = isOmarchy ? '#1E1E2E' : theme.cardBg;
                textColor = isOmarchy ? '#CDD6F4' : theme.textMuted;
                borderColor = isOmarchy ? '#313244' : theme.cardBorder;
              } else if (isDestructive) {
                bg = theme.red;
                textColor = '#FFFFFF';
                borderColor = theme.red;
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    {
                      backgroundColor: bg,
                      borderColor: borderColor,
                      borderRadius: btnRadius,
                      borderWidth: 1
                    }
                  ]}
                  onPress={() => {
                    hideAlert();
                    if (btn.onPress) btn.onPress();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.buttonText, { color: textColor, fontFamily: fontFamilyMono }]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    lineHeight: 22
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '800'
  }
});
