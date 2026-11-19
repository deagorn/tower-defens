// Safe, version-compatible rich text fragment used by the editor and the pupil view.
// This module intentionally excludes embeds, images, arbitrary HTML and event attributes.
const TAGS = new Set(['P','DIV','BR','STRONG','B','EM','I','U','S','H2','H3','H4','UL','OL','LI','BLOCKQUOTE','SPAN','FONT','CODE']);
const DROP = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','LINK','META','VIDEO','AUDIO','IMG']);
function cleanStyle(node) {
  let out=[];
  for(const prop of ['color','background-color']) {
    const value=node.style.getPropertyValue(prop).trim();
    if(/^#[0-9a-f]{3,8}$/i.test(value)||/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(value)) out.push(`${prop}:${value}`);
  }
  const size=node.style.fontSize.trim();
  if(/^\d+(\.\d+)?px$/.test(size)&&parseFloat(size)>=11&&parseFloat(size)<=40)out.push(`font-size:${size}`);
  const align=node.style.textAlign.trim();
  if(['left','center','right'].includes(align))out.push(`text-align:${align}`);
  return out.join(';');
}
function safeNode(node,doc) {
  if(node.nodeType===3)return doc.createTextNode(node.textContent||'');
  if(node.nodeType!==1)return null;
  if(DROP.has(node.tagName))return null;
  const tag=TAGS.has(node.tagName)?node.tagName.toLowerCase():'span';
  const el=doc.createElement(tag==='font'?'span':tag);
  const style=cleanStyle(node);
  const fontColor=node.tagName==='FONT'&&/^#[0-9a-f]{3,8}$/i.test(node.getAttribute('color')||'')?`color:${node.getAttribute('color')}`:'';
  const fontSize=node.tagName==='FONT'&&/^\d+$/.test(node.getAttribute('size')||'')?`font-size:${Math.min(36,Math.max(12,12+Number(node.getAttribute('size'))*2))}px`:'';
  const finalStyle=[style,fontColor,fontSize].filter(Boolean).join(';');
  if(finalStyle)el.setAttribute('style',finalStyle);
  for(const child of node.childNodes){const safe=safeNode(child,doc);if(safe)el.append(safe)}
  return el;
}
export function sanitizeRich(html){const dom=new DOMParser().parseFromString(String(html||''),'text/html');const result=dom.createElement('div');for(const child of [...dom.body.childNodes]){const safe=safeNode(child,dom);if(safe)result.append(safe)}return result.innerHTML}
export function plainRich(text){return `<p>${String(text||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/\r?\n/g,'<br>')}</p>`}
export function blockRich(block){return sanitizeRich(block.richHtml||plainRich(block.content||''))}
