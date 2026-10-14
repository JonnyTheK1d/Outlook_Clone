import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ComposeWindow, MailWindow, route } from './Windows';
import './styles.css';
const current = route();
createRoot(document.getElementById('root')!).render(<React.StrictMode>{current.kind === 'mail' ? <MailWindow id={current.id} accountId={current.accountId}/> : current.kind === 'compose' ? <ComposeWindow/> : <App/>}</React.StrictMode>);
