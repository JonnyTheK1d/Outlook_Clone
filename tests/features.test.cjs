const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { mkdtemp, rm, readFile, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const original = Module._load;
Module._load = function(id,...args) {
  if (id === 'electron') return { safeStorage: { isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'gnome_libsecret',encryptString:v=>Buffer.from('wrapped:'+v),decryptString:v=>v.toString().slice(8) },shell:{},app:{} };
  return original.call(this,id,...args);
};
const { Store } = require('../dist-electron/electron/store');
const { MicrosoftProvider } = require('../dist-electron/electron/providers');
const { handleCommand, flushOutbox, calendarText, csvRows } = require('../dist-electron/electron/commands');
Module._load=original;
const { normalize, localCommand, matches, occurrences } = require('../dist-electron/shared/features');
const { createDemo } = require('../dist-electron/shared/demo');
const { commandSchema } = require('../dist-electron/electron/validation');
const { parseMailto } = require('../dist-electron/electron/mailto');
const originalFetch = global.fetch; after(()=>{global.fetch=originalFetch;});
const credentials = { type:'microsoft',clientId:'12345678-1234-1234-1234-123456789abc',accessToken:'private-token',refreshToken:'private-refresh',expiresAt:Date.now()+3600000 };
test('multi-account cache migrates old envelope and persists isolated encrypted mailboxes',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'postblick-migration-'));
  try {
    const initial=createDemo();
    await writeFile(path.join(dir,'mailbox.json'),JSON.stringify({encrypted:false,data:JSON.stringify({state:initial,credentials:null})}));
    const store=new Store(dir);await store.load();const demoId=store.state.accountId;
    store.accounts[demoId]={state:store.state,credentials:null};
    store.state=normalize({...createDemo(),accountId:'account-real',mode:'microsoft',email:'real@example.com'});
    store.credentials=credentials;await store.save();
    store.activate(demoId);await store.save();
    assert.equal(JSON.parse(await readFile(path.join(dir,'mailbox-v2.json'),'utf8')).encrypted,true);
    const reload=new Store(dir);await reload.load();assert.equal(reload.view().accounts.length,2);
    assert.equal(JSON.stringify(reload.view()).includes('private-token'),false);
    reload.activate('account-real');assert.equal(reload.state.email,'real@example.com');assert.equal(reload.credentials.accessToken,'private-token');
    reload.state.mails=[];await reload.save();reload.activate(demoId);assert.equal(reload.state.mails.length,initial.mails.length);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('search grammar combines sender, dates, attachments, flags and quoted subject',()=>{
  const mail={...createDemo().mails[1],attachments:[{id:'x',name:'test',size:1}],date:'2026-10-13T10:00:00Z'};
  assert.equal(matches(mail,'from:daniel subject:"Design-Review" after:2026-10-01 has:attachment is:flagged'),true);
  assert.equal(matches(mail,'before:2026-10-01'),false);assert.equal(matches(mail,'has:attachment is:unread'),true);
});
test('folder lifecycle protects messages and child folders against accidental deletion',()=>{
  const state=normalize(createDemo());localCommand(state,{kind:'folder',operation:'create',name:'Project'},()=> 'project');
  localCommand(state,{kind:'folder',operation:'create',name:'Child',parent:'custom:project'},()=> 'child');
  assert.throws(()=>localCommand(state,{kind:'folder',operation:'delete',id:'custom:project'},()=>''),/Unterordner/);
  localCommand(state,{kind:'folder',operation:'rename',id:'custom:project',name:'Renamed'},()=> '');
  assert.equal(state.folders[0].name,'Renamed');
  localCommand(state,{kind:'batch',ids:[state.mails[0].id],action:'move',folder:'custom:child'},()=> '');
  assert.throws(()=>localCommand(state,{kind:'folder',operation:'delete',id:'custom:child'},()=>''),/leere/);
});
test('local recurrence respects end date and month-end without drifting',()=>{
  const event={id:'series',title:'Test',start:'2026-01-31T10:00:00',end:'2026-01-31T11:00:00',location:'',notes:'',recurrence:'monthly',until:'2026-03-31'};
  const list=occurrences([event],new Date('2026-01-01'),new Date('2026-05-01'));
  assert.deepEqual(list.map(e=>e.start.slice(0,10)),['2026-01-31','2026-02-28','2026-03-31']);
});
test('Graph pagination never sends bearer credentials to a foreign nextLink',async()=>{
  global.fetch=async()=>Response.json({value:[], '@odata.nextLink':'https://evil.invalid/v1.0/me/messages'});
  await assert.rejects(new MicrosoftProvider(credentials,async()=>{}).list('inbox'),/Seitenverweis/);
});
test('Graph paging loads more than 100 messages without duplicates and preserves HTML separately',async()=>{
  let calls=0;
  global.fetch=async()=>{calls++;return Response.json({value:Array.from({length:calls===1?100:3},(_,i)=>({id:calls+':'+i,body:{contentType:'html',content:'<b>Hallo</b>'},from:{emailAddress:{address:'a@example.com'}},receivedDateTime:'2026-10-13T10:00:00Z'})),...(calls===1?{'@odata.nextLink':'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skip=100'}:{})});};
  const mails=await new MicrosoftProvider(credentials,async()=>{}).list('inbox');assert.equal(mails.length,103);assert.equal(mails[0].html,'<b>Hallo</b>');
});
test('Graph reply uses createReply and Bcc does not leak into To',async()=>{
  const calls=[];
  global.fetch=async(url,options)=>{calls.push({url,options,body:options.body?JSON.parse(options.body):undefined});return options.method==='POST'&&url.endsWith('/createReply')?Response.json({id:'reply-id'}):new Response(null,{status:202});};
  await new MicrosoftProvider(credentials,async()=>{}).send({to:'to@example.com',cc:'',bcc:'hidden@example.com',subject:'Reply',body:'Hello',attachments:[],replyId:'source/id'},[]);
  assert.ok(calls[0].url.endsWith('/source%2Fid/createReply'));
  assert.equal(calls[1].body.bccRecipients[0].emailAddress.address,'hidden@example.com');
  assert.equal(calls[1].body.toRecipients.length,1);
  assert.ok(calls.at(-1).url.endsWith('/reply-id/send'));
});
test('outbox persists uncertain before send and never retries a failed acceptance boundary',async()=>{
  const state=normalize(createDemo());state.mode='microsoft';state.accountId='a';
  const msg={to:'person@example.com',cc:'',subject:'Once',body:'Hello',attachments:[]};
  state.outbox=[{id:'queue',message:msg,status:'pending',createdAt:new Date().toISOString()}];let sends=0,saves=0;
  const store={state,queuedFiles:{},save:async()=>{saves++;}};
  const ctx={store,provider:()=>({send:async()=>{assert.equal(state.outbox[0].status,'uncertain');assert.ok(saves>0);sends++;throw new Error('Connection lost after DATA');}})};
  await flushOutbox(ctx);assert.equal(sends,1);assert.equal(state.outbox[0].status,'uncertain');
  await flushOutbox(ctx);assert.equal(sends,1);await assert.rejects(flushOutbox(ctx,'queue'),/unklaren/);
});
test('outbox does not send if durable pre-send commit fails',async()=>{
  const state=normalize(createDemo());state.outbox=[{id:'queue',message:{to:'a@example.com',cc:'',subject:'',body:'',attachments:[]},status:'pending',createdAt:new Date().toISOString()}];let sends=0;
  await assert.rejects(flushOutbox({store:{state,queuedFiles:{},save:async()=>{throw new Error('Disk full');}},provider:()=>({send:async()=>{sends++;}})}),/Disk full/);
  assert.equal(sends,0);
});
test('rules match conditions and do not move unrelated mail',async()=>{
  const state=normalize(createDemo());state.rules=[{id:'r',name:'Design',from:'daniel',subject:'Design',target:'archive',enabled:true,markRead:true}];
  const store={state,save:async()=>{},view:()=>state};const ctx={store,provider:()=>null,save:async()=>state};
  await handleCommand(ctx,{kind:'sync-all'});assert.equal(state.mails.find(m=>m.id==='demo-2').folder,'archive');assert.equal(state.mails.find(m=>m.id==='demo-1').folder,'inbox');
});
test('Mailto decodes unicode and refuses header injection and other protocols',()=>{
  const message=parseMailto('mailto:person%40example.com?subject=Gr%C3%BC%C3%9Fe&body=Hallo%0AWelt&bcc=hidden%40example.com');
  assert.equal(message.to,'person@example.com');assert.equal(message.subject,'Grüße');assert.equal(message.body,'Hallo\nWelt');
  assert.throws(()=>parseMailto('mailto:a@example.com?subject=Test%0ABcc%3Ax@example.com'));
  assert.throws(()=>parseMailto('https://example.com'));
});
test('new IPC commands reject arbitrary filesystem arguments and unsafe links',()=>{
  assert.equal(commandSchema.safeParse({kind:'import',format:'eml',path:'/secret'}).success,false);
  assert.equal(commandSchema.safeParse({kind:'open-link',url:'file:///secret'}).success,false);
  assert.equal(commandSchema.safeParse({kind:'open-link',url:'https://user:pass@example.com'}).success,false);
  assert.equal(commandSchema.safeParse({kind:'rules',value:[{id:'x',name:'Bad',from:'',subject:'',target:'inbox',enabled:true,markRead:false}]}).success,false);
});
test('CSV parser handles quotes, commas and embedded line breaks',()=>{
  assert.deepEqual(csvRows('name,email\n"A, B","a@example.com"\n"Multiline\nName","b@example.com"'),[['name','email'],['A, B','a@example.com'],['Multiline\nName','b@example.com']]);
  assert.throws(()=>csvRows('"unfinished'),/unvollständiges/);
});
test('ICS export escapes user text and includes real dates and recurrence',()=>{
  const value=calendarText([{id:'event',title:'Line; comma, test',start:'2026-10-13T10:00:00',end:'2026-10-13T11:00:00',location:'Here',notes:'Line\nTwo',recurrence:'weekly'}]);
  assert.ok(value.includes('BEGIN:VCALENDAR'));assert.ok(value.includes('RRULE:FREQ=WEEKLY'));assert.ok(value.includes('DTSTART:'));
});
test('outbox stays pending without an available connection and retries only preflight',async()=>{
  const state=normalize(createDemo());state.outbox=[{id:'offline',message:{to:'a@example.com',cc:'',subject:'',body:'',attachments:[]},status:'pending',createdAt:new Date().toISOString()}];let sends=0,preflights=0;
  const ctx={store:{state,queuedFiles:{},save:async()=>{}},provider:()=>({profile:async()=>{preflights++;throw new Error('Offline');},send:async()=>{sends++;}})};
  await flushOutbox(ctx);await flushOutbox(ctx);assert.equal(preflights,2);assert.equal(sends,0);assert.equal(state.outbox[0].status,'pending');
});
test('Graph meeting creation preserves all-day wall time and invitations with recurrence',async()=>{
  let fields;global.fetch=async(_url,opts)=>{fields=JSON.parse(opts.body);return Response.json({id:'event'});};
  await new MicrosoftProvider(credentials,async()=>{}).saveEvent({title:'All day',start:'2026-10-13T00:00:00',end:'2026-10-14T00:00:00',location:'Here',notes:'Hello',allDay:true,attendees:'person@example.com',reminder:15,recurrence:'weekly',until:'2026-12-31',online:true});
  assert.equal(fields.start.dateTime,'2026-10-13T00:00:00');assert.ok(fields.start.timeZone);
  assert.equal(fields.attendees[0].emailAddress.address,'person@example.com');assert.equal(fields.isAllDay,true);assert.equal(fields.recurrence.pattern.type,'weekly');assert.equal(fields.isOnlineMeeting,true);
});
test('additional calendars have independent visibility and protected default calendar',()=>{
  const state=normalize(createDemo());localCommand(state,{kind:'calendar',operation:'create',name:'Work'},()=> 'work');
  localCommand(state,{kind:'calendar',operation:'visibility',id:'work',visible:false},()=> '');
  assert.equal(state.calendars.find(c=>c.id==='work').visible,false);
  assert.throws(()=>localCommand(state,{kind:'calendar',operation:'delete',id:'local'},()=> ''),/zusätzlichen/);
});
