import { z } from 'zod';
export const folderSchema = z.string().regex(/^(?:inbox|sent|drafts|archive|junk|trash|custom:[a-zA-Z0-9_-]{1,2040})$/);
const id = z.string().min(1).max(2048);
const text = (max = 500) => z.string().max(max);
export const attachmentSchema = z.object({ id, name: text(255), size: z.number().int().min(0).max(20 * 1024 * 1024) }).strict();
export const outgoingSchema = z.object({ to: text(2000), cc: text(2000), bcc: text(2000).optional(), subject: text(998).refine(v => !/[\r\n]/.test(v)), body: text(500000), html: text(1000000).optional(), attachments: z.array(attachmentSchema).max(20), draftId: id.optional(), replyId: id.optional(), replyAll: z.boolean().optional(), forwardId: id.optional(), importance: z.enum(['low', 'normal', 'high']).optional(), readReceipt: z.boolean().optional(), deliveryReceipt: z.boolean().optional(), scheduledAt: z.iso.datetime({ offset: true }).optional(), retainedAttachments: z.array(id).max(100).optional() }).strict();
export const mailActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('read'), id, value: z.boolean() }).strict(),
  z.object({ kind: z.literal('flag'), id, value: z.boolean() }).strict(),
  z.object({ kind: z.literal('move'), id, folder: folderSchema }).strict(),
  z.object({ kind: z.literal('delete'), id }).strict()
]);
const hostname = z.string().max(253).regex(/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/);
export const imapSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(1024), imapHost: hostname, imapPort: z.literal(993), smtpHost: hostname, smtpPort: z.union([z.literal(465), z.literal(587)]) }).strict();
export const clientIdSchema = z.uuid();
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/).refine(v => Number.isFinite(Date.parse(v)), 'Ungültiges Datum');
export const eventSchema = z.object({ id: id.optional(), title: text().min(1), start: localDate, end: localDate, location: text(), notes: text(10000), allDay: z.boolean().optional(), attendees: text(2000).optional(), reminder: z.number().int().min(0).max(40320).optional(), recurrence: z.enum(['none','daily','weekly','monthly']).optional(), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), online: z.boolean().optional(), calendarId: id.optional(), joinUrl: z.url().optional() }).strict().refine(e => Date.parse(e.end) > Date.parse(e.start), 'Das Ende muss nach dem Beginn liegen.');
export const contactSchema = z.object({ id: id.optional(), name: text().min(1), email: z.email().max(254), phone: text(100), company: text(), emails: text(2000).optional(), phones: text(500).optional(), group: text(200).optional() }).strict();
export const taskSchema = z.object({ id: id.optional(), title: text().min(1), due: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]), done: z.boolean(), list: text(200).optional(), notes: text(10000).optional(), reminder: localDate.optional(), recurrence: z.enum(['none','daily','weekly','monthly']).optional(), steps: z.array(z.object({ title: text().min(1), done: z.boolean() }).strict()).max(100).optional() }).strict();
export const preferencesSchema = z.object({ signature: text(10000), notifications: z.boolean(), syncMinutes: z.number().int().min(1).max(60), threads: z.boolean(), readingPane: z.enum(['right','bottom','off']), density: z.enum(['comfortable','compact']), favorites: z.array(folderSchema).max(100), categories: z.array(text(100)).max(100), templates: z.array(z.object({ name: text(100).min(1), subject: text(998), body: text(500000) }).strict()).max(50), sortBy: z.enum(['date','from','subject','importance','flagged']).optional(), sortDescending: z.boolean().optional(), groupByDate: z.boolean().optional(), composeInWindow: z.boolean().optional() }).strict();
const ids = z.array(id).min(1).max(500);
export const commandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('account'), id }).strict(),
  z.object({ kind: z.literal('preferences'), value: preferencesSchema }).strict(),
  z.object({ kind: z.literal('folder'), operation: z.enum(['create','rename','delete']), id: folderSchema.optional(), name: text(200).min(1).refine(v => !/[\x00-\x1f\/\\]/.test(v)).optional(), parent: folderSchema.optional() }).strict(),
  z.object({ kind: z.literal('batch'), ids, action: z.enum(['read','unread','flag','unflag','delete','move','purge']), folder: folderSchema.optional() }).strict(),
  z.object({ kind: z.literal('metadata'), ids, category: text(100).optional(), pinned: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('rules'), value: z.array(z.object({ id, name: text(100), from: text(), subject: text(), target: folderSchema, enabled: z.boolean(), markRead: z.boolean() }).strict().refine(r => !!(r.from.trim() || r.subject.trim()), 'Bitte eine Regelbedingung angeben.')).max(100) }).strict(),
  z.object({ kind: z.literal('sync-all') }).strict(),
  z.object({ kind: z.literal('search'), query: text(200).min(1), all: z.boolean(), folder: folderSchema }).strict(),
  z.object({ kind: z.literal('calendar'), operation: z.enum(['create','rename','delete','visibility']), id: id.optional(), name: text(200).min(1).optional(), visible: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('queue'), message: outgoingSchema }).strict(),
  z.object({ kind: z.literal('autosave'), message: outgoingSchema.nullable() }).strict(),
  z.object({ kind: z.literal('outbox'), operation: z.enum(['send','cancel']), id }).strict(),
  z.object({ kind: z.literal('export'), format: z.enum(['eml','contacts','calendar']), id: id.optional() }).strict(),
  z.object({ kind: z.literal('import'), format: z.enum(['eml','contacts','calendar']) }).strict(),
  z.object({ kind: z.literal('print'), id }).strict(),
  z.object({ kind: z.literal('meeting'), id, response: z.enum(['accept','tentativelyAccept','decline']) }).strict(),
  z.object({ kind: z.literal('auto-reply'), text: text(10000), enabled: z.boolean() }).strict(),
  z.object({ kind: z.literal('check-updates') }).strict(),
  z.object({ kind: z.literal('open-release') }).strict(),
  z.object({ kind: z.literal('default-mail') }).strict()
  ,z.object({ kind: z.literal('open-link'), url: z.url().max(4096).refine(v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } }) }).strict()
]);
export const identifierSchema = id;
export const windowRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mail'), id, accountId: id.optional() }).strict(),
  z.object({ kind: z.literal('compose'), message: outgoingSchema, existing: z.array(z.object({ id, name: text(255), size: z.number().int().min(0) }).strict()).max(100).optional() }).strict()
]);
export function recipients(input: string): string[] {
  const addresses = input.split(/[;,]/).map(v => v.trim()).filter(Boolean);
  if (addresses.length > 50 || addresses.some(v => !z.email().safeParse(v).success)) throw new Error('Bitte gültige E-Mail-Adressen eingeben, getrennt durch Komma oder Semikolon.');
  return addresses;
}
