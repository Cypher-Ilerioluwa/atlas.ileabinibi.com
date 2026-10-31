// "Report": anyone can flag a message. It lands in the same Corrections list the team already reviews in the admin area.
import { getClient } from './supabase.js';
import { isConfigured } from './core.js';
import { demoStore, demoSave, newId } from './api.js';

export const REASONS = { spam: 'Spam or advertising', abuse: 'Harassment or hate', adult: 'Sexual or violent content', private: 'Private information', other: 'Something else' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function reportContent({ kind, id, user, reason, summary }) {
  const message = `Report (${REASONS[reason] || 'Something else'}): ${summary}`.slice(0, 1500).padEnd(10, '.');
  if (!isConfigured()) { const d = demoStore(); d.corr.unshift({ id: newId(), record_type: kind, record_id: id, message, contact_email: null, status: 'open', created_at: new Date().toISOString() }); demoSave(); return; }
  const c = await getClient();
  const { error } = await c.from('correction_requests').insert({ user_id: user?.id ?? null, record_type: kind, record_id: UUID.test(String(id)) ? id : null, message });
  if (error) throw new Error('Could not send the report. Please try again.');
}
