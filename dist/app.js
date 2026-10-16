import { STEPS, FIELDS, EXAMPLES } from './questions.js';
import { buildPrompt, countCharacters } from './prompt-builder.js?v=20261016-safety-1';

const STORAGE_KEY = 'our-neighborhood-player-lab:v1';
const byId = id => document.getElementById(id);
const blank = () => Object.fromEntries(FIELDS.map(f => [f.key, '']));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filled = value => typeof value === 'string' && value.trim().length > 0;
const shorten = (text, limit=100) => Array.from(text || '').length > limit ? Array.from(text).slice(0,limit).join('') + '…' : text;
let state = {version:1, answers:blank(), step:0, view:'home', details:{}};
let prompt = '';
let saveTimer;
let toastTimer;
let copyResetTimer;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved?.version === 1 && saved.answers && typeof saved.answers === 'object') {
    for (const f of FIELDS) if (typeof saved.answers[f.key] === 'string') state.answers[f.key] = saved.answers[f.key];
    state.step = Number.isInteger(saved.step) ? Math.min(7,Math.max(0,saved.step)) : 0;
    state.view = ['home','mission','result'].includes(saved.view) ? saved.view : 'mission';
    state.details = saved.details && typeof saved.details === 'object' ? saved.details : {};
  }
} catch {}

function toast(message) {
  clearTimeout(toastTimer);
  byId('toast').textContent = message;
  byId('toast').hidden = false;
  toastTimer = setTimeout(()=>{byId('toast').hidden=true;},4500);
}
function save() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY,JSON.stringify({...state,savedAt:new Date().toISOString()}));
  } catch {}
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,300);}
function stepFilled(step){return STEPS[step].fields.filter(f=>filled(state.answers[f.key])).length;}
function missingRequired(){return FIELDS.filter(f=>f.required&&!filled(state.answers[f.key]));}

function updateNav() {
  byId('stepNav').innerHTML=STEPS.map((s,i)=>{
    const done=s.fields.filter(f=>!f.deep).every(f=>filled(state.answers[f.key]));
    return `<button class="step-button${state.step===i?' active':''}${done?' done':''}" data-step="${i}" ${state.step===i?'aria-current="step"':''}><span class="step-number">${String(i+1).padStart(2,'0')}</span><span>${escape(s.name)}</span>${done?'<span class="step-check" aria-label="기본 질문 작성 완료">✓</span>':''}</button>`;
  }).join('');
  byId('stepFraction').textContent=`${state.step+1} / 8`;
  const answered=FIELDS.filter(f=>filled(state.answers[f.key])).length;
  byId('progressBar').style.width=`${answered/FIELDS.length*100}%`;
  byId('answerCount').textContent=`${answered} / ${FIELDS.length}`;
  if(innerWidth<641){const nav=byId('stepNav');const active=nav.querySelector('.active');if(active)nav.scrollLeft=Math.max(0,active.offsetLeft-18);}
}
function updateBoard(){
  byId('boardTitle').textContent=state.answers.gameTitle.trim()||'아직 이름 없는\n우리의 게임';
  byId('boardTeam').textContent=`만든 사람 · ${state.answers.teamName.trim()||'우리 팀'}`;
  byId('boardPlace').textContent=state.answers.place.trim()||'어디서 시작할까요?';
  byId('boardHero').textContent=state.answers.heroName.trim()||'어떤 친구가 등장할까요?';
  byId('boardGoal').textContent=state.answers.goal.trim()||'무엇을 하면 될까요?';
}
function renderField(f, index){
  const value=state.answers[f.key];
  const limit=f.type==='textarea'?800:300;
  const common=`id="field-${f.key}" name="${f.key}" placeholder="${escape(f.placeholder)}" maxlength="${limit}" ${f.required?'aria-required="true"':''}`;
  const input=f.type==='textarea'?`<textarea ${common} rows="2">${escape(value)}</textarea>`:`<input ${common} type="text" value="${escape(value)}" autocomplete="off">`;
  return `<div class="field" data-field="${f.key}"><label class="field-label" for="field-${f.key}"><span class="field-order">${String(index+1).padStart(2,'0')}</span>${escape(f.label)}${f.required?'<span class="required">꼭 정해요</span>':''}</label>${input}${f.options.length?`<div class="chips" role="group" aria-label="${escape(f.label)} 예시">${f.options.map(o=>`<button class="chip${(f.multi?value.split(',').map(x=>x.trim()).includes(o):value===o)?' selected':''}" type="button" data-key="${f.key}" data-option="${escape(o)}" aria-pressed="${f.multi?value.split(',').map(x=>x.trim()).includes(o):value===o}">${escape(o)}</button>`).join('')}</div>`:''}</div>`;
}
function renderMission(){
  const step=STEPS[state.step];
  byId('missionContent').innerHTML=`<div class="mission-head"><div class="mission-kicker"><span class="mission-symbol" aria-hidden="true">${step.icon}</span>MISSION ${String(state.step+1).padStart(2,'0')} · ${escape(step.name)}</div><h3 id="missionTitle" tabindex="-1">${escape(step.title)}</h3><p>${escape(step.description)}</p></div><div class="field-grid${state.step===0?' first-grid':''}">${step.fields.filter(f=>!f.deep).map(f=>renderField(f,step.fields.indexOf(f))).join('')}</div><details class="more-details" ${state.details[state.step]?'open':''}><summary>더 상상하기 <small>작은 디테일을 더해요</small></summary><div class="field-grid">${step.fields.filter(f=>f.deep).map(f=>renderField(f,step.fields.indexOf(f))).join('')}</div></details><div class="mission-tip"><span aria-hidden="true">✦</span><p>${escape(step.tip)}</p></div>`;
  byId('missionPosition').textContent=`${String(state.step+1).padStart(2,'0')} / 08`;
  byId('prevButton').disabled=state.step===0;
  byId('nextButton').textContent=state.step===7?'제작 프롬프트 완성 ↗':'다음 미션 →';
  byId('formError').hidden=true;
  const details=byId('missionContent').querySelector('details');
  details.addEventListener('toggle',()=>{state.details[state.step]=details.open;scheduleSave();});
  updateNav();updateBoard();
  document.title=`미션 ${state.step+1} · ${step.name} | 우리 동네 플레이어`;
}
function setView(){
  byId('hero').hidden=state.view!=='home';
  byId('workspace').hidden=state.view==='result';
  byId('resultSection').hidden=state.view!=='result';
}
function locationHash(){return state.view==='result'?'#result':state.view==='home'?'#home':`#mission-${state.step+1}`;}
function pushLocation(){history.pushState(null,'',locationHash());}
function scrollTo(target){requestAnimationFrame(()=>{byId(target).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});}
function gotoStep(index,focus=true,push=true){
  state.step=Math.min(7,Math.max(0,index));state.view='mission';
  renderMission();setView();save();if(push)pushLocation();
  if(focus){scrollTo('workspace');byId('missionTitle').focus({preventScroll:true});}
}
function updateInput(key,value){
  state.answers[key]=value;
  const f=FIELDS.find(x=>x.key===key);
  document.querySelectorAll(`.chip[data-key="${key}"]`).forEach(btn=>{const on=f.multi?value.split(',').map(x=>x.trim()).includes(btn.dataset.option):value===btn.dataset.option;btn.classList.toggle('selected',on);btn.setAttribute('aria-pressed',String(on));});
  updateNav();updateBoard();scheduleSave();
}
function summary(){
  const keys=[['place','moment'],['worldLook','opening'],['heroName','item'],['goal','controls'],['win','lose'],['hud','resultScreen'],['artStyle','colors'],['priority','shareText']];
  byId('summaryList').innerHTML=STEPS.map((s,i)=>`<div class="summary-group"><h4>${String(i+1).padStart(2,'0')} · ${escape(s.name)} <span>(${stepFilled(i)}/${s.fields.length})</span></h4><button data-edit-step="${i}" aria-label="${escape(s.name)} 미션 수정">수정</button>${keys[i].map(k=>`<p>${escape(shorten(state.answers[k].trim()||'아직 정하지 않았어요.',110))}</p>`).join('')}</div>`).join('');
  const missing=missingRequired();
  const notes=[];
  if(missing.length){notes.push(`<div class="review-note warning"><strong>이 ${missing.length}가지를 정하면 복사할 수 있어요.</strong><ul>${missing.map(f=>`<li><button data-edit-step="${STEPS.findIndex(s=>s.fields.some(x=>x.key===f.key))}" data-focus-key="${f.key}">${escape(f.label)}</button></li>`).join('')}</ul></div>`);}
  const optional=FIELDS.filter(f=>!filled(state.answers[f.key])).length;
  if(optional)notes.push(`<div class="review-note">아직 비어 있는 ${optional}개 항목은 제작 설명에 <strong>제안 기본값</strong>으로 표시돼요. 우리 팀이 결정한 내용과 함께 확인해 주세요.</div>`);
  if(state.answers.lose.includes('실패 없이')&&/하트|0이|세 번|3번/.test(state.answers.rule)) notes.push('<div class="review-note warning">실패 없이 놀기와 게임이 끝나는 규칙이 함께 있어요. 실수했을 때 무엇이 달라지는지 멘토와 확인해 주세요.</div>');
  if(/대전|멀티플레이|로그인|온라인.*함께/.test([state.answers.rule,state.answers.goal,state.answers.mainAction].join(' '))) notes.push('<div class="review-note warning">여러 사람이 함께 접속하는 아이디어는 다음 버전으로 남겨 두고, 이번에는 한 사람이 하는 작은 게임부터 멘토와 정해 봐요.</div>');
  notes.push('<div class="review-note">목표 개수와 등장 물건 수, 성공과 시간 종료가 동시에 생기는 순간을 함께 확인해요. 게임 제작과 실제 테스트는 다음 단계에서 진행해요.</div>');
  byId('reviewNotes').innerHTML=notes.join('');
}
function showResult(push=true){
  state.view='result';prompt=buildPrompt(state.answers);
  byId('promptOutput').textContent=prompt;
  const count=countCharacters(prompt);
  const safety=globalThis.WorkshopPromptSafety.review(Object.values(state.answers).join('\n'));
  byId('charCount').textContent=`${count.toLocaleString('ko-KR')}자`;
  const ready=!safety.blocked&&missingRequired().length===0&&count>=5000;
  document.querySelector('.prompt-note').textContent=safety.blocked?'아동·청소년 안전 기준에 맞지 않는 표현이 있어 제작 프롬프트를 보류했어요. 피·잔혹성·성인표현 등을 뺀 안전한 아이디어로 바꾼 뒤 다시 완성해 주세요. 원래 답변은 입력과 아이디어 파일에 남아 있어요.':ready?'모든 제작 프롬프트에 아동·청소년 윤리·안전 지침이 포함돼요. 비워 둔 항목은 ‘제안 기본값’으로 표시돼요. 제작 전에 무드보드와 답변을 멘토와 함께 확인해 주세요.':`꼭 정할 질문 ${missingRequired().length}개가 남았어요. 아이디어 요약의 질문을 눌러 채우면 전체 프롬프트를 복사할 수 있어요.`;
  byId('copyButton').disabled=!ready;byId('downloadButton').disabled=!ready;
  clearTimeout(copyResetTimer);
  byId('copyButton').textContent=safety.blocked?'안전 수정 필요':'전체 프롬프트 복사 ↗';
  byId('copyButton').title=safety.blocked?'안전 기준에 맞게 답변을 바꿔 주세요':ready?'전체 프롬프트를 복사합니다':'꼭 정할 질문을 먼저 채워 주세요';
  byId('downloadButton').title=byId('copyButton').title;
  summary();setView();save();if(push)pushLocation();
  document.title='완성된 제작 프롬프트 | 우리 동네 플레이어';scrollTo('resultSection');
}
function fileName(suffix){return (state.answers.gameTitle.trim()||'우리동네게임').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,80)+suffix;}
function download(text,name,type='text/plain;charset=utf-8'){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function copyPrompt(){
  if(byId('copyButton').disabled)return;
  let copied=false;
  try{await navigator.clipboard.writeText(prompt);copied=true;}catch{
    const helper=document.createElement('textarea');helper.value=prompt;helper.setAttribute('readonly','');helper.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(helper);helper.select();try{copied=document.execCommand('copy');}catch{}helper.remove();
  }
  if(copied){toast('전체 프롬프트를 복사했어요. 멘토와 함께 AI에 붙여 넣어 주세요.');byId('copyButton').textContent='복사했어요 ✓';clearTimeout(copyResetTimer);copyResetTimer=setTimeout(()=>{byId('copyButton').textContent='전체 프롬프트 복사 ↗';},2200);}
  else{const range=document.createRange();range.selectNodeContents(byId('promptOutput'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);toast('자동 복사가 어려워요. 선택된 글을 직접 복사하거나 TXT로 저장해 주세요.');}
}
function addExampleDialog(){
  const dialog=document.createElement('dialog');dialog.id='exampleDialog';dialog.innerHTML=`<div class="dialog-top"><span class="mini-label">SMALL MOMENT, BIG IDEA</span><button class="close-dialog" aria-label="예시 닫기">×</button></div><h2>평범한 하루가<br>이런 게임이 될 수 있어요.</h2><div class="example-options">${EXAMPLES.map((e,i)=>`<button class="example-option" data-example="${i}"><span aria-hidden="true">${e.emoji}</span><div><strong>${escape(e.name)}</strong><small>${escape(e.subtitle)}</small></div></button>`).join('')}</div><p class="dialog-tip">예시를 누르면 8개 미션에 예시 답변이 채워져요. 우리 팀의 이야기로 바꿔 보세요.</p>`;document.body.append(dialog);
  dialog.addEventListener('click',e=>{const example=e.target.closest('[data-example]');if(!example)return;if(FIELDS.some(f=>filled(state.answers[f.key]))&&!confirm('예시를 불러오면 지금 답변이 예시로 바뀌어요. 필요한 아이디어는 파일로 저장했나요?'))return;state.answers={...blank(),...EXAMPLES[Number(example.dataset.example)].answers};state.details={};dialog.close();gotoStep(0);toast('예시를 불러왔어요. 우리 팀의 이야기로 바꿔 보세요.');});
}

byId('missionContent').addEventListener('input',e=>{if(e.target.name&&FIELDS.some(f=>f.key===e.target.name))updateInput(e.target.name,e.target.value);});
byId('missionContent').addEventListener('click',e=>{const chip=e.target.closest('[data-option]');if(!chip)return;const f=FIELDS.find(x=>x.key===chip.dataset.key);const input=byId(`field-${f.key}`);let value=chip.dataset.option;if(f.multi){const existing=input.value.split(',').map(x=>x.trim()).filter(Boolean);value=existing.includes(value)?existing.filter(x=>x!==value).join(', '):[...existing,value].join(', ');}input.value=value;updateInput(f.key,value);input.focus({preventScroll:true});});
byId('stepNav').addEventListener('click',e=>{const button=e.target.closest('[data-step]');if(button)gotoStep(Number(button.dataset.step));});
byId('prevButton').addEventListener('click',()=>gotoStep(state.step-1));
byId('nextButton').addEventListener('click',()=>state.step===7?showResult():gotoStep(state.step+1));
byId('beginButton').addEventListener('click',()=>gotoStep(state.step));
byId('homeLink').addEventListener('click',e=>{e.preventDefault();state.view='home';renderMission();setView();save();pushLocation();scrollTo('hero');});
byId('resultShortcut').addEventListener('click',()=>showResult());
byId('backToEdit').addEventListener('click',()=>gotoStep(state.step));
byId('summaryList').addEventListener('click',e=>{const button=e.target.closest('[data-edit-step]');if(button)gotoStep(Number(button.dataset.editStep));});
byId('reviewNotes').addEventListener('click',e=>{const button=e.target.closest('[data-edit-step]');if(!button)return;gotoStep(Number(button.dataset.editStep));if(button.dataset.focusKey)byId(`field-${button.dataset.focusKey}`).focus({preventScroll:true});});
byId('copyButton').addEventListener('click',copyPrompt);
byId('downloadButton').addEventListener('click',()=>{if(!byId('downloadButton').disabled){download(prompt,fileName('_제작프롬프트.txt'));toast('제작 프롬프트 TXT 파일을 저장했어요.');}});
byId('briefButton').addEventListener('click',()=>{const text=['우리 동네 플레이어 | 우리 팀 아이디어',`팀: ${state.answers.teamName||'아직 정하지 않음'}`,`게임: ${state.answers.gameTitle||'아직 정하지 않음'}`,...STEPS.flatMap((s,i)=>[`\n${i+1}. ${s.name}`,...s.fields.map(f=>`${f.label}\n${state.answers[f.key].trim()||'(아직 정하지 않았어요)'}\n`)])].join('\n');download(text,fileName('_아이디어요약.txt'));toast('우리 팀의 답변만 모은 요약을 저장했어요.');});
byId('exportButton').addEventListener('click',()=>{save();download(JSON.stringify({format:'neighborhood-player-idea',version:1,exportedAt:new Date().toISOString(),answers:state.answers,step:state.step,details:state.details},null,2),fileName('_아이디어.json'),'application/json;charset=utf-8');toast('아이디어 파일을 저장했어요. 다른 기기에서도 열 수 있어요.');});
byId('importButton').addEventListener('click',()=>byId('importFile').click());
byId('importFile').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>1024*1024)throw new Error('파일이 너무 커요. 이 앱에서 저장한 1MB 이하 아이디어 파일을 골라 주세요.');
    const imported=JSON.parse(await file.text());
    if(imported.format!=='neighborhood-player-idea'||imported.version!==1||!imported.answers||typeof imported.answers!=='object'||Array.isArray(imported.answers))throw new Error('이 앱에서 저장한 아이디어 JSON 파일을 골라 주세요.');
    const valid=FIELDS.every(f=>imported.answers[f.key]===undefined||typeof imported.answers[f.key]==='string');if(!valid)throw new Error('답변 형식이 올바르지 않아요. 다른 아이디어 파일을 골라 주세요.');
    if(FIELDS.some(f=>filled(state.answers[f.key]))&&!confirm('지금 답변을 저장한 파일의 아이디어로 바꿀까요?'))return;
    state.answers=blank();for(const f of FIELDS)if(typeof imported.answers[f.key]==='string')state.answers[f.key]=imported.answers[f.key];
    state.details=imported.details&&typeof imported.details==='object'?imported.details:{};
    gotoStep(Number.isInteger(imported.step)?imported.step:0);toast('저장한 아이디어를 열었어요. 이어서 상상해 봐요.');
  }catch(error){toast(error instanceof SyntaxError?'파일을 읽지 못했어요. 이 앱에서 저장한 JSON 파일인지 확인해 주세요.':error.message);}finally{e.target.value='';}
});
byId('resetButton').addEventListener('click',()=>{if(!confirm('새 아이디어를 시작하면 현재 답변이 지워져요. 필요한 아이디어는 파일로 저장했나요?'))return;state={version:1,answers:blank(),step:0,view:'mission',details:{}};gotoStep(0);toast('새로운 상상을 시작해요!');});
addExampleDialog();
byId('exampleButton').addEventListener('click',()=>byId('exampleDialog').showModal());
document.addEventListener('click',e=>{const opener=e.target.closest('[data-dialog]');if(opener)byId(opener.dataset.dialog).showModal();const closer=e.target.closest('.close-dialog');if(closer)closer.closest('dialog').close();});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
window.addEventListener('popstate',()=>{const match=location.hash.match(/^#mission-([1-8])$/);if(match)gotoStep(Number(match[1])-1,true,false);else if(location.hash==='#result')showResult(false);else{state.view='home';renderMission();setView();save();scrollTo('hero');}});
window.addEventListener('pagehide',save);
const initial=location.hash.match(/^#mission-([1-8])$/);
if(initial){state.step=Number(initial[1])-1;state.view='mission';}else if(location.hash==='#result')state.view='result';else if(location.hash==='#home')state.view='home';
renderMission();setView();if(state.view==='result')showResult(false);
