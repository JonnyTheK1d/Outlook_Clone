// Tab rail, keyboard template and checksum copy. The page reads completely without this script.
(() => {
  const chapters = [...document.querySelectorAll('.chapter')];
  const tabs = [...document.querySelectorAll('.rail a')];
  const announce = document.getElementById('announce');

  // Tab height follows each chapter's share of the book, like the stepped fore edge.
  const sizeTabs = () => {
    const total = chapters.reduce((sum, chapter) => sum + chapter.offsetHeight, 0) || 1;
    chapters.forEach((chapter, i) => tabs[i]?.style.setProperty('--extent', String(Math.max(.6, chapter.offsetHeight / total * chapters.length))));
  };
  const markCurrent = () => {
    const line = innerHeight * .35;
    let current = chapters[0];
    for (const chapter of chapters) if (chapter.getBoundingClientRect().top <= line) current = chapter;
    tabs.forEach(tab => tab.setAttribute('aria-current', String(tab.hash === '#' + current.id)));
  };
  sizeTabs(); markCurrent();
  addEventListener('resize', () => { sizeTabs(); markCurrent(); });
  addEventListener('scroll', markCurrent, { passive: true });

  // Keyboard template: real shortcuts punch their row while the template has focus.
  const template = document.querySelector('.template');
  const caption = document.getElementById('fig1-caption');
  const rows = [...template.querySelectorAll('button[data-keys]')];
  const punch = row => {
    rows.forEach(other => other.setAttribute('aria-pressed', String(other === row)));
    caption.textContent = row.dataset.say;
    announce.textContent = row.dataset.say;
  };
  rows.forEach(row => { row.setAttribute('aria-pressed', 'false'); row.addEventListener('click', () => punch(row)); });
  const combo = event => [event.ctrlKey || event.metaKey ? 'ctrl' : '', event.shiftKey ? 'shift' : '', ({ Enter: 'enter', Delete: 'delete', Backspace: 'backspace', F9: 'f9' })[event.key] || event.key.toLowerCase()].filter(Boolean).join('+');
  template.addEventListener('focusin', () => template.classList.add('armed'));
  template.addEventListener('focusout', event => { if (!template.contains(event.relatedTarget)) template.classList.remove('armed'); });
  template.addEventListener('keydown', event => {
    const keys = combo(event);
    const row = rows.find(r => r.dataset.keys === keys || (keys === 'ctrl+u' && r.dataset.keys === 'ctrl+q'));
    // Enter on a focused row is that row's own activation.
    if (!row || (keys === 'enter' && event.target !== template)) return;
    event.preventDefault();
    punch(row);
  });
  template.addEventListener('click', event => { if (event.target === template || !event.target.closest('button')) template.focus(); });

  for (const button of document.querySelectorAll('.copy')) {
    button.addEventListener('click', async () => {
      const text = document.getElementById(button.dataset.copy)?.textContent.trim() || '';
      try { await navigator.clipboard.writeText(text); button.textContent = 'Kopiert'; button.dataset.done = ''; }
      catch { getSelection()?.selectAllChildren(document.getElementById(button.dataset.copy)); button.textContent = 'Markiert'; }
      setTimeout(() => { button.textContent = 'Kopieren'; delete button.dataset.done; }, 2400);
    });
  }
})();
