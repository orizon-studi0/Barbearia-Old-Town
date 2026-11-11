export interface BookingRequest {
  name: string;
  phone?: string;
  service: string;
  barber?: string;
  date: string;
  time: string;
  notes?: string;
}

export const SERVICES_CATALOG: Record<string, { price: number; name: string }> = {
  corte: { name: 'Corte Tradicional', price: 50 },
  barba: { name: 'Barba com Toalha Quente', price: 40 },
  combo: { name: 'Combo Corte e Barba', price: 80 },
  sobrancelha: { name: 'Design de Sobrancelha', price: 20 },
  pigmentacao: { name: 'Pigmentação de Barba ou Cabelo', price: 60 },
};

export const WHATSAPP_PHONE = '5511999998888';

/**
 * Format a number as BRL currency string
 */
export function formatCurrencyBRL(value: number): string {
  return `R$ ${value.toFixed(0)}`;
}

/**
 * Check if a date string (YYYY-MM-DD) is a Tuesday through Saturday
 * (0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday)
 */
export function isBusinessDay(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  const dayOfWeek = d.getDay();
  // Barbearia Old Town opens Tuesday (2) to Saturday (6)
  return dayOfWeek >= 2 && dayOfWeek <= 6;
}

/**
 * Convert YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Build the WhatsApp booking link with properly encoded message
 */
export function generateWhatsAppBookingUrl(data: BookingRequest): string {
  const serviceInfo = SERVICES_CATALOG[data.service] || { name: data.service, price: 0 };
  const formattedDate = formatDateBR(data.date);
  const barberText = data.barber && data.barber !== 'qualquer' ? data.barber : 'Sem preferência (primeiro disponível)';
  
  const lines = [
    '💈 *NOVO AGENDAMENTO - BARBEARIA OLD TOWN*',
    '',
    `👤 *Cliente:* ${data.name.trim()}`,
    data.phone ? `📱 *Telefone:* ${data.phone.trim()}` : null,
    `✂️ *Serviço:* ${serviceInfo.name} (${formatCurrencyBRL(serviceInfo.price)})`,
    `💈 *Barbeiro:* ${barberText}`,
    `📅 *Data:* ${formattedDate}`,
    `⏰ *Horário:* ${data.time}`,
    data.notes ? `📝 *Observações:* ${data.notes.trim()}` : null,
    '',
    'Por favor, confirme se este horário está disponível! Obrigado.',
  ].filter(Boolean);

  const message = lines.join('\n');
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}
