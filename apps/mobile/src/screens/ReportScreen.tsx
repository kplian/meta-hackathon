import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { REPORT_CONSTANTS } from '../i18n';
import { fetchReport, getReportLanguageFromUrl, type ReportData } from '../lib/report';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; report: ReportData }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

interface ReportScreenProps {
  token: string;
}

/**
 * Public monthly report opened from the WhatsApp "Ver reporte" button.
 * No login: the short-lived token in the URL is the only credential.
 */
export default function ReportScreen({ token }: ReportScreenProps) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  // Not persisted: the link language must not change the app's saved language.
  useEffect(() => {
    const lang = getReportLanguageFromUrl();
    if (lang === 'es' || lang === 'en' || lang === 'pt') {
      i18n.changeLanguage(lang);
    }
  }, [i18n]);

  useEffect(() => {
    let active = true;
    fetchReport(token)
      .then((result) => {
        if (!active) return;
        if (result.status === 'ok') setState({ kind: 'ready', report: result });
        else setState({ kind: result.status });
      })
      .catch((err: unknown) => {
        if (active) setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      active = false;
    };
  }, [token]);

  const locale = i18n.language?.slice(0, 2) || 'es';

  if (state.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-mint">
        <ActivityIndicator size="large" color="#0B3D2E" />
        <Text className="mt-3 text-sm text-sage">{t(REPORT_CONSTANTS.LOADING)}</Text>
      </View>
    );
  }

  if (state.kind !== 'ready') {
    const titleKey =
      state.kind === 'expired'
        ? REPORT_CONSTANTS.EXPIRED_TITLE
        : state.kind === 'invalid'
          ? REPORT_CONSTANTS.INVALID_TITLE
          : REPORT_CONSTANTS.ERROR_TITLE;
    const desc =
      state.kind === 'expired'
        ? t(REPORT_CONSTANTS.EXPIRED_DESC)
        : state.kind === 'invalid'
          ? t(REPORT_CONSTANTS.INVALID_DESC)
          : state.message;
    return (
      <View className="flex-1 items-center justify-center bg-mint px-6">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-mint-deep">
          <MaterialCommunityIcons name="link-variant-off" size={26} color="#0B3D2E" />
        </View>
        <Text className="mt-4 text-center text-lg font-bold text-pine">{t(titleKey)}</Text>
        <Text className="mt-2 max-w-sm text-center text-sm text-sage">{desc}</Text>
      </View>
    );
  }

  const { report } = state;
  const money = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: report.household.currency || 'BOB',
      maximumFractionDigits: 0,
    }).format(value);
  const rawMonth = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${report.period_month}T00:00:00Z`),
  );
  const monthLabel = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
  const expiresLabel = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(report.expires_at),
  );
  const balance = report.totals.income - report.totals.expense;
  const maxSpent = Math.max(...report.categories.map((c) => c.spent), 1);

  return (
    <SafeAreaView className="flex-1 bg-mint">
      <ScrollView contentContainerClassName="mx-auto w-full max-w-xl px-4 pb-10 pt-6">
        <Text className="text-xs font-semibold uppercase tracking-widest text-sage">{t(REPORT_CONSTANTS.TITLE)}</Text>
        <Text className="mt-1 text-2xl font-bold text-pine">{report.household.name}</Text>
        <Text className="text-sm text-sage">{monthLabel}</Text>

        <View className="mt-5 rounded-2xl bg-pine p-5">
          <Text className="text-xs font-semibold uppercase tracking-widest text-mint-deep">
            {t(REPORT_CONSTANTS.BALANCE)}
          </Text>
          <Text className="mt-1 text-3xl font-bold text-white">{money(balance)}</Text>
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-xl bg-pine-dark p-3">
              <Text className="text-xs text-mint-deep">{t(REPORT_CONSTANTS.INCOME)}</Text>
              <Text className="mt-1 text-base font-semibold text-white">{money(report.totals.income)}</Text>
            </View>
            <View className="flex-1 rounded-xl bg-pine-dark p-3">
              <Text className="text-xs text-mint-deep">{t(REPORT_CONSTANTS.EXPENSE)}</Text>
              <Text className="mt-1 text-base font-semibold text-white">{money(report.totals.expense)}</Text>
            </View>
          </View>
        </View>

        <View className="mt-4 rounded-2xl bg-white p-5">
          <Text className="mb-3 text-base font-bold text-pine">{t(REPORT_CONSTANTS.BY_CATEGORY)}</Text>
          {report.categories.length === 0 ? (
            <Text className="text-sm text-sage">{t(REPORT_CONSTANTS.NO_DATA)}</Text>
          ) : (
            report.categories.map((category) => {
              const hasBudget = category.budget != null && category.budget > 0;
              const ratio = hasBudget ? category.spent / (category.budget as number) : category.spent / maxSpent;
              const over = hasBudget && ratio > 1;
              return (
                <View key={category.category_key} className="mb-4">
                  <View className="flex-row items-baseline justify-between">
                    <Text className="flex-1 pr-2 text-sm font-medium text-pine" numberOfLines={1}>
                      {category.name}
                    </Text>
                    <Text className={`text-sm font-semibold ${over ? 'text-red-700' : 'text-pine'}`}>
                      {money(category.spent)}
                    </Text>
                  </View>
                  <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-mint-deep">
                    <View
                      className={`h-2 rounded-full ${over ? 'bg-red-600' : 'bg-pine'}`}
                      style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                    />
                  </View>
                  <Text className="mt-1 text-xs text-sage">
                    {hasBudget
                      ? t(REPORT_CONSTANTS.OF_BUDGET, { budget: money(category.budget as number) })
                      : t(REPORT_CONSTANTS.NO_BUDGET)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View className="mt-4 rounded-2xl bg-white p-5">
          <Text className="mb-2 text-base font-bold text-pine">{t(REPORT_CONSTANTS.RECENT)}</Text>
          {report.transactions.length === 0 ? (
            <Text className="text-sm text-sage">{t(REPORT_CONSTANTS.NO_DATA)}</Text>
          ) : (
            report.transactions.map((tx, index) => (
              <View
                key={`${tx.date}-${index}`}
                className={`flex-row items-center py-3 ${index > 0 ? 'border-t border-mint-deep' : ''}`}
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-mint">
                  <MaterialCommunityIcons
                    name={tx.type === 'income' ? 'arrow-down-left' : 'arrow-up-right'}
                    size={18}
                    color="#0B3D2E"
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-medium text-pine" numberOfLines={1}>
                    {tx.concept || '—'}
                  </Text>
                  <Text className="text-xs text-sage">
                    {new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(tx.date))}
                  </Text>
                </View>
                <Text className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-700' : 'text-pine'}`}>
                  {tx.type === 'income' ? '+' : '−'}
                  {money(tx.amount)}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text className="mt-6 text-center text-xs text-sage">
          {t(REPORT_CONSTANTS.EXPIRES_AT, { time: expiresLabel })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
