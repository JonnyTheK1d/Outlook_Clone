import DOMPurify from 'dompurify';
import { api } from './bridge';
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName === 'src') data.keepAttr = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=\s]+$/i.test(data.attrValue) && data.attrValue.length < 1500000;
  if (data.attrName === 'href') { try { const url = new URL(data.attrValue); data.keepAttr = url.protocol === 'https:' && !url.username && !url.password; } catch { data.keepAttr = false; } }
});
// Restricted formatting only. No network resources, links, forms, SVG, CSS or active content.
export function sanitizeMail(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p','br','div','span','b','strong','i','em','u','s','blockquote','ul','ol','li','table','thead','tbody','tr','td','th','h1','h2','h3','h4','hr','pre','code','a','img'],
    ALLOWED_ATTR: ['colspan','rowspan','href','src','alt'], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false
  });
}
export function HtmlMail({ html }: { html: string }) {
  return <div className="mail-body html-mail" onClick={event => { const link = (event.target as HTMLElement).closest('a'); if (link) { event.preventDefault(); const url = link.getAttribute('href'); if (url) void api.manage({kind:'open-link',url}).catch(()=>{}); } }} dangerouslySetInnerHTML={{ __html: sanitizeMail(html) }}/>;
}
