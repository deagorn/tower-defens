import {connect,configured,myId,getProfile,queryError} from './cloud.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LESSONS=Array.from({length:16},(_,i)=>({number:i+1,name:`Урок ${i+1}`}));
let ctx=null,profile=null,groups=[],students=[],progress=[],publishedLessons=[],selectedGroup=null,subs=[],clock,searchTerm="",expandedStudent=null,groupView="active",groupSearch="";
const notify=s=>{const n=$('#snack');n.textContent=s;n.classList.add('show');clearTimeout(clock);clock=setTimeout(()=>n.classList.remove('show'),3400)};
function fail(e){console.error(e);notify(e.message||'Помилка');}
function clearSubs(){for(const c of subs){ctx?.db.removeChannel(c)}subs=[];}
async function fetchData(){
 const {db}=ctx;
 if(profile.role==='teacher'){
  let r=await db.from('groups').select('id,name,open_through,teacher_id,is_archived,archived_at').order('name');queryError(r.error);groups=r.data||[];
  r=await db.from('profiles').select('clerk_id,nickname,username,role,group_id').eq('role','student');queryError(r.error);students=r.data||[];
  r=await db.from('lesson_progress').select('student_id,lesson_id,current_step,completed_steps,updated_at');queryError(r.error);progress=r.data||[];
   r=await db.from('lesson_content').select('lesson_number,title,status,steps').eq('teacher_id',profile.clerk_id);queryError(r.error);publishedLessons=r.data||[];
  if(!groups.some(g=>g.id===selectedGroup && (groupView==='archived')===Boolean(g.is_archived)))selectedGroup=groups.find(g=>Boolean(g.is_archived)===(groupView==='archived'))?.id||null;
 } else {
  let r=await db.from('groups').select('id,name,open_through,is_archived').eq('id',profile.group_id).maybeSingle();queryError(r.error);groups=r.data?[r.data]:[];
  r=await db.from('lesson_progress').select('student_id,lesson_id,current_step,completed_steps,updated_at').eq('student_id',profile.clerk_id);queryError(r.error);progress=r.data||[];
  r=await db.from('lesson_content').select('lesson_number,title,status,steps');queryError(r.error);publishedLessons=r.data||[];
 }
 render();
}
function listen(){clearSubs();const {db}=ctx;
 const channel=db.channel(`tda-data-${profile.clerk_id}`)
 .on('postgres_changes',{event:'*',schema:'public',table:'groups'},()=>refreshQuietly())
 .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>refreshQuietly())
 .on('postgres_changes',{event:'*',schema:'public',table:'lesson_progress'},()=>refreshQuietly())
 .subscribe();subs.push(channel);
 // Періодичний запасний опитувач на випадок проблем із Realtime.
 clearInterval(window.tdaPoll);window.tdaPoll=setInterval(()=>{if(!document.hidden)refreshQuietly()},30000);
}
let refreshing=false;
async function refreshQuietly(){if(refreshing||!ctx||!profile)return;refreshing=true;try{profile=await getProfile(ctx.db,myId(ctx.clerk));if(profile)await fetchData();else{clearSubs();renderMissing()}}catch(e){console.warn('Sync:',e)}finally{refreshing=false}}
function status(text){$('#connectionState').textContent=text}
function renderMissing(){status('● НЕМАЄ ПРОФІЛЮ');$('#app').innerHTML=`<div class="panel"><h2>Акаунт ще не прив’язано до Academy</h2><p>Твій Clerk ID: <code>${esc(myId(ctx.clerk))}</code></p><p>Викладач повинен додати цей ID у таблицю profiles. Якщо це твій викладацький акаунт — виконай початкове налаштування в Supabase за інструкцією README.</p><button class="secondary" id="logout">Вийти</button></div>`}
function render(){
 status('● ОНЛАЙН');$('#crumb').textContent='ACADEMY / '+(profile.role==='teacher'?'ПАНЕЛЬ ВИКЛАДАЧА':'КАБІНЕТ УЧНЯ');
 $('#roleButtons').innerHTML=`<div class="role active">${profile.role==='teacher'?'⚙ Панель викладача':'◈ Кабінет учня'}</div>${profile.role==='teacher'?'<a class="role" href="editor.html">✎ Редактор уроків</a>':''}<button class="secondary" id="logout">Вийти</button>`;
 $('#app').innerHTML=profile.role==='teacher'?teacherHTML():studentHTML();
}
// Звіт рахується виключно за опублікованими, відкритими для групи уроками.
// Немає вигаданого відсотка для уроків без матеріалів.
function courseMetrics(group,records){
 const available=publishedLessons.filter(l=>l.status==='published'&&l.lesson_number<=Number(group?.open_through||0)&&Array.isArray(l.steps)&&l.steps.length);
 let total=0,completed=0;const per=[];
 for(const l of available){const key=`lesson-${String(l.lesson_number).padStart(2,'0')}`;const r=records.find(p=>p.lesson_id===key);const ids=new Set(l.steps.map(x=>x.id));const done=new Set((r?.completed_steps||[]).filter(id=>ids.has(id)));total+=ids.size;completed+=done.size;per.push({lesson:l,record:r,done:done.size,total:ids.size,remaining:ids.size-done.size})}
 const latest=records.filter(r=>r.updated_at).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))[0]||null;
 const unfinished=per.filter(x=>x.remaining>0);
 // Спочатку останній розпочатий незакінчений урок, інакше — перший незакінчений.
 const lastStarted=unfinished.filter(x=>x.record).sort((a,b)=>String(b.record.updated_at||'').localeCompare(String(a.record.updated_at||'')))[0];
 const resume=lastStarted||unfinished[0]||null;
 const step=resume?Math.max(0,Math.min(resume.total-1,Number(resume.record?.current_step||0))):0;
 return {total,completed,remaining:Math.max(0,total-completed),percent:total?Math.round(completed/total*100):null,available:available.length,per,latest,resume,step};
}
function formatActivity(value){if(!value)return 'Ще немає активності';const d=new Date(value);return Number.isNaN(+d)?'Невідома дата':d.toLocaleString('uk-UA',{dateStyle:'medium',timeStyle:'short'})}
function resumeLink(metrics,teacher=false){const r=metrics.resume;if(!r)return '';const url=`course.html?lesson=${r.lesson.lesson_number}${teacher?'&preview=1':''}&step=${metrics.step+1}`;return `<a class="secondary" href="${url}" ${teacher?'target="_blank" rel="noopener"':''}>${teacher?'👁 Переглянути крок':'▶ Продовжити з кроку'} ${metrics.step+1} · урок ${r.lesson.lesson_number} →</a>`}
function studentHTML(){
 const g=groups[0];const pr=progress.find(p=>p.lesson_id==='base-health-demo');const done=pr?.completed_steps?.length||0;const metrics=courseMetrics(g,progress);
 return `<div class="hero"><div><span class="eyebrow">ОСОБИСТИЙ КАБІНЕТ</span><h1>Привіт, <em>${esc(profile.nickname)}</em> ✦</h1><p>Продовжуй роботу у власному темпі. Твій прогрес синхронізується онлайн.</p></div><span class="pill">${esc(g?.name||'Група не призначена')}</span></div>
 <div class="stats"><div class="stat"><span>Відкрито уроків</span><b>${g?.open_through||0}</b><small>із 16</small></div><div class="stat"><span>Здоров’я бази</span><b>${done}</b><small>із 7 кроків</small></div><div class="stat"><span>Останній крок прикладу</span><b>${(pr?.current_step||0)+1}</b><small>із 7</small></div></div>
 <div class="panel"><h2>📊 Мій прогрес за доступними уроками</h2><div class="student-metrics"><span>Виконано: <b>${metrics.completed} / ${metrics.total}</b> кроків</span><span>Залишилося: <b>${metrics.remaining}</b></span><span>Прогрес: <b>${metrics.percent===null?'—':metrics.percent+'%'}</b></span></div><div class="progress-track"><div style="width:${metrics.percent||0}%"></div></div><p>Остання активність: ${esc(formatActivity(metrics.latest?.updated_at))}. Підрахунок лише за опублікованими уроками, відкритими твоїй групі.</p>${resumeLink(metrics)}</div>
 <div class="panel"><h2>✦ Здоров’я бази · демонстраційний урок</h2><p>Повна інструкція з твоїми скриншотами, кодом і покроковою навігацією. Її номер серед 16 занять ще не визначений, тому це окрема демонстрація.</p><div class="progress-track"><div style="width:${Math.round(done/7*100)}%"></div></div><p>Пройдено ${done} із 7 кроків.</p><a class="primary" href="lesson.html">Продовжити урок →</a></div>
 <div class="section-head"><h2>16 уроків</h2></div><div class="lesson-grid">${LESSONS.map(l=>{const content=publishedLessons.find(c=>c.lesson_number===l.number&&c.status==='published');const unlocked=l.number<=(g?.open_through||0);const ready=unlocked&&content;const p=progress.find(x=>x.lesson_id===`lesson-${String(l.number).padStart(2,'0')}`);return `<div class="lesson-card ${ready?'':'locked'}"><small>УРОК ${String(l.number).padStart(2,'0')}</small><h3>${esc(content?.title||l.name)}</h3><p>${!unlocked?'Заблоковано викладачем':!content?'Матеріали уроку ще готуються':`Пройдено кроків: ${p?.completed_steps?.length||0}`}</p><div class="bottom">${ready?`<a class="primary" href="course.html?lesson=${l.number}">${p?'Продовжити':'Відкрити урок'} →</a>`:`<span class="tag">${unlocked?'СКОРО':'🔒 ЗАКРИТО'}</span>`}</div></div>`}).join('')}</div>`;
}
function teacherHTML(){
 const g=groups.find(x=>x.id===selectedGroup), pupils=students.filter(s=>s.group_id===selectedGroup);
 const filteredGroups=groups.filter(x=>Boolean(x.is_archived)===(groupView==='archived')&&`${x.name} ${students.filter(s=>s.group_id===x.id).map(s=>s.nickname+' '+s.username).join(' ')}`.toLowerCase().includes(groupSearch.toLowerCase()));
 const visible=pupils.filter(s=>`${s.nickname} ${s.username}`.toLowerCase().includes(searchTerm.toLowerCase()));
 const progressFor=id=>progress.filter(p=>p.student_id===id).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
 const lastActivity=s=>progressFor(s.clerk_id)[0]?.updated_at;
 return `<div class="hero"><div><span class="eyebrow">КЕРУВАННЯ НАВЧАННЯМ · V5.3</span><h1>Панель <em>викладача</em></h1><p>Редагуй групи та переглядай прогрес кожного учня. Усі зміни зберігаються у Supabase.</p></div><span class="pill">Захищений доступ</span></div>
 <div class="button-row" style="margin:0 0 20px"><a class="primary" href="editor.html">✎ Відкрити редактор уроків →</a></div><div class="stats"><div class="stat"><span>Активних груп</span><b>${groups.filter(g=>!g.is_archived).length}</b></div><div class="stat"><span>Учнів</span><b>${students.length}</b></div><div class="stat"><span>Уроків у плані</span><b>16</b></div></div>
 <div class="section-head"><h2>Мої групи</h2></div>
 <div class="archive-tabs"><button class="secondary ${groupView==='active'?'selected':''}" data-view="active">Активні (${groups.filter(x=>!x.is_archived).length})</button><button class="secondary ${groupView==='archived'?'selected':''}" data-view="archived">📦 Архів (${groups.filter(x=>x.is_archived).length})</button></div>
 <div class="panel archive-search"><label>Знайти групу або учня (у вибраному розділі)<input id="group-search" value="${esc(groupSearch)}" placeholder="Назва групи, ім'я, логін"></label></div>
 <div class="group-tabs">${filteredGroups.map(x=>`<button class="group-tab ${x.id===selectedGroup?'active':''}" data-group="${esc(x.id)}">${esc(x.name)} · ${x.open_through}/16</button>`).join('')||'<p class="note">Тут немає груп.</p>'}</div>
 <div class="panel"><h2>Створити групу</h2><form id="create-group" class="form-row"><div class="field"><label>Назва групи</label><input name="name" maxlength="60" required placeholder="Наприклад, Середа 16:00"></div><button class="primary" type="submit">+ Додати групу</button></form></div>
 ${g?`<div class="panel"><h2>Налаштування групи · ${esc(g.name)}</h2><form id="rename-group" class="form-row"><div class="field"><label>Нова назва</label><input name="name" maxlength="60" required value="${esc(g.name)}"></div><button class="secondary">Зберегти назву</button></form><div class="button-row" style="margin-top:12px"><button class="secondary" data-toggle-archive="${esc(g.id)}">${g.is_archived?'↩ Повернути до активних':'📦 Архівувати групу'}</button><button class="danger" id="delete-group" ${pupils.length?'disabled title="Спочатку перенеси або видали учнів"':''}>Видалити порожню групу</button><span class="note">Архівування не змінює доступ дітей до уроків і не зупиняє прогрес.</span><span class="note">Групу з учнями видалити неможливо.</span></div></div>
 <div class="panel"><div class="section-head" style="margin:0 0 15px"><h2>Доступ · ${esc(g.name)}</h2><span class="pill">${g.open_through}/16</span></div><p>Натисни номер останнього доступного уроку. Зміни синхронізуються онлайн.</p><div class="unlock-grid">${LESSONS.map(l=>`<button class="unlock ${l.number<=g.open_through?'active':''}" data-limit="${l.number}">${l.number}<br><span style="font-size:10px">${l.number<=g.open_through?'✓':'🔒'}</span></button>`).join('')}</div></div>`:''}
 <div class="panel"><h2>Прив'язати учня до групи</h2><p>Спочатку створи username і пароль у Clerk Dashboard → Users, а тут додай його User ID. Паролі тут не вводяться.</p><form id="create-student" class="form-row"><div class="field"><label>Псевдонім</label><input name="nickname" required maxlength="60" placeholder="Гравець 1"></div><div class="field"><label>Логін із Clerk</label><input name="username" required pattern="[a-zA-Z0-9_]{3,40}" placeholder="player_one"></div><div class="field"><label>Clerk User ID</label><input name="clerkId" required placeholder="user_..."></div><div class="field"><label>Група</label><select name="groupId">${groups.filter(x=>!x.is_archived).map(x=>`<option value="${esc(x.id)}" ${x.id===selectedGroup?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><button class="primary" type="submit" ${!groups.length?'disabled':''}>+ Прив'язати учня</button></form></div>
 <div class="section-head"><h2>Прогрес · ${esc(g?.name||'група')}</h2><small>${pupils.length} учнів</small></div>
 <div class="panel"><div class="form-row"><div class="field"><label>Знайти учня</label><input id="student-search" value="${esc(searchTerm)}" placeholder="Ім'я або логін"></div><button type="button" class="secondary" id="clear-search">Очистити</button></div><p>Натисни «Детальніше», щоб переглянути всі збережені записи прогресу та змінити профіль.</p></div>
 <div class="student-list">${visible.length?visible.map(s=>{const records=progressFor(s.clerk_id),p=records[0],demo=p?.lesson_id==='base-health-demo',lessonNo=p?.lesson_id?.match(/^lesson-(\d+)$/)?.[1],course=publishedLessons.find(x=>x.lesson_number===Number(lessonNo)),done=p?.completed_steps?.length||0,metrics=courseMetrics(groups.find(g=>g.id===s.group_id),records),expanded=expandedStudent===s.clerk_id;return `<div class="panel student-expanded"><div class="student-row"><div class="avatar">${esc(s.nickname.slice(0,1).toUpperCase())}</div><div class="student-details"><strong>${esc(s.nickname)}</strong><span>${esc(s.username)} · ${esc(demo?"Здоров’я бази":course?.title|| (lessonNo?"Урок "+Number(lessonNo):"Ще немає прогресу"))} · ${metrics.completed}/${metrics.total} кроків · ${metrics.percent===null?"—":metrics.percent+"%"} · залишилося ${metrics.remaining}</span><div class="progress-track"><div style="width:${metrics.percent||0}%"></div></div></div><div class="student-side"><b>${metrics.available} уроків</b><small>${esc(formatActivity(metrics.latest?.updated_at))}</small></div></div><button class="secondary" data-expand="${esc(s.clerk_id)}">${expanded?'Згорнути':'Детальніше'}</button>${expanded?`<div class="divider"></div><h3>Загальний прогрес за відкритими уроками</h3><p>Виконано ${metrics.completed} із ${metrics.total} кроків (${metrics.percent===null?'немає опублікованих уроків':metrics.percent+'%'}). Незавершених кроків: ${metrics.remaining}.</p><p>Остання активність: ${esc(formatActivity(metrics.latest?.updated_at))}</p><div class="button-row">${resumeLink(metrics,true)}</div><h3>За уроками</h3>${metrics.per.map(x=>`<div class="progress-entry"><b>Урок ${x.lesson.lesson_number}: ${esc(x.lesson.title)}</b><span>${x.done}/${x.total} · залишилося ${x.remaining}</span></div>`).join('')||'<p>Ще немає опублікованих доступних уроків.</p>'}<h3>Історія прогресу</h3>${records.length?records.map(r=>`<div class="progress-entry"><div><b>${esc(r.lesson_id==='base-health-demo'?'Здоров’я бази':(publishedLessons.find(c=>`lesson-${String(c.lesson_number).padStart(2,'0')}`===r.lesson_id)?.title||r.lesson_id))}</b><p>Крок ${(r.current_step||0)+1} · ${r.completed_steps?.length||0} виконаних кроків</p></div><small>${r.updated_at?new Date(r.updated_at).toLocaleString('uk-UA'):'—'}</small></div>`).join(''):'<p>Дитина ще не починала уроки.</p>'}<h3>Редагувати учня</h3><form class="form-row edit-student" data-student="${esc(s.clerk_id)}"><div class="field"><label>Псевдонім</label><input name="nickname" maxlength="60" required value="${esc(s.nickname)}"></div><div class="field"><label>Логін (відображення)</label><input name="username" required pattern="[a-zA-Z0-9_]{3,40}" value="${esc(s.username)}"></div><div class="field"><label>Перенести до групи</label><select name="groupId">${groups.map(gg=>`<option value="${esc(gg.id)}" ${gg.id===s.group_id?'selected':''}>${esc(gg.name)}</option>`).join('')}</select></div><button class="primary">Зберегти</button></form><p class="note">Зміна логіна тут не змінює username у Clerk. Якщо потрібен новий логін для входу, спочатку зміни його в Clerk Dashboard.</p><div class="button-row"><button class="danger" data-delete-student="${esc(s.clerk_id)}">Видалити профіль і прогрес</button></div><p class="note">Видалення не зачіпає акаунт Clerk: за потреби його видаляють окремо.</p>`:''}</div>`}).join(''):'<div class="empty">Учнів не знайдено.</div>'}</div>
 <div class="panel"><h2>Експорт груп</h2><p>JSON-файл: групи, учні, доступні уроки та онлайн-прогрес — без паролів.</p><div class="button-row"><button class="primary" id="export-all">↓ Усі групи</button><button class="secondary" id="export-one" ${!g?'disabled':''}>↓ Ця група</button></div></div>`;
}
function downloadJson(only){const relevant=only?groups.filter(g=>g.id===selectedGroup):groups;const ids=new Set(relevant.map(g=>g.id));const ps=students.filter(s=>ids.has(s.group_id));const pupilIds=new Set(ps.map(s=>s.clerk_id));const content={schemaVersion:2,app:'Tower Defense Academy',exportedAt:new Date().toISOString(),groups:relevant,students:ps,progress:progress.filter(p=>pupilIds.has(p.student_id)),passwordsIncluded:false};const u=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=`tower-defense-export-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);notify('Експорт готовий')}
async function toggleArchive(id){
 const g=groups.find(x=>x.id===id);if(!g)return;
 const archived=!g.is_archived;
 const question=archived?`Архівувати «${g.name}»? Учні збережуть доступ до відкритих уроків та зможуть допройти їх.`:`Повернути «${g.name}» до активних груп?`;
 if(!confirm(question))return;
 const {data,error}=await ctx.db.from('groups').update({is_archived:archived,archived_at:archived?new Date().toISOString():null}).eq('id',id).select('id');
 queryError(error);if(!data?.length)throw Error('Статус групи не змінився. Перевір дозволи UPDATE для is_archived та archived_at (оновлення v5.5.1).');
 await fetchData();notify(archived?'Групу перенесено до архіву без обмеження доступу':'Групу відновлено');
}
async function setLimit(n){const g=groups.find(x=>x.id===selectedGroup);if(!g||n===g.open_through)return;if(n<g.open_through&&!confirm(`Закрити уроки ${n+1}–${g.open_through}?`))return;const {error}=await ctx.db.from('groups').update({open_through:n}).eq('id',g.id);queryError(error);await fetchData();notify('Доступ до уроків оновлено онлайн')}
async function onSubmit(e){
 e.preventDefault();
 const form=e.target;
 if(form.id==='create-group'){
  const name=form.elements.name.value.trim();if(!name)return;
  const {error}=await ctx.db.from('groups').insert({name,teacher_id:profile.clerk_id,open_through:1});queryError(error);await fetchData();notify('Групу створено онлайн');
 }else if(form.id==='rename-group'){
  const name=form.elements.name.value.trim();if(!name||!selectedGroup)return;
  const {data,error}=await ctx.db.from('groups').update({name}).eq('id',selectedGroup).select('id');queryError(error);
  if(!data?.length)throw Error('Назву не змінено: перевір права доступу');await fetchData();notify('Групу перейменовано');
 }else if(form.id==='create-student'){
  const f=form.elements;const nickname=f.nickname.value.trim(),username=f.username.value.trim().toLowerCase(),clerk_id=f.clerkId.value.trim(),group_id=f.groupId.value;
  if(!nickname||!/^\w{3,40}$/.test(username)||!/^user_[a-zA-Z0-9]+$/.test(clerk_id)||!groups.some(g=>g.id===group_id))throw Error('Перевір дані та Clerk User ID');
  const {error}=await ctx.db.from('profiles').insert({clerk_id,nickname,username,role:'student',group_id});queryError(error);await fetchData();notify('Учня прив’язано до групи');
 }else if(form.classList.contains('edit-student')){
  const id=form.dataset.student;const s=students.find(s=>s.clerk_id===id);if(!s)return;
  const nickname=form.elements.nickname.value.trim(),username=form.elements.username.value.trim().toLowerCase(),group_id=form.elements.groupId.value;
  if(!nickname||!/^\w{3,40}$/.test(username)||!groups.some(g=>g.id===group_id))throw Error('Перевір дані');
  const {data,error}=await ctx.db.from('profiles').update({nickname,username,group_id}).eq('clerk_id',id).select('clerk_id');queryError(error);
  if(!data?.length)throw Error('Не вдалося оновити учня. Чи виконано upgrade-v4.sql?');await fetchData();notify('Дані учня оновлено');
 }
}
async function removeStudent(id){
 const s=students.find(s=>s.clerk_id===id);if(!s)return;
 if(!confirm(`Видалити профіль «${s.nickname}» і ВСІ його записи прогресу з Supabase? Цю дію не можна скасувати. Акаунт Clerk залишиться.`))return;
 const typed=prompt('Для підтвердження введи слово ВИДАЛИТИ');if(typed!=='ВИДАЛИТИ')return;
 const {data,error}=await ctx.db.from('profiles').delete().eq('clerk_id',id).select('clerk_id');queryError(error);
 if(!data?.length)throw Error('Профіль не видалено: перевір SQL-права');expandedStudent=null;await fetchData();notify('Профіль і прогрес видалено');
}
async function removeGroup(){const g=groups.find(g=>g.id===selectedGroup);if(!g)return;
 if(students.some(s=>s.group_id===g.id))throw Error('Перенеси або видали учнів перед видаленням групи');
 if(!confirm(`Видалити порожню групу «${g.name}»?`))return;
 const {data,error}=await ctx.db.from('groups').delete().eq('id',g.id).select('id');queryError(error);
 if(!data?.length)throw Error('Групу не видалено. Перевір SQL-права');selectedGroup=null;await fetchData();notify('Порожню групу видалено');
}
$('#app').addEventListener('submit',e=>{onSubmit(e).catch(fail)});
$('#app').addEventListener('input',e=>{if(e.target.id==='group-search'){const start=e.target.selectionStart;groupSearch=e.target.value;render();const el=$('#group-search');el?.focus();el?.setSelectionRange(start,start);return}if(e.target.id==='student-search'){const start=e.target.selectionStart;searchTerm=e.target.value;render();const el=$('#student-search');el?.focus();el?.setSelectionRange(start,start)}});
$('#app').addEventListener('click',e=>{
 const view=e.target.closest('[data-view]');if(view){groupView=view.dataset.view;selectedGroup=groups.find(g=>Boolean(g.is_archived)===(groupView==='archived'))?.id||null;groupSearch='';expandedStudent=null;render();return}
 const archive=e.target.closest('[data-toggle-archive]');if(archive){toggleArchive(archive.dataset.toggleArchive).catch(fail);return}
 const g=e.target.closest('[data-group]');if(g){selectedGroup=g.dataset.group;expandedStudent=null;searchTerm='';render();return}
 const limit=e.target.closest('[data-limit]');if(limit){setLimit(+limit.dataset.limit).catch(fail);return}
 const expand=e.target.closest('[data-expand]');if(expand){expandedStudent=expandedStudent===expand.dataset.expand?null:expand.dataset.expand;render();return}
 const del=e.target.closest('[data-delete-student]');if(del){removeStudent(del.dataset.deleteStudent).catch(fail);return}
 if(e.target.closest('#delete-group')){removeGroup().catch(fail);return}
 if(e.target.closest('#clear-search')){searchTerm='';render();return}
 if(e.target.closest('#export-all'))downloadJson(false);
 if(e.target.closest('#export-one'))downloadJson(true);
});
document.addEventListener('click',e=>{if(e.target.closest('#logout')){ctx?.clerk.signOut().then(()=>location.reload()).catch(fail)}});
async function boot(){
 if(!configured()){$('#app').innerHTML='<div class="panel"><h2>Підключення до бази ще не налаштовано</h2><p>Заповни <code>config.js</code> трьома публічними значеннями з Clerk і Supabase. Далі виконай SQL із папки <code>supabase</code>. Усе описано в README.</p><p><b>Жодних реальних акаунтів чи даних поки немає.</b></p></div>';status('● ПОТРІБНЕ НАЛАШТУВАННЯ');return;}
 try{
  ctx=await connect();
  if(!ctx.clerk.user){
   status('● ПОТРІБЕН ВХІД');$('#auth').innerHTML='<div class="login-card"><h2>Вхід у Tower Defense Academy</h2><p>Увійди за логіном і паролем, створеними викладачем.</p><div id="sign-in"></div></div>';
   ctx.clerk.mountSignIn($('#sign-in'));return;
  }
  profile=await getProfile(ctx.db,myId(ctx.clerk));if(!profile){renderMissing();return;}
  await fetchData();listen();
 }catch(e){console.error(e);status('● ПОМИЛКА');$('#app').innerHTML=`<div class="status-error">Помилка підключення: ${esc(e.message)}\nПеревір README, Third-Party Auth та RLS.</div>`;}
}
boot();
