import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICES_CATALOG,
  formatCurrencyBRL,
  isBusinessDay,
  formatDateBR,
  getNextOpenDays,
  getAvailableTimeSlots,
  getShopStatus,
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
  assert.equal(isBusinessDay('2026-11-10'), true);
  assert.equal(isBusinessDay('2026-11-14'), true);
  assert.equal(isBusinessDay('2026-11-15'), false);
  assert.equal(isBusinessDay('2026-11-16'), false);
});

test('getNextOpenDays returns 12 days excluding Sunday and Monday', () => {
  const friday = new Date(2026, 10, 13, 10, 0);
  const days = getNextOpenDays(friday, 12);
  assert.equal(days.length, 12);
  assert.equal(days[0].iso, '2026-11-13');
  assert.equal(days[0].isToday, true);
  assert.equal(days[1].iso, '2026-11-14');
  // Skips 15 (Sun) and 16 (Mon)
  assert.equal(days[2].iso, '2026-11-17');
  assert.ok(days.every((d) => isBusinessDay(d.iso)));
});

test('getAvailableTimeSlots hides past slots when date is today and keeps 12:00/12:30 closed', () => {
  const fridayMorning = new Date(2026, 10, 13, 11, 20);
  const todaySlots = getAvailableTimeSlots('2026-11-13', fridayMorning);
  assert.equal(todaySlots[0], '13:00');
  assert.ok(!todaySlots.includes('11:30'));
  assert.ok(!todaySlots.includes('12:00'));
  assert.ok(!todaySlots.includes('12:30'));

  const futureSlots = getAvailableTimeSlots('2026-11-14', fridayMorning);
  assert.equal(futureSlots.length, 20);
  assert.equal(futureSlots[0], '09:00');
  assert.ok(!futureSlots.includes('12:00'));
});

test('getShopStatus returns exact open and closed states', () => {
  assert.deepEqual(getShopStatus(new Date(2026, 10, 13, 14, 0)), {
    isOpen: true,
    label: 'Aberto agora',
  });
  assert.deepEqual(getShopStatus(new Date(2026, 10, 15, 14, 0)), {
    isOpen: false,
    label: 'Fechado, abre terça às 9h',
  });
  assert.deepEqual(getShopStatus(new Date(2026, 10, 16, 14, 0)), {
    isOpen: false,
    label: 'Fechado, abre amanhã às 9h',
  });
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
  assert.ok(decoded.includes('Combo Corte e Barba'));
  assert.ok(decoded.includes('R$ 80'));
  assert.ok(decoded.includes('Marco Silveira'));
  assert.ok(decoded.includes('14/11/2026'));
  assert.ok(decoded.includes('15:00'));
});
