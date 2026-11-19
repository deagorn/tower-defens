// Tower Defense Academy: shared, data-only script history for editor + pupil view.
// No evaluation of student-authored Lua/HTML. Use textContent/escaped HTML only.
export const escapeCode = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = s => String(s||'').trim().toLocaleLowerCase();
export function collectVersions(lessons,scriptKey){
  if(!key(scriptKey))return [];
  const result=[];
  for(const l of lessons||[]){
    (l.steps||[]).forEach((step,si)=>(step.blocks||[]).forEach((block,bi)=>{
      if(block.type==='code'&&key(block.scriptKey)===key(scriptKey)&&String(block.content||'').trim()){
        result.push({id:block.id,lessonNumber:l.lesson_number,lessonTitle:l.title||`Урок ${l.lesson_number}`,stepTitle:step.title||`Крок ${si+1}`,stepIndex:si,blockIndex:bi,code:block.content,scriptPath:block.scriptPath||''});
      }
    }));
  }
  return result.sort((a,b)=>a.lessonNumber-b.lessonNumber||a.stepIndex-b.stepIndex||a.blockIndex-b.blockIndex);
}
export function precedingVersion(lessons,scriptKey,lessonNumber,stepIndex,blockIndex){
  return collectVersions(lessons,scriptKey).filter(v=>v.lessonNumber<lessonNumber||(v.lessonNumber===lessonNumber&&(v.stepIndex<stepIndex||(v.stepIndex===stepIndex&&v.blockIndex<blockIndex)))).at(-1)||null;
}
// Line-by-line LCS diff: true additions/deletions, with a bounded fallback for very long Lua files.
export function lineDiff(before,after){
 const a=String(before||'').split('\n'),b=String(after||'').split('\n');
 if(a.length*b.length>70000){return [{kind:'info',text:'Великий скрипт: показано стару й нову версії окремо, без порівняння рядків.'}];}
 const dp=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 const result=[];let i=0,j=0;
 while(i<a.length||j<b.length){
  if(i<a.length&&j<b.length&&a[i]===b[j]){result.push({kind:'same',text:a[i]});i++;j++}
  else if(j<b.length&&(i===a.length||dp[i][j+1]>=dp[i+1][j])){result.push({kind:'add',text:b[j++]})}
  else {result.push({kind:'del',text:a[i++]})}
 }
 return result;
}
export function diffMarkup(before,after){
 return lineDiff(before,after).map(x=>`<span class="script-diff-line ${x.kind}"><span class="script-diff-prefix" aria-hidden="true">${x.kind==='add'?'+':x.kind==='del'?'−':' '}</span><span class="script-diff-code">${escapeCode(x.text)||' '}</span></span>`).join('\n');
}
