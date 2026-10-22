(() => {
  const contacts = document.querySelector('.contact-links');
  if (!contacts) return;
  const status = document.createElement('p');
  status.className = 'contact-copy-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  contacts.after(status);

  contacts.querySelectorAll('a.contact-link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const isEmail = href.startsWith('mailto:');
    const isPhone = href.startsWith('https://wa.me/');
    if (!isEmail && !isPhone) return;
    const value = isEmail ? href.slice(7) : '+' + href.split('/').pop();
    const label = link.querySelector('.contact-kind')?.textContent.trim() || (isEmail ? 'Email' : 'WhatsApp');
    const entry = document.createElement('div');
    entry.className = 'contact-copy-entry';
    link.before(entry);
    entry.append(link);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'contact-copy-button';
    button.textContent = isEmail ? 'Copy Email Address' : 'Copy Phone Number';
    button.setAttribute('aria-label', `Copy ${label.toLowerCase()} ${isEmail ? 'address' : 'number'}`);
    const fallback = document.createElement('input');
    fallback.className = 'contact-copy-fallback';
    fallback.type = 'text';
    fallback.value = value;
    fallback.readOnly = true;
    fallback.hidden = true;
    fallback.setAttribute('aria-label', `${label} to copy manually`);
    entry.append(button, fallback);
    button.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(value);
        fallback.hidden = true;
        status.textContent = `${label} copied to the clipboard.`;
      } catch {
        fallback.hidden = false;
        fallback.focus();
        fallback.select();
        status.textContent = 'Automatic copying is unavailable. Copy the selected contact information manually.';
      }
    });
  });
})();
