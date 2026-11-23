/* Tower Defense Academy — навігація по кроках редактора (доповнення без змін editor.js).
   Показує один крок за раз, список зліва, використовує існуючий select #lessonNumber. */
(() => {
  'use strict';
  const css = `
    /* TDA редактор: зберігаємо оригінальний механізм вибору уроку через #lessonNumber */
    #lessonSlots { display:none !important; }
    .rail .tda-step-navigation { min-width:0; display:flex; flex-direction:column; gap:9px; }
    .tda-step-navigation .tda-nav-heading {display:flex;align-items:center;justify-content:space-between;gap:8px;color:#b8a4ff;font-size:11px;letter-spacing:1.2px;font-weight:900;}
    .tda-step-navigation .tda-nav-counter {color:#9aa9d0;border:1px solid #394663;padding:3px 7px;border-radius:8px;letter-spacing:0;font-weight:700;}
    .tda-step-navigation .tda-step-list {display:flex;flex-direction:column;gap:6px;max-height: min(65vh,720px);overflow-y:auto;padding:3px 3px 8px 1px;scrollbar-width:thin;scrollbar-color:#5a507d transparent;}
    .tda-step-navigation .tda-step-choice {display:flex;align-items:flex-start;text-align:left;gap:10px;width:100%;min-width:0;border:1px solid transparent;background:transparent;border-radius:10px;color:#b4c1df;padding:11px 10px;font-size:12px;font-weight:700;line-height:1.45;cursor:pointer;}
    .tda-step-navigation .tda-step-choice:hover {background:#1e2945;border-color:#405273;color:#fff;}
    .tda-step-navigation .tda-step-choice.is-active {background:linear-gradient(115deg,#3a3269,#242950);border-color:#9276ea;color:#fff;box-shadow:inset 3px 0 #a98bff;}
    .tda-step-navigation .tda-step-choice:focus-visible {outline:2px solid #ab91ff;outline-offset:2px;}
    .tda-step-navigation .tda-step-index {display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;height:24px;border:1px solid #505b7d;border-radius:7px;font-size:11px;color:#bdb4f0;}
    .tda-step-navigation .tda-step-choice.is-active .tda-step-index {background:#7659cc;color:#fff;border-color:#b198ff;}
    .tda-step-navigation .tda-step-name {min-width:0;overflow-wrap:anywhere;}
    .tda-step-navigation .tda-nav-add {width:100%;padding:11px 12px;border:1px dashed #7567bc;border-radius:10px;color:#dbcaff;background:#1c2140;font-size:12px;font-weight:800;cursor:pointer;}
    .tda-step-navigation .tda-nav-add:hover {background:#2e2a54;}
    .tda-step-navigation .tda-empty-steps {color:#91a4cb;line-height:1.6;font-size:12px;padding:10px;}
    #stepsEditor .step-card:not(.tda-step-active) {display:none!important;}
    #stepsEditor .step-card.tda-step-active {display:block;}
    .tda-step-pager {display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:9px 0 16px;}
    .tda-step-pager button {border:1px solid #555d86;background:#262c4a;color:#e9e4ff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:800;}
    .tda-step-pager button:disabled {opacity:.35;cursor:not-allowed;}
    .tda-step-pager strong {font-size:13px;color:#c6b6ff;}
    #stepsEditor .step-card {margin:0;}
    @media(max-width:900px) {
      .rail .tda-step-navigation .tda-step-list {max-height:245px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));}
      .tda-step-navigation .tda-step-choice {padding:9px;}
    }
    @media(max-width:530px) {.rail .tda-step-navigation .tda-step-list{display:flex;max-height:220px;}}
  `;
  const style = document.createElement('style');
  style.id='tda-editor-navigation-styles'; style.textContent=css;
  document.head.appendChild(style);

  let current=0, lastLesson=null, pending=null;
  let navList=null, navCounter=null, pager=null;
  const qs = s => document.querySelector(s);
  const all = s => [...document.querySelectorAll(s)];

  function install() {
    const rail=qs('.rail'), slots=qs('#lessonSlots'), editor=qs('#stepsEditor');
    if (!rail || !slots || !editor) return false;
    const wrap=document.createElement('section'); wrap.className='tda-step-navigation';
    wrap.setAttribute('aria-label','Навігація між кроками уроку');
    const heading=document.createElement('div'); heading.className='tda-nav-heading';
    heading.innerHTML='<span>КРОКИ УРОКУ</span><span class="tda-nav-counter" aria-live="polite">0</span>';
    navCounter=heading.querySelector('.tda-nav-counter');
    navList=document.createElement('div'); navList.className='tda-step-list';
    navList.setAttribute('role','group');
    const add=document.createElement('button');add.type='button';add.className='tda-nav-add';add.textContent='+ Додати крок';
    add.addEventListener('click',()=>qs('#addStep')?.click());
    wrap.append(heading,navList,add);
    slots.insertAdjacentElement('afterend',wrap);
    // Кнопки пагінації розташовані перед редактором, а не всередині #stepsEditor.
    pager=document.createElement('div');pager.className='tda-step-pager';
    editor.before(pager);
    navList.addEventListener('click', e=>{
      const item=e.target.closest('[data-tda-step]');
      if(item) selectStep(Number(item.dataset.tdaStep),true);
    });
    const observer=new MutationObserver(()=>refresh());
    // Реагуємо на повторне створення кроків у editor.js, не на кожне введення літери.
    observer.observe(editor,{childList:true});
    document.addEventListener('click',onExistingAction,true);
    qs('#lessonNumber')?.addEventListener('change',()=>{pending=0;},true);
    refresh();
    return true;
  }

  function selectStep(index,scroll=false) {
    const steps=all('#stepsEditor > .step-card');
    if(!steps.length) {current=0;refresh();return;}
    current=Math.max(0,Math.min(index,steps.length-1));
    steps.forEach((node,i)=>node.classList.toggle('tda-step-active',i===current));
    all('.tda-step-choice').forEach((node,i)=>{
      const selected=i===current;
      node.classList.toggle('is-active',selected);
      node.setAttribute('aria-current',selected?'step':'false');
    });
    updatePager(steps.length);
    if(scroll) {
      const target=qs('.tda-step-pager') || steps[current];
      target?.scrollIntoView({block:'start',behavior:'smooth'});
    }
  }

  function updatePager(count) {
    if(!pager) return;
    pager.replaceChildren();
    if(!count) return;
    const prev=document.createElement('button');prev.type='button';prev.textContent='← Попередній крок';prev.disabled=current===0;
    prev.addEventListener('click',()=>selectStep(current-1,true));
    const title=document.createElement('strong');title.textContent=`Крок ${current+1} із ${count}`;
    const next=document.createElement('button');next.type='button';next.textContent='Наступний крок →';next.disabled=current===count-1;
    next.addEventListener('click',()=>selectStep(current+1,true));
    pager.append(prev,title,next);
  }

  function refresh() {
    if(!navList) return;
    const lesson=qs('#lessonNumber')?.value||'1';
    if(lastLesson!==lesson){current=0;lastLesson=lesson;}
    const steps=all('#stepsEditor > .step-card');
    if(pending!==null){current=pending;pending=null;}
    if(steps.length)current=Math.max(0,Math.min(current,steps.length-1));else current=0;
    navCounter.textContent=String(steps.length);
    navList.replaceChildren();
    if(!steps.length){
      const empty=document.createElement('div');empty.className='tda-empty-steps';empty.textContent='У цьому уроці поки немає кроків.';
      navList.append(empty);
    }
    steps.forEach((node,i)=>{
      const input=node.querySelector('[data-step-title]');
      const name=input?.value.trim()||`Крок ${i+1}`;
      const choice=document.createElement('button');choice.type='button';choice.className='tda-step-choice';choice.dataset.tdaStep=i;
      const number=document.createElement('span');number.className='tda-step-index';number.textContent=String(i+1);
      const label=document.createElement('span');label.className='tda-step-name';label.textContent=name;
      choice.append(number,label);
      navList.append(choice);
      // Заголовок навігації оновлюється під час введення без перерендеру всіх кроків.
      input?.addEventListener('input',()=>{label.textContent=input.value.trim()||`Крок ${i+1}`;});
    });
    selectStep(current);
  }

  function onExistingAction(e) {
    const button=e.target.closest('button');
    if(!button) return;
    // Оригінальний редактор сам обробляє операції. Ми лише запам'ятовуємо наступний обраний крок.
    if(button.id==='addStep') {pending=all('#stepsEditor > .step-card').length;return;}
    const idx=el=>Number(button.getAttribute(el));
    if(button.hasAttribute('data-step-copy')){pending=idx('data-step-copy')+1;return;}
    if(button.hasAttribute('data-step-up')){pending=Math.max(0,idx('data-step-up')-1);return;}
    if(button.hasAttribute('data-step-down')){pending=idx('data-step-down')+1;return;}
    if(button.hasAttribute('data-step-del')) {pending=Math.max(0,idx('data-step-del')-1);return;}
    if(button.hasAttribute('data-block-copy')||button.hasAttribute('data-block-del')||button.hasAttribute('data-block-up')||button.hasAttribute('data-block-down')||button.hasAttribute('data-add-block'))pending=current;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
