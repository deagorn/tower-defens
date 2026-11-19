// Єдиний модуль підключення. Ніколи не розміщуй тут service_role або sk_ ключі.
let apiPromise;
export const configured=()=>{
  const c=window.TDA_CONFIG||{};
  return /^pk_(test|live)_/.test(c.clerkPublishableKey||'') && !c.clerkPublishableKey.includes('REPLACE') &&
   /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.supabaseUrl||'') &&
   /^(sb_publishable_|eyJ)/.test(c.supabasePublishableKey||'') && !c.supabasePublishableKey.includes('REPLACE');
};
export function connect(){
  if(!apiPromise)apiPromise=(async()=>{
    if(!configured())throw new Error('Спочатку заповни config.js');
    const [{Clerk},{createClient}]=await Promise.all([
      import('https://esm.sh/@clerk/clerk-js@6'),
      import('https://esm.sh/@supabase/supabase-js@2')
    ]);
    const cfg=window.TDA_CONFIG;
    const clerkDomain=atob(cfg.clerkPublishableKey.split('_')[2] || '').slice(0,-1);
    if(!/^[a-zA-Z0-9.-]+$/.test(clerkDomain))throw new Error('Некоректний Clerk publishable key');
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=`https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
      script.crossOrigin='anonymous';script.onload=resolve;script.onerror=()=>reject(new Error('Не вдалося завантажити інтерфейс Clerk'));
      document.head.append(script);
    });
    const clerk=new Clerk(cfg.clerkPublishableKey);
    await clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor}});
    const db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
      accessToken:async()=>clerk.session?.getToken()??null,
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return {clerk,db};
  })().catch(e=>{apiPromise=null;throw e});
  return apiPromise;
}
export const myId=clerk=>clerk.user?.id||null;
export const queryError=e=>{if(e)throw new Error(e.message||'Помилка запиту');};
export const getProfile=async(db,id)=>{
  const {data,error}=await db.from('profiles').select('clerk_id,nickname,username,role,group_id').eq('clerk_id',id).maybeSingle();queryError(error);return data;
};
