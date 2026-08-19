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
  const modalState = useThemedAlertStore();
  const { visible, title, message, buttons, hideAlert } = modalState;
  const { theme } = useThemeStore();

  if (!visible) return null;

  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (theme.borderRadius || 4);
  const btnRadius = theme.radiusBtn !== undefined ? theme.radiusBtn : (theme.borderRadius || 4);
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMain = theme.fontFamily || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'JetBrains Mono');
  const fontFamilyMono = theme.fontMono || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'monospace');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hideAlert}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              borderRadius: cardRadius,
              borderWidth: borderWidthVal,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 16
            }
          ]}
        >
          <Text
            style={[
              styles.title,
              {
                color: theme.textMain,
                fontFamily: fontFamilyMain
              }
            ]}
          >
            {title}
          </Text>

          <Text
            style={[
              styles.message,
              {
                color: theme.textMuted,
                fontFamily: fontFamilyMono
              }
            ]}
          >
            {message}
          </Text>

          <View style={styles.buttonRow}>
            {buttons.map((btn, index) => {
              let bg = theme.emerald;
              let textColor = theme.background;
              let borderColor = theme.emerald;

              if (btn.style === 'cancel') {
                bg = theme.cardBg;
                textColor = theme.textMuted;
                borderColor = theme.cardBorder;
              } else if (btn.style === 'destructive') {
                bg = theme.red;
                textColor = theme.background;
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
                      borderWidth: borderWidthVal
                    }
                  ]}
                  onPress={() => {
                    hideAlert();
                    if (btn.onPress) btn.onPress();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.buttonText, { color: textColor, fontFamily: fontFamilyMain }]}>
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
