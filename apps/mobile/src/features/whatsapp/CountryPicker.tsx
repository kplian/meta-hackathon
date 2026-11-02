import './i18n';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { countries, countryName, getCountryCallingCode, type CountryCode } from './countries';

interface Props { value?: CountryCode; onChange: (country: CountryCode) => void; disabled?: boolean; callingCode?: boolean }
export default function CountryPicker({ value, onChange, disabled, callingCode = true }: Props) {
  const { t, i18n } = useTranslation('whatsapp');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const options = countries.map((code) => ({ code, name: countryName(code, language), prefix: `+${getCountryCallingCode(code)}` }))
    .sort((a, b) => a.name.localeCompare(b.name, language))
    .filter((item) => `${item.name} ${item.code} ${item.prefix}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <>
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={t('country')}
      accessibilityState={{ expanded: open, disabled }} onPress={() => { setSearch(''); setOpen(true); }}
      className="rounded-xl border border-[#D3E8DC] bg-[#F4FAF6] px-3 py-3">
      <Text numberOfLines={1} className="text-pine">{value ? `${countryName(value, language)}${callingCode ? ` +${getCountryCallingCode(value)}` : ''}` : t('selectCountry')} ▾</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View className="flex-1 items-center justify-center bg-black/40 px-5 py-12">
        <View className="w-full max-w-lg rounded-2xl bg-white p-5" style={{ maxHeight: '85%' }}>
          <Text className="mb-3 text-lg font-bold text-pine">{t('country')}</Text>
          <TextInput value={search} onChangeText={setSearch} accessibilityLabel={t('searchCountry')}
            placeholder={t('searchCountry')} autoCorrect={false} className="mb-3 rounded-xl border border-[#D3E8DC] p-3" />
          <ScrollView keyboardShouldPersistTaps="handled">
            {options.map((item) => <Pressable key={item.code} accessibilityRole="button"
              accessibilityState={{ selected: item.code === value }} onPress={() => { onChange(item.code); setOpen(false); }}
              className={`border-b border-[#E2EFE8] py-3 ${item.code === value ? 'bg-mint' : ''}`}>
              <Text className="text-pine">{item.name} {callingCode ? item.prefix : ''}</Text>
            </Pressable>)}
            {!options.length ? <Text className="p-3 text-sage">{t('noCountries')}</Text> : null}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} className="mt-3 p-3">
            <Text className="text-center font-bold text-pine">{t('back')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </>;
}
