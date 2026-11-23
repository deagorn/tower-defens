// Tower Defense Academy · демонстраційний урок
// Прогрес зберігається у Supabase через авторизований Clerk акаунт.

const STORAGE_KEY = 'tda_base_health_demo_v1';
const baseHealthCode = `local Workspace = game:GetService("Workspace")
local ServerScriptService = game:GetService("ServerScriptService")
local base = Workspace:WaitForChild("Grass"):WaitForChild("Base")
local damageEvent = game.ReplicatedStorage:WaitForChild("DamageBase")
local MAX_HEALTH = 1000
local health = MAX_HEALTH
local gui = base:WaitForChild("BillboardGui")
local background = gui:WaitForChild("Background")
local healthText = background:WaitForChild("HealthText")
local healthBar = background.BarBackground.HealthBar

base:SetAttribute("MaxHealth", MAX_HEALTH)
base:SetAttribute("Health", health)

local function updateHealth()
    local percent = math.clamp(health / MAX_HEALTH, 0, 1)
    healthText.Text = health .. " / " .. MAX_HEALTH
    healthBar.Size = UDim2.fromScale(percent, 1)
    healthBar.BackgroundColor3 =
        percent > 0.6 and Color3.fromRGB(50, 220, 80)
        or percent > 0.3 and Color3.fromRGB(255, 190, 40)
        or Color3.fromRGB(230, 50, 50)
end

damageEvent.Event:Connect(function(damage)
    if health <= 0 then return end
    health = math.max(0, health - damage)
    base:SetAttribute("Health", health)

    updateHealth()

    if health == 0 then
        print("BASE DESTROYED!")
    end
end)

updateHealth()`;
const moveNewCode = `local damageEvent = game.ReplicatedStorage:WaitForChild("DamageBase")
local damage = enemy:GetAttribute("BaseDamage") or 10
damageEvent:Fire(damage)`;
const moveContext = `    for i = 1, count do
        local waypoint = waypointsFolder:FindFirstChild(i)

        if waypoint then
            humanoid:MoveTo(waypoint.Position)
            humanoid.MoveToFinished:Wait()
        end
    end

${moveNewCode}

    enemy:Destroy()
end

return MoveEnemy`;
const lessons = [
 {id:'base',title:'Створюємо Base',category:'ПІДГОТОВКА',lead:'Перш ніж додавати здоров’я, перевіримо, що Roblox Studio зможе знайти модель бази за потрібним шляхом.',where:'Workspace → Grass → Base',items:['Відкрий вкладку <b>View → Explorer</b>.','У <b>Workspace</b> знайди <b>Grass</b>.','Знайди або створи всередині модель або Part із точною назвою <code>Base</code>.','Переконайся, що назва написана саме <code>Base</code> (важливі великі й малі літери).'],media:[['base-preview.png','На прикладі видно модель Base та її розташування в Explorer.']],hint:'Якщо у твоєму проєкті база вже існує, <b>не створюй другу</b> — просто перевір її назву і шлях.',result:'В Explorer є Workspace → Grass → Base.'},
 {id:'gui',title:'Інтерфейс здоров’я',category:'EXPLORER',lead:'Створимо об’єкти для тексту та кольорової шкали здоров’я над базою.',where:'Workspace → Grass → Base → BillboardGui',items:['Натисни <b>+</b> біля <code>Base</code> і додай <code>BillboardGui</code>.','Усередині <code>BillboardGui</code> створи <code>Frame</code> та назви його <code>Background</code>.','У <code>Background</code> додай <code>TextLabel</code> із назвою <code>HealthText</code> і <code>Frame</code> із назвою <code>BarBackground</code>.','У <code>BarBackground</code> створи ще один <code>Frame</code> із назвою <code>HealthBar</code>.'],structure:'Base (Part або Model)\n└── BillboardGui\n    └── Background (Frame)\n        ├── HealthText (TextLabel)\n        └── BarBackground (Frame)\n            └── HealthBar (Frame)',media:[['base-structure.png','Початкова структура об’єктів із твоєї інструкції.']],hint:'Назви об’єктів мають точно збігатися зі скриптом, інакше <code>WaitForChild()</code> не знайде елемент.',result:'У Base створені всі п’ять елементів із правильною вкладеністю.'},
 {id:'properties',title:'Налаштовуємо Properties',category:'ВИГЛЯД',lead:'Зробимо індикатор видимим і налаштуємо його зовнішній вигляд.',where:'Base → BillboardGui та його дочірні елементи',items:['Вибери <code>BillboardGui</code> і знайди його параметри у <b>Properties</b>.','Установи значення <code>AlwaysOnTop = true</code>, <code>MaxDistance = 200</code>, <code>LightInfluence = 0</code>.','Для <code>Background</code>, <code>HealthText</code>, <code>BarBackground</code> і <code>HealthBar</code> налаштуй розміри та кольори за скриншотами.','Переконайся, що <code>HealthBar</code> знаходиться всередині <code>BarBackground</code>, а текст — у <code>HealthText</code>.'],properties:[['BillboardGui · AlwaysOnTop','true'],['BillboardGui · MaxDistance','200'],['BillboardGui · LightInfluence','0'],['Background · Size','{1, 0}, {1, 0}'],['Background · BorderSizePixel','0'],['HealthText · Size','{1, 0}, {0.45, 0}'],['HealthBar · Size','{1, 0}, {1, 0}']],media:[['properties.png','Параметри з надісланих скриншотів. Деякі додаткові значення варто уточнити за твоїм проєктом.']],hint:'Частина розмірів і кольорів на початкових скриншотах нерозбірлива. Таблиця вище містить лише значення, які вдалося впевнено прочитати, та стартовий розмір HealthBar.',result:'Елементи інтерфейсу налаштовані, а шкала має початкову повну ширину.'},
 {id:'event',title:'Створюємо DamageBase',category:'ЗВ’ЯЗОК СКРИПТІВ',lead:'Тепер потрібна подія, через яку ворог повідомить скрипту бази, скільки здоров’я забрати.',where:'ReplicatedStorage → DamageBase',items:['Відкрий <b>ReplicatedStorage</b> у Explorer.','Натисни <b>+</b> та створи <code>BindableEvent</code>.','Перейменуй подію точно на <code>DamageBase</code>.','Знайди в <b>ServerScriptService</b> місце для скрипту <code>BaseHealth</code>, який створимо далі.'],media:[['explorer-events.png','Подія DamageBase та скрипт BaseHealth у дереві Roblox Studio.']],hint:'Це саме <b>BindableEvent</b>, а не RemoteEvent. У прикладі використовується <code>:Fire()</code> та <code>.Event:Connect()</code> між серверними скриптами.',result:'У ReplicatedStorage є BindableEvent із назвою DamageBase.'},
 {id:'script',title:'Пишемо BaseHealth',category:'LUA · НОВИЙ СКРИПТ',lead:'Створимо скрипт, який зберігатиме здоров’я бази, змінюватиме текст і кольорову шкалу при отриманні шкоди.',where:'ServerScriptService → BaseHealth',items:['У <b>ServerScriptService</b> створи новий <code>Script</code>.','Назви його <code>BaseHealth</code>.','Видали стандартний рядок <code>print("Hello world!")</code>, якщо він є.','Встав або перепиши код нижче. Після цього перевір назви <code>Base</code>, <code>BillboardGui</code> та <code>DamageBase</code>.'],code:[{label:'ПОВНИЙ СКРИПТ · BaseHealth',content:baseHealthCode}],media:[['basehealth-code.png','Твій оригінальний скриншот скрипту BaseHealth.']],hint:'Функція <code>updateHealth()</code> обчислює частку здоров’я, оновлює текст, розмір і колір смуги. <code>DamageBase</code> запускає обробник шкоди.',result:'Після запуску скрипт створює атрибути MaxHealth та Health і заповнює шкалу.'},
 {id:'move',title:'Доповнюємо MoveEnemy',category:'LUA · ЗМІНИ В КОДІ',lead:'Скрипт руху ворога вже створений на попередніх уроках. Не замінюй його цілком — додай лише нові рядки.',where:'ServerScriptService → EnemySpawner → MoveEnemy',items:['Відкрий <code>EnemySpawner</code>, а всередині нього — <code>MoveEnemy</code> (ModuleScript).','Знайди завершення циклу, де ворог рухається по <code>waypoints</code>.','<b>Після циклу руху, але перед <code>enemy:Destroy()</code></b> встав три нові рядки.','Не видаляй <code>enemy:Destroy()</code> та <code>return MoveEnemy</code>.'],media:[['move-before.png','Скриншот показує частину наявного коду MoveEnemy.']],hint:'У бібліотеці скриптів є фрагмент із контекстом, щоб було легше побачити точне місце вставлення.',result:'Коли ворог дійде до кінця маршруту, подія DamageBase надішле значення шкоди базі.',codeMode:true},
 {id:'test',title:'Перевіряємо результат',category:'ТЕСТУВАННЯ',lead:'Переконаємося, що скрипти пов’язані між собою та здоров’я бази зменшується.',where:'Roblox Studio → Play',items:['Натисни <b>Play</b> у Roblox Studio.','Дочекайся появи ворога та його руху маршрутом.','Коли ворог дійде до бази, подивися на числовий індикатор і кольорову шкалу.','Якщо шкала не змінюється, перевір тип <code>DamageBase</code>, шлях до <code>Base</code> та місце вставлення нового коду.','Якщо виникла помилка, відкрий <b>View → Output</b> та знайди повідомлення про неї.'],media:[['base-preview.png','База у сцені Roblox Studio. Після запуску шкала має відображати здоров’я.']],hint:'Якщо у грі вороги поки що не доходять до бази, спершу перевір їхній рух та роботу хвиль.',result:'Після проходження ворогом маршруту здоров’я бази зменшується, а індикатор змінює розмір і колір.'}
];
function safe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatCode(raw,added=false){let html=safe(raw);html=html.replace(/(&quot;[^\n]*?&quot;)/g,'<span class="string">$1</span>');html=html.replace(/\b(local|function|if|then|return|end|or|and|for|do)\b/g,'<span class="keyword">$1</span>');if(added)html=html.split('\n').map(l=>`<span class="addition">${l||' '}</span>`).join('\n');return html;}
const $=s=>document.querySelector(s);
function restore(){return {step:0,completed:[]}}
let state=restore();let currentTab='changes';let toastTimer;
function save(){if(window.TDA_LESSON_SAVE)window.TDA_LESSON_SAVE({step:state.step,completed:[...state.completed]});else toast('З’єднання з базою ще не готове')}
window.TDA_LESSON_LOAD = function(v){state={step:Math.min(6,Math.max(0,Number(v.step)||0)),completed:Array.isArray(v.completed)?v.completed.filter(x=>typeof x==='string'&&lessons.some(l=>l.id===x)):[]};render();$('#nextButton').disabled=false;$('#prevButton').disabled=state.step===0;};
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600)}
function photoHTML(list){return `<div class="media-grid">${(list||[]).map(([src,desc])=>`<figure class="media"><button type="button" data-image="${safe(src)}" data-caption="${safe(desc)}" aria-label="Збільшити скриншот"><img src="assets/${safe(src)}" alt="${safe(desc)}" loading="lazy"></button><figcaption>↗ ${safe(desc)}</figcaption></figure>`).join('')}</div>`}
function codeHTML(label,content,added=false){return `<div class="code-card"><div class="code-top"><span>⌘ ${safe(label)}</span><button class="copy" data-copy="${safe(content)}">⧉ Копіювати</button></div><pre><code>${formatCode(content,added)}</code></pre></div>`}
function moveHTML(){let body='';if(currentTab==='changes'){body=`<p class="code-intro">Додай тільки ці рядки після завершення циклу руху, перед <code>enemy:Destroy()</code>.</p>${codeHTML('НОВІ РЯДКИ · ДОДАТИ',moveNewCode,true)}`;}else if(currentTab==='context'){body=`<p class="code-intro">Нижче показано <b>лише кінець</b> MoveEnemy: повний скрипт починається вище. Зелені рядки потрібно додати.</p>${codeHTML('ФРАГМЕНТ ІЗ КОНТЕКСТОМ',moveContext)}`;}else{body=`<div class="hint"><span>💡</span><div><b>Як працює доданий код?</b><br><code>WaitForChild("DamageBase")</code> знаходить подію.<br><code>GetAttribute("BaseDamage") or 10</code> бере шкоду ворога або використовує 10.<br><code>Fire(damage)</code> передає шкоду скрипту BaseHealth.</div></div>`;}return `<div class="code-tab-row"><button class="code-tab ${currentTab==='changes'?'active':''}" data-tab="changes">Що додати</button><button class="code-tab ${currentTab==='context'?'active':''}" data-tab="context">Де вставити</button><button class="code-tab ${currentTab==='why'?'active':''}" data-tab="why">Пояснення</button></div>${body}`;}
function render(){const l=lessons[state.step];const count=state.completed.length;const pct=Math.round(count/lessons.length*100);$('#sideCount').textContent=`${count} / ${lessons.length}`;$('#sideProgress').style.width=pct+'%';$('#progressFill').style.width=pct+'%';$('#progressSummary').textContent=`${count} із ${lessons.length} кроків пройдено`;$('#progressPercentage').textContent=pct+'%';$('#stepTag').textContent=`КРОК ${String(state.step+1).padStart(2,'0')} / 07`;$('#stepCategory').textContent=l.category;$('#stepList').innerHTML=lessons.map((s,i)=>`<button class="step-link ${state.step===i?'active':''} ${state.completed.includes(s.id)?'done':''}" data-step="${i}" ${state.step===i?'aria-current="step"':''}><span class="step-number">${state.completed.includes(s.id)?'✓':String(i+1).padStart(2,'0')}</span><b>${safe(s.title)}</b></button>`).join('');let html=`<h2>${safe(l.title)}</h2><p class="step-lead">${l.lead}</p><div class="where"><span>⌁</span><div><b>Де працюємо:</b><br>${safe(l.where)}</div></div><div class="section-label">Що потрібно зробити</div><ol class="instructions">${l.items.map(x=>`<li>${x}</li>`).join('')}</ol>`;if(l.structure)html+=`<div class="section-label">Правильна структура Explorer</div><pre class="structure">${safe(l.structure)}</pre>`;if(l.properties)html+=`<div class="section-label">Властивості</div><table class="property-table"><thead><tr><th>Об'єкт · властивість</th><th>Значення</th></tr></thead><tbody>${l.properties.map(x=>`<tr><td>${safe(x[0])}</td><td>${safe(x[1])}</td></tr>`).join('')}</tbody></table>`;if(l.code)html+=l.code.map(c=>codeHTML(c.label,c.content)).join('');if(l.codeMode)html+=moveHTML();if(l.media?.length)html+=`<div class="section-label">Подивись у Roblox Studio</div>${photoHTML(l.media)}`;if(l.hint)html+=`<div class="hint"><span>💡</span><div><strong>Підказка</strong><br>${l.hint}</div></div>`;if(l.result)html+=`<div class="result"><b>✓ Який має бути результат?</b><br>${safe(l.result)}</div>`;$('#stepContent').innerHTML=html;$('#prevButton').disabled=state.step===0;$('#nextButton').innerHTML=state.step===lessons.length-1?'<span>Завершити урок</span> <span>✓</span>':'<span>Далі</span><span>→</span>';$('#navHint').textContent=state.completed.includes(l.id)?'Цей крок уже пройдено':'Виконуй у Roblox Studio та переходь далі';}
function go(i){state.step=Math.max(0,Math.min(lessons.length-1,i));currentTab='changes';save();render();window.scrollTo({top:0,behavior:'smooth'});closeMenu()}
function closeMenu(){$('#sidebar').classList.remove('open');$('#overlay').classList.remove('visible')}
$('#nextButton').addEventListener('click',()=>{const id=lessons[state.step].id;if(!state.completed.includes(id))state.completed.push(id);if(state.step===lessons.length-1){save();render();toast('Урок пройдено! Ти можеш переглядати всі кроки.');return;}go(state.step+1)});
$('#prevButton').addEventListener('click',()=>go(state.step-1));
$('#stepList').addEventListener('click',e=>{const btn=e.target.closest('[data-step]');if(btn)go(Number(btn.dataset.step))});
$('#menuButton').addEventListener('click',()=>{$('#sidebar').classList.add('open');$('#overlay').classList.add('visible')});$('#overlay').addEventListener('click',closeMenu);
$('#resetProgress').addEventListener('click',()=>{if(confirm('Очистити прогрес демонстраційного уроку в цьому браузері?')){state={step:0,completed:[]};save();render();toast('Демопрогрес очищено')}});
$('#stepContent').addEventListener('click',async e=>{const tab=e.target.closest('[data-tab]');if(tab){currentTab=tab.dataset.tab;render();return;}const copy=e.target.closest('[data-copy]');if(copy){try{await navigator.clipboard.writeText(copy.dataset.copy);toast('Код скопійовано')}catch{const t=document.createElement('textarea');t.value=copy.dataset.copy;document.body.append(t);t.select();document.execCommand('copy');t.remove();toast('Код скопійовано')}return;}const img=e.target.closest('[data-image]');if(img){$('#largeImage').src='assets/'+img.dataset.image;$('#largeCaption').textContent=img.dataset.caption;$('#imageDialog').showModal()}});
$('#closeImage').addEventListener('click',()=>$('#imageDialog').close());
$('#libraryButton').addEventListener('click',()=>{$('#libraryContent').innerHTML=`<div class="library-entry"><h3>BaseHealth</h3><p><b>Розташування:</b> ServerScriptService → BaseHealth</p><p>Повний скрипт, який створюємо на кроці 5.</p><button data-library-go="4">Перейти до кроку 5 →</button></div><div class="library-entry"><h3>MoveEnemy</h3><p><b>Розташування:</b> ServerScriptService → EnemySpawner → MoveEnemy</p><p>На кроці 6 дописуємо лише 3 рядки. Повна початкова версія MoveEnemy з попередніх уроків не надана.</p><button data-library-go="5">Перейти до кроку 6 →</button></div><div class="library-entry"><h3>DamageBase</h3><p><b>Тип:</b> BindableEvent</p><p><b>Розташування:</b> ReplicatedStorage → DamageBase</p><button data-library-go="3">Перейти до кроку 4 →</button></div>`;$('#libraryDialog').showModal()});
$('#libraryContent').addEventListener('click',e=>{const b=e.target.closest('[data-library-go]');if(b){$('#libraryDialog').close();go(+b.dataset.libraryGo)}});
$('#closeLibrary').addEventListener('click',()=>$('#libraryDialog').close());
render();

// Поки профіль не завантажений, навігація заблокована.
$('#nextButton').disabled=true;$('#prevButton').disabled=true;
