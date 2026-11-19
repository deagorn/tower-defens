const escapeHtml=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
/** Rules per line: one literal phrase | #RRGGBB; first valid matching rule wins. */
export function parseColorRules(raw){
 return String(raw||'').split('\n').slice(0,50).map(row=>{
  const at=row.lastIndexOf('|');if(at<1)return null;
  const phrase=row.slice(0,at).trim(),color=row.slice(at+1).trim();
  return phrase&&phrase.length<=100&&/^#[0-9a-fA-F]{6}$/.test(color)?{phrase,color}:null;
 }).filter(Boolean);
}
export function highlightLua(code){
 const raw=String(code||''),pattern=/(--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:local|function|end|if|then|else|elseif|return|for|in|do|while|and|or|not|true|false|nil|repeat|until|break)\b|\b\d+(?:\.\d+)?\b)/g;
 let result='',last=0,m;while((m=pattern.exec(raw))){result+=escapeHtml(raw.slice(last,m.index));const t=m[0];let kind=t.startsWith('--')?'comment':/^["']/.test(t)?'string':/^\d/.test(t)?'number':'keyword';result+=`<span class="lua-${kind}">${escapeHtml(t)}</span>`;last=pattern.lastIndex}return result+escapeHtml(raw.slice(last));
}
function renderCustom(line,rules){
 if(!rules.length)return highlightLua(line);
 let cursor=0,output='';
 while(cursor<line.length){
  let best=null;
  for(let priority=0;priority<rules.length;priority++){
   const rule=rules[priority],at=line.indexOf(rule.phrase,cursor);
   if(at<0)continue;
   if(!best||at<best.at||(at===best.at&&priority<best.priority))best={...rule,at,priority};
  }
  if(!best){output+=highlightLua(line.slice(cursor));break;}
  output+=highlightLua(line.slice(cursor,best.at));
  output+=`<span class="lua-custom" style="color:${best.color}">${escapeHtml(best.phrase)}</span>`;
  cursor=best.at+best.phrase.length;
 }
 return output;
}
export function codeLines(block){
 const selected=new Set(String(block.emphasisLines||'').split(/[,\s]+/).map(Number).filter(n=>n>0));
 const rules=parseColorRules(block.manualColors);
 return String(block.content||'').split('\n').map((line,i)=>`<span class="lua-line ${selected.has(i+1)?'lua-line-emphasis':''}" data-ln="${i+1}">${renderCustom(line,rules)||' '}</span>`).join('\n');
}
