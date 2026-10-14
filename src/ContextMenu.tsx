import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export type MenuItem = { label: string; icon?: ReactNode; shortcut?: string; action?: () => void; disabled?: boolean; items?: MenuItem[]; danger?: boolean } | 'separator';
export type MenuState = { x: number; y: number; items: MenuItem[] } | null;

function MenuList({ items, close, back }: { items: MenuItem[]; close: () => void; back?: () => void }) {
  const nested = !!back;
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    if (!nested || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    setFlip(box.right > window.innerWidth - 4);
    if (box.bottom > window.innerHeight - 4) ref.current.style.top = `${window.innerHeight - 4 - box.bottom}px`;
  }, [nested]);
  const focusable = () => [...(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > [role=menuitem]:not(:disabled)') || [])];
  const keydown = (event: ReactKeyboardEvent) => {
    const list = focusable(), index = list.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); list[(index + (event.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus(); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); event.stopPropagation(); (event.key === 'Home' ? list[0] : list[list.length - 1])?.focus(); }
    if (event.key === 'ArrowLeft' && back) { event.preventDefault(); event.stopPropagation(); back(); }
  };
  return <div ref={ref} className={'context-menu' + (nested ? ' submenu' : '') + (flip ? ' flip' : '')} role="menu" onKeyDown={keydown}>
    {items.map((item, i) => item === 'separator' ? <div className="menu-separator" role="separator" key={'s' + i}/> : <div className="menu-entry" key={i + ':' + item.label} onMouseEnter={() => setOpen(item.items ? i : null)}>
      <button role="menuitem" aria-haspopup={item.items ? 'menu' : undefined} aria-expanded={item.items ? open === i : undefined} className={item.danger ? 'danger' : ''} disabled={item.disabled} onClick={() => { if (item.items) { setOpen(i); return; } close(); item.action?.(); }} onKeyDown={event => { if (item.items && (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); setOpen(i); requestAnimationFrame(() => (event.currentTarget.parentElement?.querySelector('.submenu [role=menuitem]:not(:disabled)') as HTMLElement | null)?.focus()); } }}>
        <span className="menu-icon">{item.icon}</span><span className="menu-label">{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}{item.items && <ChevronRight size={14}/>}
      </button>
      {item.items && open === i && <MenuList items={item.items} close={close} back={() => { setOpen(null); focusable()[focusable().findIndex(b => b.textContent?.startsWith(item.label))]?.focus(); }}/>}
    </div>)}
  </div>;
}

export function ContextMenu({ menu, close }: { menu: NonNullable<MenuState>; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close); closeRef.current = close;
  const [position, setPosition] = useState({ left: menu.x, top: menu.y });
  useLayoutEffect(() => {
    const box = ref.current!.getBoundingClientRect();
    setPosition({ left: Math.max(4, Math.min(menu.x, window.innerWidth - box.width - 4)), top: Math.max(4, Math.min(menu.y, window.innerHeight - box.height - 4)) });
    ref.current?.querySelector<HTMLElement>('[role=menuitem]:not(:disabled)')?.focus();
  }, [menu]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const pointer = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) closeRef.current(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); closeRef.current(); } };
    const dismiss = () => closeRef.current();
    window.addEventListener('mousedown', pointer, true); window.addEventListener('keydown', key, true); window.addEventListener('blur', dismiss); window.addEventListener('resize', dismiss);
    return () => { window.removeEventListener('mousedown', pointer, true); window.removeEventListener('keydown', key, true); window.removeEventListener('blur', dismiss); window.removeEventListener('resize', dismiss); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div ref={ref} className="context-menu-root" style={position} onContextMenu={event => event.preventDefault()}><MenuList items={menu.items} close={close}/></div>;
}
