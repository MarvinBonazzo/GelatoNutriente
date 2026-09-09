import type { Appointment } from './models'

export function validateAppointment(a: Appointment) {
  if (!a.patientId || !a.title.trim() || !Number.isFinite(Date.parse(a.startsAt))) throw new Error('Paziente, titolo e data sono obbligatori.')
  if (!Number.isInteger(a.durationMinutes) || a.durationMinutes < 5 || a.durationMinutes > 1440) throw new Error('La durata deve essere tra 5 e 1.440 minuti.')
  if (!Number.isInteger(a.reminderMinutesBefore) || a.reminderMinutesBefore < 0 || a.reminderMinutesBefore > 10080) throw new Error('Scegli un promemoria entro i sette giorni precedenti.')
  try { new Intl.DateTimeFormat('it', { timeZone: a.timeZone }) } catch { throw new Error('Fuso orario non valido.') }
}
const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`).replace(/\r/g, '')
const utc = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
function foldLine(line: string) {
  const result: string[] = []; let current = ''; let length = 0
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length
    if (length + bytes > 73) { result.push(current); current = ' '; length = 1 }
    current += char; length += bytes
  }
  result.push(current); return result.join('\r\n')
}
export function appointmentIcs(a: Appointment) {
  validateAppointment(a)
  const end = new Date(Date.parse(a.startsAt) + a.durationMinutes * 60000).toISOString()
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GelatoNutriente//Appuntamenti//IT', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${encodeURIComponent(a.id)}@gelatonutriente`, `DTSTAMP:${utc(a.updatedAt)}`, `DTSTART:${utc(a.startsAt)}`, `DTEND:${utc(end)}`, `SUMMARY:${escapeText(a.title)}`, `LOCATION:${escapeText(a.location)}`, `STATUS:${a.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`]
  // Private clinical notes are deliberately excluded from calendar transfers.
  if (a.status === 'scheduled') lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${a.reminderMinutesBefore}M`, 'DESCRIPTION:Appuntamento con il nutrizionista', 'END:VALARM')
  return [...lines, 'END:VEVENT', 'END:VCALENDAR'].map(foldLine).join('\r\n') + '\r\n'
}

export function dueAppointments(appointments: Appointment[], at = Date.now()) {
  return appointments.filter(a => a.status === 'scheduled' && !a.reminderAcknowledgedAt && Date.parse(a.startsAt) >= at && Date.parse(a.startsAt) - a.reminderMinutesBefore * 60000 <= at)
}
