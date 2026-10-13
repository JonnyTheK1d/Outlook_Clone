export type Folder = 'inbox' | 'sent' | 'drafts' | 'archive' | 'junk' | 'trash';
export type View = 'mail' | 'calendar' | 'contacts' | 'tasks';
export interface Attachment { id: string; name: string; size: number }
export interface Mail {
  id: string; folder: Folder; sender: string; address: string; to: string; cc?: string;
  subject: string; body: string; date: string; read: boolean; flagged: boolean;
  attachments: Attachment[];
}
export interface CalendarEvent { id: string; title: string; start: string; end: string; location: string; notes: string }
export interface Contact { id: string; name: string; email: string; phone: string; company: string }
export interface Task { id: string; title: string; due: string; done: boolean }
export interface State {
  mode: 'demo' | 'microsoft' | 'imap'; email: string; name: string;
  mails: Mail[]; events: CalendarEvent[]; contacts: Contact[]; tasks: Task[];
  updatedAt: string | null; theme: 'light' | 'dark'; notice?: string;
}
export interface Outgoing { to: string; cc: string; subject: string; body: string; attachments: Attachment[]; draftId?: string }
export interface ImapSettings { email: string; password: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }
export interface Capabilities { desktop: boolean; secureStorage: boolean; platform: string }
export type MailAction = { id: string; kind: 'read'; value: boolean } | { id: string; kind: 'flag'; value: boolean } | { id: string; kind: 'move'; folder: Folder } | { id: string; kind: 'delete' };
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
}
