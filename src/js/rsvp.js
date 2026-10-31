// "I'm going": members mark the events they plan to attend, and everyone sees how many are going.
import { getClient } from './supabase.js';
import { isConfigured } from './core.js';
import { demoStore, demoSave } from './api.js';

/** { going, mine } or { off: true } when the database part is not installed yet. */
export async function rsvpState(eventId, userId) {
  try {
    if (!isConfigured()) { const r = (demoStore().rsvps ||= []).filter(x => x.event_id === eventId); return { going: r.length, mine: !!userId && r.some(x => x.user_id === userId) }; }
    const c = await getClient();
    const [n, mine] = await Promise.all([c.rpc('event_rsvp_count', { p_event: eventId }), userId ? c.from('event_rsvps').select('event_id').eq('event_id', eventId).eq('user_id', userId).maybeSingle() : { data: null }]);
    if (n.error) return { off: true };
    return { going: Number(n.data) || 0, mine: !!mine.data };
  } catch { return { off: true }; }
}
export async function setRsvp(eventId, user, on) {
  if (!isConfigured()) { const d = demoStore(), list = (d.rsvps ||= []).filter(x => !(x.event_id === eventId && x.user_id === user.id)); if (on) list.push({ event_id: eventId, user_id: user.id }); d.rsvps = list; demoSave(); return; }
  const c = await getClient();
  const { error } = on ? await c.from('event_rsvps').insert({ event_id: eventId, user_id: user.id }) : await c.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', user.id);
  if (error && !/duplicate/i.test(error.message)) throw new Error(/schema cache|event_rsvps/i.test(error.message) ? 'RSVP is not switched on yet. An administrator needs to run 0015_event_rsvps.sql in Supabase.' : error.message);
}
