import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import './i18n';
export default function PasswordField({ value, onChangeText, label, disabled, newPassword = false, onSubmit }: { value: string; onChangeText: (value: string) => void; label: string; disabled: boolean; newPassword?: boolean; onSubmit?: () => void }) {
  const { t } = useTranslation('authFlow'); const [visible, setVisible] = useState(false);
  return <View className="flex-row items-center rounded-xl border border-[#D3E8DC] bg-white px-3">
    <TextInput accessibilityLabel={label} placeholder={label} value={value} onChangeText={onChangeText} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete={newPassword ? 'new-password' : 'current-password'} textContentType={newPassword ? 'newPassword' : 'password'} editable={!disabled} onSubmitEditing={onSubmit} className="flex-1 py-3 text-base text-pine" />
    <Pressable accessibilityRole="button" accessibilityLabel={t(visible ? 'hidePassword' : 'showPassword')} disabled={disabled} onPress={() => setVisible(!visible)} className="p-2"><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#0B3D2E" /></Pressable>
  </View>;
}
