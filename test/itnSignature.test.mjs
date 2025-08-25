import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { generateSignature } from '../buildPfParamString.mjs';

function pfEncode(v) {
  return encodeURIComponent(String(v))
    .replace(/%20/g, '+')
    .replace(/%[0-9a-f]{2}/g, m => m.toUpperCase());
}

test('includeEmpty option retains blank fields in signature', () => {
  const payload = {
    merchant_id: '10000100',
    merchant_key: '46f0cd694581a',
    return_url: 'https://example.com/return',
    cancel_url: 'https://example.com/cancel',
    notify_url: 'https://example.com/notify',
    name_first: 'Test',
    name_last: 'User',
    email_address: 'test@example.com',
    m_payment_id: '1234',
    amount_gross: '100.00',
    item_name: 'Test Item',
    item_description: '',
    custom_str1: '',
    signature: 'ignored'
  };
  const passphrase = 'mypass';

  const paramString = [
    `merchant_id=${pfEncode('10000100')}`,
    `merchant_key=${pfEncode('46f0cd694581a')}`,
    `return_url=${pfEncode('https://example.com/return')}`,
    `cancel_url=${pfEncode('https://example.com/cancel')}`,
    `notify_url=${pfEncode('https://example.com/notify')}`,
    `name_first=${pfEncode('Test')}`,
    `name_last=${pfEncode('User')}`,
    `email_address=${pfEncode('test@example.com')}`,
    `m_payment_id=${pfEncode('1234')}`,
    `amount_gross=${pfEncode('100.00')}`,
    `item_name=${pfEncode('Test Item')}`,
    `item_description=`,
    `custom_str1=`,
    `passphrase=${pfEncode(passphrase)}`
  ].join('&');

  const expectedSig = crypto.createHash('md5').update(paramString, 'utf8').digest('hex');

  assert.equal(
    generateSignature(payload, passphrase, { includeEmpty: true }),
    expectedSig
  );
  assert.notEqual(generateSignature(payload, passphrase), expectedSig);
});
