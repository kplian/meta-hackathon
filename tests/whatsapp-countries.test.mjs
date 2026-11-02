import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectCountry, internationalPhone, splitPhone, supportedCountry } from '../apps/mobile/src/features/whatsapp/countries.ts';

test('household country is validated independently of language', () => {
  assert.equal(supportedCountry('bo'), 'BO');
  assert.equal(supportedCountry('XX'), undefined);
});
test('device timezone suggests Bolivia even with an English locale', () => {
  assert.equal(detectCountry('America/La_Paz', 'en-US'), 'BO');
  assert.equal(detectCountry('Europe/Madrid', 'es'), 'ES');
});
test('ambiguous or missing timezone uses only an explicit locale region', () => {
  assert.equal(detectCountry('Etc/UTC', 'pt-BR'), 'BR');
  assert.equal(detectCountry('Etc/UTC', 'es'), undefined);
});
test('saved numbers preserve their country instead of the suggested country', () => {
  assert.deepEqual(splitPhone('+442079460018', 'BO'), { country: 'GB', national: '2079460018' });
  assert.deepEqual(splitPhone('+59171234567', 'US'), { country: 'BO', national: '71234567' });
});
test('local numbers are normalized with country calling codes and national trunk prefixes', () => {
  assert.equal(internationalPhone('71234567', 'BO'), '+59171234567');
  assert.equal(internationalPhone('020 7946 0018', 'GB'), '+442079460018');
  assert.equal(internationalPhone('+591 71234567', 'US'), '+59171234567');
});
test('invalid input and local numbers without a country are rejected', () => {
  for (const input of ['', '123', 'hello', '71234567 ext 5']) assert.equal(internationalPhone(input, 'BO'), undefined);
  assert.equal(internationalPhone('71234567'), undefined);
});
