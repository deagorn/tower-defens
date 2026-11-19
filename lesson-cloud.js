import {connect,configured,getProfile,myId,queryError} from './cloud.js';
const LESSON='base-health-demo';
const get=s=>document.querySelector(s);
const msg=s=>{const el=get('#toast');if(el){el.textContent=s;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4500)}};
const block=s=>{get('#nextButton').disabled=true;get('#prevButton').disabled=true;msg(s)};
if(!configured()){
 block('Налаштуй config.js перед роботою з онлайн-прогресом');
}else{
 try{
  const {clerk,db}=await connect();
  if(!clerk.user){location.replace('index.html');}
  else{
   const profile=await getProfile(db,myId(clerk));
   if(!profile||profile.role!=='student'){location.replace('index.html');}
   else{
    let queue=Promise.resolve();
    const {data,error}=await db.from('lesson_progress').select('current_step,completed_steps').eq('student_id',profile.clerk_id).eq('lesson_id',LESSON).maybeSingle();queryError(error);
    window.TDA_LESSON_SAVE=s=>{
      // Черга важлива: кілька швидких натискань «Далі» не повинні перезаписати нові дані старими.
      queue=queue.catch(()=>{}).then(async()=>{
       const {error}=await db.from('lesson_progress').upsert({student_id:profile.clerk_id,lesson_id:LESSON,current_step:s.step,completed_steps:s.completed},{onConflict:'student_id,lesson_id'});
       queryError(error);
      }).catch(e=>msg('Не вдалося зберегти онлайн. Перевір інтернет: '+e.message));
    };
    window.TDA_LESSON_LOAD?.({step:data?.current_step??0,completed:data?.completed_steps??[]});
   }
  }
 }catch(e){console.error(e);block('Помилка онлайн-підключення: '+e.message)}
}
