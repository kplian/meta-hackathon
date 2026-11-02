import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { getTimezone, getCountry } from 'countries-and-timezones';

export type { CountryCode };
export const countries = getCountries();
export function supportedCountry(value?: string | null): CountryCode | undefined {
  return countries.find((country) => country === value?.toUpperCase());
}

// Device settings are a suggestion, never evidence of the user's physical location.
export function detectCountry(timezone?: string, locale?: string): CountryCode | undefined {
  try {
    const zone = getTimezone(timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (zone?.countries.length === 1) return supportedCountry(zone.countries[0]);
    const region = new Intl.Locale(locale ?? Intl.DateTimeFormat().resolvedOptions().locale).region;
    return supportedCountry(region);
  } catch { return undefined; }
}
export function countryName(country: CountryCode, language: string): string {
  try { return new Intl.DisplayNames([language], { type: 'region' }).of(country) ?? country; }
  catch { return getCountry(country)?.name ?? country; }
}
export { getCountryCallingCode };
export function splitPhone(value: string, fallback?: CountryCode) {
  const parsed = parsePhoneNumberFromString(value);
  if (parsed) {
    const country = parsed.country ?? (fallback && getCountryCallingCode(fallback) === parsed.countryCallingCode ? fallback : undefined);
    if (country) return { country, national: String(parsed.nationalNumber) };
  }
  return { country: fallback, national: value };
}
export function internationalPhone(value: string, country?: CountryCode): string | undefined {
  if (!/^[+\d\s().-]+$/.test(value)) return undefined;
  const parsed = parsePhoneNumberFromString(value, country);
  if (!parsed?.isPossible() || parsed.ext) return undefined;
  return parsed.number;
}
