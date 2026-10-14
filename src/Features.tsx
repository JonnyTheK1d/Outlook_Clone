import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { State, Bridge, Mail, Outgoing, Attachment, CalendarEvent, Task, Preferences, Rule } from '../shared/types';
import { defaultPreferences, occurrences } from '../shared/features';
import { api } from './bridge';
import { HtmlMail, sanitizeMail } from './HtmlMail';
export type Run = (operation: () => Promise<State>, success?: string) => Promise<boolean>;
const standard = [{ id:'inbox',name:'Posteingang' },{ id:'sent',name:'Gesendet' },{ id:'drafts',name:'Entwürfe' },{ id:'archive',name:'Archiv' },{ id:'junk',name:'Junk-E-Mail' },{ id:'trash',name:'Papierkorb' }];
const folderOptions = (state: State) => [...standard,...(state.folders || [])].map(f => <option key={f.id} value={f.id}>{f.name}</option>);
export function Organize({ state, mail, folder, run, busy, selectedIds }: { state: State; mail?: Mail; folder: string; run: Run; busy: boolean; selectedIds: string[] }) {
  const [name,setName] = useState(''); const [parent,setParent] = useState('');
  const ids = selectedIds.length ? selectedIds : mail ? [mail.id] : [];
  return <div className="organize-panel">
    <div className="feature-row">
      <input aria-label="Neuer Ordnername" placeholder="Ordnername" maxLength={200} value={name} onChange={e=>setName(e.target.value)}/>
      <select aria-label="Übergeordneter Ordner" value={parent} onChange={e=>setParent(e.target.value)}><option value="">Oberste Ebene</option>{folderOptions(state)}</select>
      <button disabled={busy || !name.trim()} onClick={async()=>{if(await run(()=>api.manage({kind:'folder',operation:'create',name,parent:parent || undefined})))setName('');}}>Ordner erstellen</button>
      <button disabled={busy || !folder.startsWith('custom:') || !name.trim()} onClick={()=>run(()=>api.manage({kind:'folder',operation:'rename',id:folder,name}))}>Umbenennen</button>
      <button disabled={busy || !folder.startsWith('custom:')} onClick={()=>{if(window.confirm('Diesen leeren Ordner löschen?'))void run(()=>api.manage({kind:'folder',operation:'delete',id:folder}));}}>Ordner löschen</button>
      <button disabled={busy} onClick={()=>run(()=>api.manage({kind:'preferences',value:{...state.preferences!,favorites:state.preferences!.favorites.includes(folder)?state.preferences!.favorites.filter(f=>f!==folder):[...state.preferences!.favorites,folder]}}))}>Favorit umschalten</button>
    </div>
    <div className="feature-row">
      <span>{ids.length} ausgewählt</span>
      <select aria-label="Nachrichten verschieben" defaultValue="" disabled={busy || !ids.length} onChange={e=>{const value=e.target.value;if(value)void run(()=>api.manage({kind:'batch',ids,action:'move',folder:value}));e.target.value='';}}><option value="">Verschieben nach …</option>{folderOptions(state)}</select>
      <select aria-label="Kategorie zuweisen" defaultValue="" disabled={busy || !ids.length} onChange={e=>{void run(()=>api.manage({kind:'metadata',ids,category:e.target.value==='__none__'?'':e.target.value}));e.target.value='';}}><option value="">Kategorie …</option><option value="__none__">Keine Kategorie</option>{state.preferences?.categories.map(c=><option key={c}>{c}</option>)}</select>
      <button disabled={busy || !ids.length} onClick={()=>run(()=>api.manage({kind:'metadata',ids,pinned:!ids.every(id=>state.mails.find(m=>m.id===id)?.pinned)}))}>Anheften / lösen</button>
      <button disabled={busy || !ids.length} onClick={()=>run(()=>api.manage({kind:'batch',ids,action:'read'}))}>Alle gelesen</button>
      <button disabled={busy || !ids.length} onClick={()=>run(()=>api.manage({kind:'batch',ids,action:'unread'}))}>Alle ungelesen</button>
      <button disabled={busy || !ids.length} onClick={()=>run(()=>api.manage({kind:'batch',ids,action:'delete'}))}>In Papierkorb</button>
      <button disabled={busy || !mail} onClick={()=>mail && run(()=>api.manage({kind:'export',format:'eml',id:mail.id}))}>EML exportieren</button>
      <button disabled={busy || !mail} onClick={()=>mail && run(()=>api.manage({kind:'print',id:mail.id}))}>Drucken</button>
      <button disabled={busy} onClick={()=>run(()=>api.manage({kind:'import',format:'eml'}))}>EML importieren</button>
    </div>
  </div>;
}
export function MailOptions({ state, run, busy }: { state: State; run: Run; busy: boolean }) {
  const [prefs,setPrefs] = useState<Preferences>(state.preferences || defaultPreferences());
  const [rules,setRules] = useState<Rule[]>(state.rules || []);
  const [reply,setReply] = useState(''); const [ruleName,setRuleName] = useState(''); const [from,setFrom] = useState(''); const [subject,setSubject] = useState(''); const [target,setTarget] = useState('archive');
  const [templateName,setTemplateName] = useState('');const [templateBody,setTemplateBody] = useState('');
  return <div className="detail-form">
    <h3>Nachrichten und Organisation</h3>
    <label>Signatur<textarea value={prefs.signature} onChange={e=>setPrefs({...prefs,signature:e.target.value})} maxLength={10000}/></label>
    <div className="form-grid"><label>Automatischer Abruf (Minuten)<input type="number" min={1} max={60} value={prefs.syncMinutes} onChange={e=>setPrefs({...prefs,syncMinutes:Number(e.target.value)})}/></label><label>Kategorien (mit Komma trennen)<input value={prefs.categories.join(', ')} onChange={e=>setPrefs({...prefs,categories:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/></label></div>
    <label className="check-label"><input type="checkbox" checked={prefs.notifications} onChange={e=>setPrefs({...prefs,notifications:e.target.checked})}/>Windows-Benachrichtigungen und Erinnerungen</label>
    <label className="check-label"><input type="checkbox" checked={prefs.threads} onChange={e=>setPrefs({...prefs,threads:e.target.checked})}/>Nachrichten nach Unterhaltung gruppieren</label>
    <label className="check-label"><input type="checkbox" checked={prefs.composeInWindow} onChange={e=>setPrefs({...prefs,composeInWindow:e.target.checked})}/>Neue Nachrichten, Antworten und Weiterleitungen in eigenem Fenster öffnen</label>
    <div className="form-grid"><label>Lesebereich<select value={prefs.readingPane} onChange={e=>setPrefs({...prefs,readingPane:e.target.value as Preferences['readingPane']})}><option value="right">Rechts</option><option value="bottom">Unten</option><option value="off">Aus</option></select></label><label>Abstand<select value={prefs.density} onChange={e=>setPrefs({...prefs,density:e.target.value as Preferences['density']})}><option value="comfortable">Normal</option><option value="compact">Kompakt</option></select></label></div>
    <button className="primary-button" disabled={busy} onClick={()=>run(()=>api.manage({kind:'preferences',value:prefs}),'Einstellungen gespeichert.')}>Mail-Einstellungen speichern</button>
    <h4>Nachrichtenvorlagen</h4><input aria-label="Vorlagenname" placeholder="Name / Betreff" value={templateName} onChange={e=>setTemplateName(e.target.value)} maxLength={100}/><textarea aria-label="Vorlagentext" value={templateBody} onChange={e=>setTemplateBody(e.target.value)} maxLength={500000}/>
    <button disabled={busy || !templateName.trim()} onClick={async()=>{const value={...prefs,templates:[...prefs.templates,{name:templateName,subject:templateName,body:templateBody}]};if(await run(()=>api.manage({kind:'preferences',value}))){setPrefs(value);setTemplateName('');setTemplateBody('');}}}>Vorlage speichern</button>
    {prefs.templates.map((t,i)=><div className="feature-row" key={i}><span>{t.name}</span><button disabled={busy} onClick={async()=>{const value={...prefs,templates:prefs.templates.filter((_t,j)=>j!==i)};if(await run(()=>api.manage({kind:'preferences',value})))setPrefs(value);}}>Entfernen</button></div>)}
    <h4>Lokale Posteingangsregeln</h4><p>Regeln laufen während Postblick geöffnet ist. Sie können Nachrichten auf dem Server verschieben. Mindestens eine Bedingung ist erforderlich.</p>
    {rules.map(rule=><div className="feature-row" key={rule.id}><label className="check-label"><input type="checkbox" checked={rule.enabled} onChange={e=>setRules(rules.map(r=>r.id===rule.id?{...r,enabled:e.target.checked}:r))}/>{rule.name}</label><button onClick={()=>setRules(rules.filter(r=>r.id!==rule.id))}>Entfernen</button></div>)}
    <input aria-label="Regelname" placeholder="Regelname" value={ruleName} onChange={e=>setRuleName(e.target.value)} maxLength={100}/><div className="form-grid"><input aria-label="Regel Absender" placeholder="Absender enthält" value={from} onChange={e=>setFrom(e.target.value)} maxLength={500}/><input aria-label="Regel Betreff" placeholder="Betreff enthält" value={subject} onChange={e=>setSubject(e.target.value)} maxLength={500}/></div><select aria-label="Regel Zielordner" value={target} onChange={e=>setTarget(e.target.value)}>{folderOptions(state)}</select>
    <button disabled={!ruleName || !(from || subject)} onClick={()=>{setRules([...rules,{id:crypto.randomUUID(),name:ruleName,from,subject,target,enabled:true,markRead:false}]);setRuleName('');setFrom('');setSubject('');}}>Regel hinzufügen</button><button className="primary-button" disabled={busy} onClick={()=>run(()=>api.manage({kind:'rules',value:rules}),'Regeln gespeichert.')}>Regeln speichern</button>
    <h4>Abwesenheitsantwort</h4><textarea aria-label="Abwesenheitstext" value={reply} onChange={e=>setReply(e.target.value)} maxLength={10000}/><div className="feature-row"><button disabled={busy || state.mode!=='microsoft' || !reply} onClick={()=>run(()=>api.manage({kind:'auto-reply',text:reply,enabled:true}))}>Beim Anbieter aktivieren</button><button disabled={busy || state.mode!=='microsoft'} onClick={()=>run(()=>api.manage({kind:'auto-reply',text:'',enabled:false}))}>Deaktivieren</button></div>
    <h4>Daten und Windows</h4><div className="feature-row">{(['contacts','calendar'] as const).map(format=><span key={format}><button disabled={busy} onClick={()=>run(()=>api.manage({kind:'export',format}))}>{format==='contacts'?'Kontakte CSV':'Kalender ICS'} exportieren</button><button disabled={busy} onClick={()=>run(()=>api.manage({kind:'import',format}))}>Importieren</button></span>)}</div>
    <div className="feature-row"><button disabled={busy} onClick={()=>run(()=>api.manage({kind:'default-mail'}))}>Als Mailprogramm registrieren</button><button disabled={busy} onClick={()=>run(()=>api.manage({kind:'check-updates'}))}>Updates prüfen</button><button disabled={busy} onClick={()=>run(()=>api.manage({kind:'open-release'}))}>Release-Download öffnen</button></div>
    <p>Updates werden manuell installiert. Signierung, S/MIME, PST/MSG, Unternehmensfreigaben und Add-ins sind noch nicht verfügbar.</p>
  </div>;
}
export function Outbox({state,run,busy}:{state:State;run:Run;busy:boolean}) {
  return <div className="outbox-panel"><h3>Postausgang</h3>{!state.outbox?.length && <p>Keine Nachrichten in der Warteschlange.</p>}{state.outbox?.map(m=><div className="outbox-item" key={m.id}><strong>{m.message.subject || '(Kein Betreff)'}</strong><span>{m.message.to || m.message.bcc} · {m.message.scheduledAt?new Date(m.message.scheduledAt).toLocaleString('de-DE'):'Nächster Abruf'} · {m.status==='pending'?'Wartet':m.status==='uncertain'?'Versand unklar':'Fehlgeschlagen'}</span>{m.error && <p role="alert">{m.error}</p>}<button disabled={busy || m.status==='uncertain'} onClick={()=>run(()=>api.manage({kind:'outbox',operation:'send',id:m.id}))}>Jetzt senden</button><button disabled={busy} onClick={()=>{if(window.confirm('Diese Nachricht aus der Warteschlange entfernen?'))void run(()=>api.manage({kind:'outbox',operation:'cancel',id:m.id}));}}>Entfernen</button></div>)}<p>Postblick muss für automatischen Versand geöffnet bleiben. Unklare Versandvorgänge werden nicht automatisch wiederholt.</p></div>;
}
const plainHtml = (text: string) => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>');
export function EnhancedComposer({message,existing=[],state,run,busy,close,dirty,popOut}:{message:Outgoing;existing?:Attachment[];state:State;run:Run;busy:boolean;close:()=>void;dirty:(message:Outgoing)=>void;popOut?:()=>void}) {
  const [rich,setRich] = useState(!!message.html); const [error,setError] = useState('');const [schedule,setSchedule] = useState(''); const [retained,setRetained] = useState(existing.map(a=>a.id));
  const richRef = useRef<HTMLDivElement>(null); const latest = useRef(message); latest.current=message;
  const [autosaved,setAutosaved]=useState(false);const [dropping,setDropping]=useState(false);
  // Dropped files travel as bytes; like the file picker, at most 20 new files and 20 MB in total.
  const addFiles=async(files:File[])=>{
    setError('');const added:Attachment[]=[];
    try{
      if(!api.attachData)throw new Error('Das Ablegen von Dateien ist hier nicht verfügbar. Bitte „Anhang“ verwenden.');
      let count=latest.current.attachments.length,total=latest.current.attachments.reduce((n,a)=>n+a.size,0);
      for(const file of files){
        if(count+1>20 || total+file.size>20*1024*1024)throw new Error('Anhänge: maximal 20 MB und 20 Dateien.');
        added.push(await api.attachData(file.name,new Uint8Array(await file.arrayBuffer())));count++;total+=file.size;
      }
    }catch(e){setError(e instanceof Error && e.message!=='' ? e.message : 'Die Datei konnte nicht gelesen werden.');}
    finally{if(added.length)change('attachments',[...latest.current.attachments,...added]);}
  };
  const change=(field:keyof Outgoing,value:unknown)=>{setAutosaved(false);dirty({...latest.current,[field]:value});};
  useEffect(()=>{if(richRef.current && richRef.current.innerHTML!==sanitizeMail(message.html || plainHtml(message.body)))richRef.current.innerHTML=sanitizeMail(message.html || plainHtml(message.body));},[rich]); // editing owns DOM after initial render
  useEffect(()=>{
    if (!(message.body || message.subject || message.to)) return;
    const timer=setTimeout(()=>{void api.manage({kind:'autosave',message:{...latest.current,retainedAttachments:retained}}).then(()=>setAutosaved(true)).catch(()=>setAutosaved(false));},2000);
    return()=>clearTimeout(timer);
  },[message,retained]);
  const submit=async(e:FormEvent,draft=false,queue=false)=>{
    e.preventDefault();setError('');
    if(!draft && !message.subject.trim() && !window.confirm('Nachricht ohne Betreff senden?'))return;
    const value={...message,retainedAttachments:message.draftId?retained:undefined,scheduledAt:schedule?new Date(schedule).toISOString():undefined};
    if (await run(()=>draft?api.saveDraft(value):queue||schedule?api.manage({kind:'queue',message:value}):api.send(value),draft?'Entwurf gespeichert.':queue||schedule?'Nachricht in Warteschlange gespeichert.':state.mode==='demo'?'Nachricht lokal abgelegt. Es wurde keine E-Mail verschickt.':'Nachricht zum Versand angenommen.')) { await run(()=>api.manage({kind:'autosave',message:null}));close(); }
  };
  return <form className={'composer'+(dropping?' drop-active':'')} onSubmit={submit} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';setDropping(true);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDropping(false);}} onDrop={e=>{if(!e.dataTransfer.files.length)return;e.preventDefault();setDropping(false);void addFiles([...e.dataTransfer.files]);}} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();e.currentTarget.requestSubmit();}}}>
    <div className="compose-account">Von: {state.email} · {state.mode==='demo'?'Demo · nur lokal':'Verbundenes Konto'}</div>
    <datalist id="recipients">{state.contacts.map(c=><option key={c.id} value={c.email}>{c.name}</option>)}</datalist>
    <label className="compose-field"><span>An</span><input list="recipients" aria-label="Empfänger" value={message.to} onChange={e=>change('to',e.target.value)} maxLength={2000}/></label>
    <label className="compose-field"><span>Cc</span><input list="recipients" value={message.cc} onChange={e=>change('cc',e.target.value)} maxLength={2000}/></label>
    <label className="compose-field"><span>Bcc</span><input list="recipients" aria-label="Bcc" value={message.bcc || ''} onChange={e=>change('bcc',e.target.value)} maxLength={2000}/></label>
    <label className="compose-field"><span>Betreff</span><input aria-label="Betreff" value={message.subject} onChange={e=>change('subject',e.target.value)} maxLength={998}/></label>
    <div className="feature-row">
      <button type="button" onClick={()=>{if(rich){change('html',undefined);setRich(false);}else{change('html',plainHtml(message.body));setRich(true);}}}>{rich?'Textansicht':'Formatieren'}</button>
      {rich && [['bold','Fett'],['italic','Kursiv'],['underline','Unterstreichen'],['insertUnorderedList','Liste']].map(([command,label])=><button key={command} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{richRef.current?.focus();document.execCommand(command);if(richRef.current)dirty({...latest.current,html:sanitizeMail(richRef.current.innerHTML),body:richRef.current.innerText});}}>{label}</button>)}
      <select aria-label="Vorlage verwenden" defaultValue="" onChange={e=>{const t=state.preferences?.templates[Number(e.target.value)];if(t)dirty({...message,subject:t.subject,body:t.body+(state.preferences?.signature?'\n\n'+state.preferences.signature:''),html:undefined});setRich(false);e.target.value='';}}><option value="">Vorlage …</option>{state.preferences?.templates.map((t,i)=><option value={i} key={i}>{t.name}</option>)}</select>
      <select aria-label="Priorität" value={message.importance || 'normal'} onChange={e=>change('importance',e.target.value)}><option value="low">Niedrig</option><option value="normal">Normal</option><option value="high">Hoch</option></select>
      {popOut&&<button type="button" title="Nachricht in eigenem Fenster bearbeiten" onClick={()=>popOut()}>In neuem Fenster</button>}
    </div>
    {rich?<div className="compose-body rich-editor" role="textbox" aria-label="Formatierter Nachrichtentext" contentEditable suppressContentEditableWarning ref={richRef} spellCheck onInput={()=>{if(richRef.current)dirty({...latest.current,body:richRef.current.innerText,html:sanitizeMail(richRef.current.innerHTML)});}} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));}}/>:<textarea className="compose-body" aria-label="Nachrichtentext" spellCheck value={message.body} onChange={e=>change('body',e.target.value)} maxLength={500000}/>}
    <div className="feature-row"><label className="check-label"><input type="checkbox" checked={!!message.readReceipt} onChange={e=>change('readReceipt',e.target.checked)}/>Lesebestätigung anfordern</label>{state.mode==='microsoft'&&<label className="check-label"><input type="checkbox" checked={!!message.deliveryReceipt} onChange={e=>change('deliveryReceipt',e.target.checked)}/>Zustellbestätigung</label>}<label>Geplanter Versand <input type="datetime-local" aria-label="Geplanter Versand" value={schedule} onChange={e=>setSchedule(e.target.value)}/></label></div>
    {!!existing.length&&<div className="compose-attachments">{existing.filter(a=>retained.includes(a.id)).map(a=><span className="attachment-pill" key={a.id}>{a.name}<button type="button" aria-label={a.name+' entfernen'} onClick={()=>setRetained(retained.filter(id=>id!==a.id))}>×</button></span>)}</div>}
    <div className="compose-attachments">{message.attachments.map(a=><span className="attachment-pill" key={a.id}>{a.name}<button type="button" aria-label={a.name+' entfernen'} onClick={()=>change('attachments',message.attachments.filter(x=>x.id!==a.id))}>×</button></span>)}</div>
    {error&&<p role="alert" className="form-error">{error}</p>}
    <div className="modal-actions"><button className="primary-button" type="submit" disabled={busy}>{schedule?'Geplant senden':state.mode==='demo'?'Lokal senden':'Senden'}</button><button className="secondary-button" type="button" disabled={busy} onClick={e=>submit(e,true)}>Entwurf speichern</button><button className="secondary-button" type="button" disabled={busy} onClick={e=>submit(e,false,true)}>In Postausgang</button><button className="secondary-button" type="button" disabled={busy} onClick={async()=>{try{const files=await api.pickAttachments();const combined=[...message.attachments,...files];if(combined.reduce((n,a)=>n+a.size,0)>20*1024*1024 || combined.length>20)throw new Error('Anhänge: maximal 20 MB und 20 Dateien.');change('attachments',combined);}catch(e){setError((e as Error).message);}}}>Anhang</button></div><p className="inline-note">{autosaved?'Textentwurf automatisch lokal gespeichert.':'Entwurf wird nach einer Schreibpause lokal gespeichert.'} · max. 20 MB Anhänge, Dateien auch per Drag-and-drop · Strg+Enter: Senden</p>
  </form>;
}
const HOUR=44;
const minutesOf=(value:string)=>Number(value.slice(11,13))*60+Number(value.slice(14,16));
const weekdays=['Mo','Di','Mi','Do','Fr','Sa','So'];
export function EnhancedCalendar({events,month,setMonth,query,edit}:{events:CalendarEvent[];month:Date;setMonth:(d:Date)=>void;query:string;edit:(e?:CalendarEvent,day?:string,time?:string)=>void}) {
  const [view,setView]=useState<'month'|'week'|'day'>('month');
  const scrollRef=useRef<HTMLDivElement>(null);
  // The month grid starts on the Monday before the 1st, whatever day "month" points at.
  const first=new Date(month.getFullYear(),month.getMonth(),1);
  const cells=view==='month'?Array.from({length:42},(_,i)=>new Date(first.getFullYear(),first.getMonth(),i-(first.getDay()+6)%7+1)):Array.from({length:view==='week'?7:1},(_,i)=>new Date(month.getFullYear(),month.getMonth(),month.getDate()-(view==='week'?(month.getDay()+6)%7:0)+i));
  const begin=cells[0],end=new Date(cells[cells.length-1].getTime()+86400000);
  const expanded=occurrences(events,begin,end);
  const dayKey=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const today=dayKey(new Date());
  const onDay=(key:string)=>expanded.filter(e=>e.start.slice(0,10)<=key && e.end>key+'T00:00' && (e.title+' '+e.location).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.start.localeCompare(b.start));
  const navigate=(direction:number)=>setMonth(view==='month'?new Date(month.getFullYear(),month.getMonth()+direction,1):new Date(month.getFullYear(),month.getMonth(),month.getDate()+direction*(view==='week'?7:1)));
  const open=(e:CalendarEvent)=>edit(events.find(x=>x.id===e.id) || e);
  useEffect(()=>{if(view!=='month'&&scrollRef.current)scrollRef.current.scrollTop=7*HOUR-10;},[view]);
  const title=view==='month'?month.toLocaleDateString('de-DE',{month:'long',year:'numeric'}):view==='day'?cells[0].toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):cells[0].toLocaleDateString('de-DE',{day:'numeric',month:'short'})+' – '+cells[6].toLocaleDateString('de-DE',{day:'numeric',month:'short',year:'numeric'});
  const columns={gridTemplateColumns:'56px repeat('+cells.length+',minmax(0,1fr))'};
  const now=new Date(),nowMinutes=now.getHours()*60+now.getMinutes();
  return <section className="calendar-view"><div className="calendar-heading"><h1>{title}</h1><div className="feature-row"><button onClick={()=>setMonth(new Date())}>Heute</button><button aria-label="Vorheriger Zeitraum" onClick={()=>navigate(-1)}>‹</button><button aria-label="Nächster Zeitraum" onClick={()=>navigate(1)}>›</button><select aria-label="Kalenderansicht" value={view} onChange={e=>{const next=e.target.value as typeof view;const now=new Date();if(next!=='month'&&now.getFullYear()===month.getFullYear()&&now.getMonth()===month.getMonth())setMonth(now);setView(next);}}><option value="month">Monat</option><option value="week">Woche</option><option value="day">Tag</option></select></div></div>
    {view==='month'?<><div className="calendar-weekdays">{weekdays.map(d=><span key={d}>{d}</span>)}</div><div className="calendar-grid calendar-month">{cells.map(day=>{const key=dayKey(day);return <div className={'calendar-cell'+(day.getMonth()!==first.getMonth()?' outside':'')} key={key} onDoubleClick={e=>{if(!(e.target as HTMLElement).closest('.calendar-event,.date-number'))edit(undefined,key);}}><button className={'date-number'+(key===today?' today':'')} aria-label={'Termin am '+day.toLocaleDateString('de-DE')+' erstellen'} onClick={()=>edit(undefined,key)}>{day.getDate()}</button>{onDay(key).map((e,i)=><button className="calendar-event" key={e.id+':'+i} onClick={()=>open(e)}><time>{e.allDay?'Ganztägig':e.start.slice(11,16)}</time>{e.title}{e.location&&<small> · {e.location}</small>}</button>)}</div>;})}</div></>
    :<div className={'time-view time-'+view}>
      <div className="time-head" style={columns}><span/>{cells.map(day=>{const key=dayKey(day);return <button key={key} className={'time-day'+(key===today?' today':'')} aria-label={'Termin am '+day.toLocaleDateString('de-DE')+' erstellen'} onClick={()=>edit(undefined,key)}><small>{weekdays[(day.getDay()+6)%7]}</small><strong>{day.getDate()}</strong></button>;})}</div>
      <div className="time-allday" style={columns}><span>Ganztägig</span>{cells.map(day=>{const key=dayKey(day);return <div key={key}>{onDay(key).filter(e=>e.allDay).map((e,i)=><button className="calendar-event" key={e.id+':'+i} onClick={()=>open(e)}>{e.title}</button>)}</div>;})}</div>
      <div className="time-scroll" ref={scrollRef}><div className="time-grid" style={{...columns,height:24*HOUR}}>
        <div className="time-labels">{Array.from({length:24},(_,h)=><span key={h} style={{top:h*HOUR}}>{String(h).padStart(2,'0')}:00</span>)}</div>
        {cells.map(day=>{
          const key=dayKey(day);
          // Overlapping appointments share the column side by side.
          const lanes:number[]=[];
          const placed=onDay(key).filter(e=>!e.allDay).map(e=>{const from=e.start.slice(0,10)<key?0:minutesOf(e.start),to=e.end.slice(0,10)>key?1440:Math.max(from+15,minutesOf(e.end));let lane=lanes.findIndex(last=>last<=from);if(lane<0){lane=lanes.length;lanes.push(to);}else lanes[lane]=to;return {e,from,to,lane};});
          return <div className="calendar-cell time-column" key={key} onDoubleClick={ev=>{if((ev.target as HTMLElement).closest('.calendar-event'))return;const hour=Math.min(23,Math.max(0,Math.floor((ev.clientY-ev.currentTarget.getBoundingClientRect().top)/HOUR)));edit(undefined,key,String(hour).padStart(2,'0')+':00');}}>
            {placed.map(({e,from,to,lane},i)=><button className="calendar-event timed" key={e.id+':'+i} style={{top:from/60*HOUR,height:Math.max(18,(to-from)/60*HOUR-2),left:(lane/lanes.length*100)+'%',width:(100/lanes.length)+'%'}} title={e.title+(e.location?' · '+e.location:'')} onClick={()=>open(e)}><time>{e.start.slice(11,16)}</time>{e.title}{e.location&&<small>{e.location}</small>}</button>)}
            {key===today&&<div className="now-line" style={{top:nowMinutes/60*HOUR}} aria-hidden="true"/>}
          </div>;
        })}
      </div></div>
    </div>}
  </section>;
}
export function TaskDetails({task,run,busy}:{task:Task;run:Run;busy:boolean}) {
  const [value,setValue]=useState(task); const [open,setOpen]=useState(false);
  return <div className="task-details"><button aria-label={task.title+' Details'} onClick={()=>{setValue(task);setOpen(!open);}}>Details</button>{open&&<div className="detail-form"><label>Liste<input value={value.list || ''} onChange={e=>setValue({...value,list:e.target.value})}/></label><label>Notizen<textarea value={value.notes || ''} onChange={e=>setValue({...value,notes:e.target.value})}/></label><label>Erinnerung<input type="datetime-local" value={value.reminder || ''} onChange={e=>setValue({...value,reminder:e.target.value || undefined})}/></label><label>Wiederholung<select value={value.recurrence || 'none'} onChange={e=>setValue({...value,recurrence:e.target.value as Task['recurrence']})}><option value="none">Keine</option><option value="daily">Täglich</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option></select></label><label>Unteraufgaben (eine pro Zeile)<textarea value={(value.steps || []).map(s=>s.title).join('\n')} onChange={e=>setValue({...value,steps:e.target.value.split('\n').filter(Boolean).map(title=>({title,done:value.steps?.find(s=>s.title===title)?.done || false}))})}/></label>{value.steps?.map((s,i)=><label className="check-label" key={i}><input type="checkbox" checked={s.done} onChange={e=>setValue({...value,steps:value.steps!.map((t,j)=>j===i?{...t,done:e.target.checked}:t)})}/>{s.title}</label>)}<button className="primary-button" disabled={busy} onClick={async()=>{if(await run(()=>api.saveTask(value)))setOpen(false);}}>Aufgabendetails speichern</button></div>}</div>;
}
export function CalendarManage({state,run,busy}:{state:State;run:Run;busy:boolean}) {
  const [name,setName]=useState('');const [id,setId]=useState('');
  return <div className="calendar-manage"><h4>Kalender</h4>{state.calendars?.map(c=><label className="check-label" key={c.id}><input type="checkbox" checked={c.visible} disabled={busy} onChange={e=>run(()=>api.manage({kind:'calendar',operation:'visibility',id:c.id,visible:e.target.checked}))}/>{c.name}</label>)}<input aria-label="Kalendername" placeholder="Kalendername" value={name} maxLength={200} onChange={e=>setName(e.target.value)}/><button disabled={busy || !name.trim()} onClick={async()=>{if(await run(()=>api.manage({kind:'calendar',operation:'create',name})))setName('');}}>Kalender erstellen</button><select aria-label="Kalender verwalten" value={id} onChange={e=>setId(e.target.value)}><option value="">Kalender wählen …</option>{state.calendars?.filter(c=>c.canEdit).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="feature-row"><button disabled={busy || !id || !name.trim()} onClick={()=>run(()=>api.manage({kind:'calendar',operation:'rename',id,name}))}>Umbenennen</button><button disabled={busy || !id || state.calendars?.find(c=>c.id===id)?.isDefault} onClick={()=>{if(window.confirm('Diesen leeren zusätzlichen Kalender löschen?'))void run(()=>api.manage({kind:'calendar',operation:'delete',id}));}}>Löschen</button></div></div>;
}
