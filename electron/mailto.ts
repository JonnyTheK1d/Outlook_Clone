import type { Outgoing } from '../shared/types';
import { outgoingSchema, recipients } from './validation';
export function parseMailto(value: string): Outgoing {
  if (value.length > 20000) throw new Error('Die Mailto-Adresse ist zu lang.');
  const url = new URL(value);
  if (url.protocol !== 'mailto:') throw new Error('Ungültiges Mailto-Protokoll.');
  const to = decodeURIComponent(url.pathname);
  const message = outgoingSchema.parse({ to, cc:url.searchParams.get('cc') || '', bcc:url.searchParams.get('bcc') || '', subject:url.searchParams.get('subject') || '', body:url.searchParams.get('body') || '',attachments:[] });
  recipients(message.to);recipients(message.cc);recipients(message.bcc || '');
  return message;
}
