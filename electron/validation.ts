import { z } from 'zod';
export const folderSchema = z.enum(['inbox', 'sent', 'drafts', 'archive', 'junk', 'trash']);
const id = z.string().min(1).max(2048);
const text = (max = 500) => z.string().max(max);
export const attachmentSchema = z.object({ id, name: text(255), size: z.number().int().min(0).max(2 * 1024 * 1024) }).strict();
export const outgoingSchema = z.object({ to: text(2000), cc: text(2000), subject: text(998), body: text(500000), attachments: z.array(attachmentSchema).max(10), draftId: id.optional() }).strict();
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
export const eventSchema = z.object({ id: id.optional(), title: text().min(1), start: localDate, end: localDate, location: text(), notes: text(10000) }).strict().refine(e => Date.parse(e.end) > Date.parse(e.start), 'Das Ende muss nach dem Beginn liegen.');
export const contactSchema = z.object({ id: id.optional(), name: text().min(1), email: z.email().max(254), phone: text(100), company: text() }).strict();
export const taskSchema = z.object({ id: id.optional(), title: text().min(1), due: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]), done: z.boolean() }).strict();
export const identifierSchema = id;
export function recipients(input: string): string[] {
  const addresses = input.split(/[;,]/).map(v => v.trim()).filter(Boolean);
  if (addresses.length > 50 || addresses.some(v => !z.email().safeParse(v).success)) throw new Error('Bitte gültige E-Mail-Adressen eingeben, getrennt durch Komma oder Semikolon.');
  return addresses;
}
