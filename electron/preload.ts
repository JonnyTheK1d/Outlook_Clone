import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge } from '../shared/types';
async function invoke<T>(channel: string, value?: unknown): Promise<T> {
  const response = await ipcRenderer.invoke(channel, value);
  if (!response.ok) throw new Error(response.error);
  return response.value;
}
const bridge: Bridge = {
  state: () => invoke('state'), capabilities: () => invoke('capabilities'),
  sync: folder => invoke('sync', folder), mailAction: action => invoke('mail-action', action),
  send: message => invoke('send', message), saveDraft: message => invoke('save-draft', message),
  pickAttachments: () => invoke('pick-attachments'), downloadAttachment: (mailId, attachmentId) => invoke('download-attachment', { mailId, attachmentId }),
  connectMicrosoft: id => invoke('connect-microsoft', id), connectImap: settings => invoke('connect-imap', settings),
  disconnect: () => invoke('disconnect'), demo: () => invoke('demo'),
  saveEvent: event => invoke('save-event', event), deleteEvent: id => invoke('delete-event', id),
  saveContact: contact => invoke('save-contact', contact), deleteContact: id => invoke('delete-contact', id),
  saveTask: task => invoke('save-task', task), deleteTask: id => invoke('delete-task', id),
  theme: theme => invoke('theme', theme), manage: command => invoke('manage', command),
  onState: callback => { const listener = (_event: unknown, state: any) => callback(state); ipcRenderer.on('state-updated', listener); return () => { ipcRenderer.removeListener('state-updated', listener); }; }
};
contextBridge.exposeInMainWorld('postblick', Object.freeze(bridge));
