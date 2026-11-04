import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import './i18n';

interface WhatsAppConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function WhatsAppConfirmModal({
  visible,
  onClose,
  onConfirm,
}: WhatsAppConfirmModalProps) {
  const { t } = useTranslation('whatsapp');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/50 p-4">
        <View
          accessibilityViewIsModal
          className="w-full max-w-sm rounded-3xl bg-white p-6 gap-4 shadow-xl border border-[#E2EFE8]"
        >
          {/* Header with WhatsApp Logo */}
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 rounded-full bg-[#25D366] items-center justify-center shadow-xs">
              <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-extrabold text-pine">
                {t('chatPromptTitle', 'Asistente ArkAI en WhatsApp')}
              </Text>
              <Text className="text-xs text-sage font-medium">WhatsApp Bot</Text>
            </View>
          </View>

          {/* Body Text */}
          <Text className="text-sm text-[#263C33] leading-relaxed">
            {t(
              'chatPrompt',
              '¿Prefieres registrar gastos enviando audios o fotos por WhatsApp? Chatea aquí con tu Asistente ArkAI.'
            )}
          </Text>

          {/* Action Buttons */}
          <View className="flex-row items-center gap-3 mt-2">
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              className="flex-1 rounded-xl border border-[#D3E8DC] py-3 items-center active:bg-[#F4FAF6]"
            >
              <Text className="text-sm font-semibold text-pine">
                {t('cancel', 'Cancelar')}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              className="flex-1 rounded-xl bg-[#25D366] active:bg-[#1EBE5D] py-3 items-center flex-row justify-center gap-1.5 shadow-xs"
            >
              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white">
                {t('openChat', 'Chatear')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

