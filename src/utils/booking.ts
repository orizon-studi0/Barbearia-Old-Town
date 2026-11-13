export interface BookingRequest {
  name: string;
  phone?: string;
  service: string;
  barber?: string;
  date: string;
  time: string;
  notes?: string;
}

export interface OpenDayChip {
  iso: string;
  weekdayShort: string;
  weekdayFull: string;
  shortDate: string;
  isToday: boolean;
}

export const SERVICES_CATALOG: Record<string, { price: number; name: string; duration: string }> = {
  corte: { name: 'Corte Tradicional', price: 50, duration: '40 min' },
  barba: { name: 'Barba com Toalha Quente', price: 40, duration: '35 min' },
  combo: { name: 'Combo Corte e Barba', price: 80, duration: '75 min' },
  sobrancelha: { name: 'Design de Sobrancelha', price: 20, duration: '15 min' },
  pigmentacao: { name: 'Pigmentação de Barba ou Cabelo', price: 60, duration: '30 min' },
};

export const ALL_TIME_SLOTS: readonly string[] = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30',
];

export const WHATSAPP_PHONE = '5511999998888';

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export function formatIsoDate(dateObj: Date): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatCurrencyBRL(value: number): string {
  return `R$ ${value.toFixed(0)}`;
}

export function isBusinessDay(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  const dayOfWeek = d.getDay();
  return dayOfWeek >= 2 && dayOfWeek <= 6;
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function getShopStatus(now: Date): { isOpen: boolean; label: string } {
  const day = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isOpenDay = day >= 2 && day <= 6;
  const openMin = 9 * 60;
  const closeMin = 20 * 60;

  if (isOpenDay && currentMinutes >= openMin && currentMinutes < closeMin) {
    return { isOpen: true, label: 'Aberto agora' };
  }
  if (isOpenDay && currentMinutes < openMin) {
    return { isOpen: false, label: 'Fechado, abre hoje às 9h' };
  }
  if (day === 0 || (day === 6 && currentMinutes >= closeMin)) {
    return { isOpen: false, label: 'Fechado, abre terça às 9h' };
  }
  return { isOpen: false, label: 'Fechado, abre amanhã às 9h' };
}

export function getNextOpenDays(fromDate: Date, count = 12): OpenDayChip[] {
  const days: OpenDayChip[] = [];
  const todayIso = formatIsoDate(fromDate);
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());

  while (days.length < count) {
    const dow = cursor.getDay();
    if (dow >= 2 && dow <= 6) {
      const iso = formatIsoDate(cursor);
      const dd = String(cursor.getDate()).padStart(2, '0');
      const mm = String(cursor.getMonth() + 1).padStart(2, '0');
      days.push({
        iso,
        weekdayShort: WEEKDAY_SHORT[dow],
        weekdayFull: WEEKDAY_FULL[dow],
        shortDate: `${dd}/${mm}`,
        isToday: iso === todayIso,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function getAvailableTimeSlots(dateIso: string, now: Date): string[] {
  if (!isBusinessDay(dateIso)) return [];
  const todayIso = formatIsoDate(now);
  if (dateIso !== todayIso) {
    return [...ALL_TIME_SLOTS];
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return ALL_TIME_SLOTS.filter((slot) => {
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m > nowMinutes + 15;
  });
}

export function generateWhatsAppBookingUrl(data: BookingRequest): string {
  const serviceInfo = SERVICES_CATALOG[data.service] || { name: data.service, price: 0 };
  const formattedDate = formatDateBR(data.date);
  const barberText = data.barber && data.barber !== 'qualquer' ? data.barber : 'Sem preferência (primeiro disponível)';

  const lines = [
    '*AGENDAMENTO - BARBEARIA OLD TOWN*',
    '',
    `*Cliente:* ${data.name.trim()}`,
    data.phone ? `*WhatsApp:* ${data.phone.trim()}` : null,
    `*Barbeiro:* ${barberText}`,
    `*Serviço:* ${serviceInfo.name}`,
    `*Data:* ${formattedDate}`,
    `*Horário:* ${data.time}`,
    data.notes ? `*Observações:* ${data.notes.trim()}` : null,
    `*Valor estimado:* ${formatCurrencyBRL(serviceInfo.price)}`,
    '',
    'Olá! Gostaria de confirmar este horário na Rua Tuiuti, 55.',
  ].filter(Boolean);

  const message = lines.join('\n');
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}
