import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICES_CATALOG,
  formatCurrencyBRL,
  isBusinessDay,
  formatDateBR,
  generateWhatsAppBookingUrl,
  WHATSAPP_PHONE,
} from './booking';

test('SERVICES_CATALOG contains all requested services with exact prices', () => {
  assert.equal(SERVICES_CATALOG.corte.price, 50);
  assert.equal(SERVICES_CATALOG.barba.price, 40);
  assert.equal(SERVICES_CATALOG.combo.price, 80);
  assert.equal(SERVICES_CATALOG.sobrancelha.price, 20);
  assert.equal(SERVICES_CATALOG.pigmentacao.price, 60);
});

test('formatCurrencyBRL formats prices properly', () => {
  assert.equal(formatCurrencyBRL(50), 'R$ 50');
  assert.equal(formatCurrencyBRL(80), 'R$ 80');
});

test('isBusinessDay correctly validates Tuesday to Saturday', () => {
  // 2026-11-10 is Tuesday (day 2)
  assert.equal(isBusinessDay('2026-11-10'), true);
  // 2026-11-11 is Wednesday (day 3)
  assert.equal(isBusinessDay('2026-11-11'), true);
  // 2026-11-14 is Saturday (day 6)
  assert.equal(isBusinessDay('2026-11-14'), true);
  // 2026-11-15 is Sunday (day 0 - closed)
  assert.equal(isBusinessDay('2026-11-15'), false);
  // 2026-11-16 is Monday (day 1 - closed)
  assert.equal(isBusinessDay('2026-11-16'), false);
});

test('formatDateBR converts ISO date to Brazilian standard', () => {
  assert.equal(formatDateBR('2026-11-14'), '14/11/2026');
  assert.equal(formatDateBR(''), '');
});

test('generateWhatsAppBookingUrl constructs valid URL with encoded message', () => {
  const url = generateWhatsAppBookingUrl({
    name: 'Carlos Alberto',
    phone: '(11) 98765-4321',
    service: 'combo',
    barber: 'Marco Silveira',
    date: '2026-11-14',
    time: '15:00',
  });

  assert.ok(url.startsWith(`https://wa.me/${WHATSAPP_PHONE}?text=`));
  const decoded = decodeURIComponent(url);
  assert.ok(decoded.includes('Carlos Alberto'));
  assert.ok(decoded.includes('Combo Corte e Barba (R$ 80)'));
  assert.ok(decoded.includes('Marco Silveira'));
  assert.ok(decoded.includes('14/11/2026'));
  assert.ok(decoded.includes('15:00'));
});
