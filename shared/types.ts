export type Folder = string;
export type View = 'mail' | 'calendar' | 'contacts' | 'tasks';
export interface Attachment { id: string; name: string; size: number }
export interface Mail {
  id: string; folder: Folder; sender: string; address: string; to: string; cc?: string;
  subject: string; body: string; date: string; read: boolean; flagged: boolean;
  attachments: Attachment[];
  html?: string; bcc?: string; replyTo?: string; messageId?: string; references?: string;
  conversationId?: string; categories?: string[]; pinned?: boolean; importance?: 'low' | 'normal' | 'high';
  accountId?: string;
}
export interface CalendarEvent { id: string; title: string; start: string; end: string; location: string; notes: string; allDay?: boolean; attendees?: string; reminder?: number; recurrence?: 'none' | 'daily' | 'weekly' | 'monthly'; until?: string; online?: boolean; joinUrl?: string; calendarId?: string }
export interface Contact { id: string; name: string; email: string; phone: string; company: string; emails?: string; phones?: string; group?: string }
export interface Task { id: string; title: string; due: string; done: boolean; list?: string; notes?: string; reminder?: string; recurrence?: 'none' | 'daily' | 'weekly' | 'monthly'; steps?: { title: string; done: boolean }[] }
export interface State {
  mode: 'demo' | 'microsoft' | 'imap'; email: string; name: string;
  mails: Mail[]; events: CalendarEvent[]; contacts: Contact[]; tasks: Task[];
  updatedAt: string | null; theme: 'light' | 'dark'; notice?: string;
  accountId?: string; accounts?: { id: string; email: string; name: string; mode: State['mode'] }[];
  folders?: { id: string; name: string; parent?: string }[];
  preferences?: Preferences; rules?: Rule[]; outbox?: QueuedMessage[];
  completeFolders?: string[]; syncError?: string;
  unifiedMails?: Mail[];
  workingDraft?: Outgoing;
  calendars?: { id: string; name: string; visible: boolean; isDefault?: boolean; canEdit?: boolean }[];
}
export interface Outgoing { to: string; cc: string; subject: string; body: string; attachments: Attachment[]; draftId?: string; bcc?: string; html?: string; replyId?: string; replyAll?: boolean; forwardId?: string; importance?: 'low' | 'normal' | 'high'; readReceipt?: boolean; deliveryReceipt?: boolean; scheduledAt?: string; retainedAttachments?: string[]; inReplyTo?: string; references?: string }
export type SortKey = 'date' | 'from' | 'subject' | 'importance' | 'flagged';
export interface Preferences { signature: string; notifications: boolean; syncMinutes: number; threads: boolean; readingPane: 'right' | 'bottom' | 'off'; density: 'comfortable' | 'compact'; favorites: string[]; categories: string[]; templates: { name: string; subject: string; body: string }[]; sortBy: SortKey; sortDescending: boolean; groupByDate: boolean; composeInWindow: boolean }
export interface Rule { id: string; name: string; from: string; subject: string; target: Folder; enabled: boolean; markRead: boolean }
export interface QueuedMessage { id: string; message: Outgoing; createdAt: string; status: 'pending' | 'uncertain' | 'failed'; error?: string }
export type Command =
 | { kind: 'account'; id: string }
 | { kind: 'preferences'; value: Preferences }
 | { kind: 'folder'; operation: 'create' | 'rename' | 'delete'; id?: string; name?: string; parent?: string }
 | { kind: 'batch'; ids: string[]; action: 'read' | 'unread' | 'flag' | 'unflag' | 'delete' | 'move' | 'purge'; folder?: string }
 | { kind: 'metadata'; ids: string[]; category?: string; pinned?: boolean }
 | { kind: 'rules'; value: Rule[] }
 | { kind: 'sync-all' }
 | { kind: 'queue'; message: Outgoing }
 | { kind: 'autosave'; message: Outgoing | null }
 | { kind: 'outbox'; operation: 'send' | 'cancel'; id: string }
 | { kind: 'export'; format: 'eml' | 'contacts' | 'calendar'; id?: string }
 | { kind: 'import'; format: 'eml' | 'contacts' | 'calendar' }
 | { kind: 'print'; id: string }
 | { kind: 'meeting'; id: string; response: 'accept' | 'tentativelyAccept' | 'decline' }
 | { kind: 'auto-reply'; text: string; enabled: boolean }
 | { kind: 'check-updates' }
 | { kind: 'open-release' }
 | { kind: 'default-mail' }
 | { kind: 'open-link'; url: string }
 | { kind: 'search'; query: string; all: boolean; folder: string }
 | { kind: 'calendar'; operation: 'create' | 'rename' | 'delete' | 'visibility'; id?: string; name?: string; visible?: boolean };
export interface ImapSettings { email: string; password: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }
export interface Capabilities { desktop: boolean; secureStorage: boolean; platform: string }
export type MailAction = { id: string; kind: 'read'; value: boolean } | { id: string; kind: 'flag'; value: boolean } | { id: string; kind: 'move'; folder: Folder } | { id: string; kind: 'delete' };
export type WindowRequest = { kind: 'mail'; id: string; accountId?: string } | { kind: 'compose'; message: Outgoing; existing?: Attachment[] };
export interface Bridge {
  state(): Promise<State>; capabilities(): Promise<Capabilities>;
  sync(folder: Folder): Promise<State>; mailAction(action: MailAction): Promise<State>;
  send(message: Outgoing): Promise<State>; saveDraft(message: Outgoing): Promise<State>;
  pickAttachments(): Promise<Attachment[]>; downloadAttachment(mailId: string, attachmentId: string): Promise<boolean>;
  connectMicrosoft(clientId: string): Promise<State>; connectImap(settings: ImapSettings): Promise<State>;
  disconnect(): Promise<State>; demo(): Promise<State>;
  saveEvent(event: Omit<CalendarEvent, 'id'> & { id?: string }): Promise<State>; deleteEvent(id: string): Promise<State>;
  saveContact(contact: Omit<Contact, 'id'> & { id?: string }): Promise<State>; deleteContact(id: string): Promise<State>;
  saveTask(task: Omit<Task, 'id'> & { id?: string }): Promise<State>; deleteTask(id: string): Promise<State>;
  theme(theme: 'light' | 'dark'): Promise<State>;
  manage(command: Command): Promise<State>;
  onState?(callback: (state: State) => void): () => void;
  openWindow?(request: WindowRequest): Promise<void>; windowPayload?(): Promise<WindowRequest | null>;
}
