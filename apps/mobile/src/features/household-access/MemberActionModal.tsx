import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import './i18n';
export default function MemberActionModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation('householdAccess');
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View className="flex-1 justify-center bg-black/40 p-4">
      <View accessibilityViewIsModal className="w-full max-w-lg self-center rounded-2xl bg-white" style={{ maxHeight: '90%' }}>
        <Pressable accessibilityRole="button" onPress={onClose} className="self-end px-5 py-4"><Text className="font-semibold text-pine">{t('close')}</Text></Pressable>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-6">{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}
