const $=(s)=>document.querySelector(s);
const duration=10000,circumference=2*Math.PI*19;
const scrollArea=$('#scrollArea'),hero=$('#hero'),thumbs=$('#thumbnails');
let slides=[],active=0,elapsed=0,lastTime=null,paused=false,held=false,modal=false,previousFocus=null,gesture=null;
let slideAnimations=[],slideAnimationEpoch=0;
const displaySettingsKey='otp-prototype-display-v2',mobileViewport=matchMedia('(max-width:650px), (hover:none) and (pointer:coarse)');
let showDeviceChrome=!mobileViewport.matches;
try{const saved=JSON.parse(localStorage.getItem(displaySettingsKey));if(typeof saved?.showDeviceChrome==='boolean')showDeviceChrome=saved.showDeviceChrome;else{const legacy=JSON.parse(localStorage.getItem('otp-prototype-display-v1'));if(legacy&&Object.values(legacy).some(v=>v===false))showDeviceChrome=false;}}catch{}
function fitDevice(){const availableWidth=document.documentElement.clientWidth||innerWidth;const scale=showDeviceChrome&&!mobileViewport.matches?Math.max(.24,Math.min(1,(availableWidth-32)/417)):1;document.documentElement.style.setProperty('--device-scale',scale);}
function applyDisplaySettings(){for(const key of ['status','frame','home'])document.body.classList.toggle('hide-'+key,!showDeviceChrome);$('#showDeviceChrome').checked=showDeviceChrome;fitDevice();}
$('#showDeviceChrome').addEventListener('change',e=>{showDeviceChrome=e.target.checked;applyDisplaySettings();try{localStorage.setItem(displaySettingsKey,JSON.stringify({showDeviceChrome}));}catch{}});
applyDisplaySettings();
addEventListener('resize',fitDevice);fitDevice();
window.visualViewport?.addEventListener('resize',fitDevice);
function renderSlide(previous,index,direction){
 const epoch=++slideAnimationEpoch;slideAnimations.forEach(a=>a.cancel());slideAnimations=[];
 const elements=[...document.querySelectorAll('.hero-slide')];
 elements.forEach((s,i)=>{s.classList.remove('is-leaving');s.classList.toggle('active',i===index);s.setAttribute('aria-hidden',String(i!==index));s.inert=i!==index;});
 if(previous===index||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const outgoing=elements[previous],incoming=elements[index];outgoing.classList.add('is-leaving');
 const options={duration:560,easing:'cubic-bezier(.22,.61,.36,1)'};
 slideAnimations=[outgoing.animate([{transform:'translateX(0)'},{transform:'translateX('+(-direction*100)+'%)'}],options),incoming.animate([{transform:'translateX('+(direction*100)+'%)'},{transform:'translateX(0)'}],options)];
 Promise.all(slideAnimations.map(a=>a.finished)).then(()=>{if(epoch===slideAnimationEpoch){outgoing.classList.remove('is-leaving');slideAnimations=[];}},()=>{});
}
function selectSlide(index,announce=true){const previous=active,delta=index-active,direction=delta===-1||delta===2?-1:1;active=(index+slides.length)%slides.length;elapsed=0;lastTime=null;renderSlide(previous,active,direction);thumbs.replaceChildren();[(active+2)%3,active,(active+1)%3].forEach(i=>{const button=document.createElement('button');button.className='thumbnail'+(i===active?' active':'');button.dataset.target=i;button.setAttribute('aria-label',slides[i].name);button.setAttribute('aria-current',i===active?'true':'false');const pic=document.createElement('span');pic.className='thumbnail-picture';const image=new Image();image.src=slides[i].thumbnail;image.alt='';image.draggable=false;image.style.objectPosition=i===0?'center 46%':i===1?'center 42%':'center 42%';pic.append(image);button.append(pic);if(i===active){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 40 40');svg.classList.add('thumbnail-ring');svg.setAttribute('aria-hidden','true');const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx','20');circle.setAttribute('cy','20');circle.setAttribute('r','19');circle.style.strokeDasharray=circumference;svg.append(circle);button.append(svg);}button.addEventListener('click',()=>selectSlide(i));thumbs.append(button);});$('#slideNumber').textContent=String(active+1).padStart(2,'0');$('#slideName').textContent=slides[active].name;hero.dataset.activeSlide=active;updateProgress();if(announce)$('#announcement').textContent='Предложение '+(active+1)+' из 3. '+slides[active].name;}
function updateProgress(){const progress=Math.min(1,elapsed/duration),ring=thumbs.querySelector('circle');if(ring)ring.style.strokeDashoffset=circumference*progress;hero.querySelector('.hero-slide.active')?.style.setProperty('--offer-progress',String(progress));hero.dataset.remaining=String(Math.max(0,Math.round(duration-elapsed)));}
function tick(time){if(lastTime!==null&&!paused&&!held&&!modal&&!document.hidden){elapsed+=Math.min(time-lastTime,250);if(elapsed>=duration)selectSlide(active+1,false);else updateProgress();}lastTime=time;requestAnimationFrame(tick);}
$('#pauseButton').addEventListener('click',()=>{paused=!paused;$('#pauseButton').setAttribute('aria-pressed',String(paused));$('#pauseButton').setAttribute('aria-label',paused?'Продолжить автопереключение':'Приостановить автопереключение');$('#pauseLabel').textContent=paused?'Продолжить':'Пауза';$('#pauseIcon').textContent=paused?'▷':'Ⅱ';lastTime=null;});
function restart(){if(modal)closeSheet();scrollArea.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});selectSlide(0);}
$('#restartButton').addEventListener('click',restart);
function setGiftVisibility(visible){$('#gift').hidden=!visible;$('#giftToggleButton').textContent=visible?'Скрыть подарок':'Показать подарок';$('#giftToggleButton').setAttribute('aria-pressed',String(visible));}
$('#giftToggleButton').addEventListener('click',()=>setGiftVisibility($('#gift').hidden));
hero.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;gesture={x:e.clientX,y:e.clientY,id:e.pointerId};held=true;});
hero.addEventListener('pointerup',e=>{if(!gesture)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;held=false;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.3)selectSlide(active+(dx<0?1:-1));gesture=null;lastTime=null;});
hero.addEventListener('pointercancel',()=>{gesture=null;held=false;lastTime=null;});
hero.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){gesture=null;held=false;lastTime=null;}});
document.addEventListener('pointerup',()=>{held=false;});
document.addEventListener('visibilitychange',()=>{lastTime=null;});
function updateChrome(){const scrollTop=scrollArea.scrollTop,stories=$('.offer-navigation');stories.classList.toggle('hidden-on-scroll',scrollTop>24);stories.inert=modal||scrollTop>24;$('#statusBar').classList.toggle('scrolled',scrollTop>360);$('#screen').classList.toggle('content-scrolled',scrollTop>360);$('#screen').style.setProperty('--chrome-opacity',String(Math.max(0,Math.min(1,(scrollTop-280)/160))));}
scrollArea.addEventListener('scroll',updateChrome,{passive:true});updateChrome();
function openSheet(title){previousFocus=document.activeElement;modal=true;$('#sheetTitle').textContent=title;$('#sheetBackdrop').hidden=false;scrollArea.inert=true;$('.bottom-bar').inert=true;$('.offer-navigation').inert=true;$('#gift').inert=true;$('.sheet-close').focus();lastTime=null;}
function closeSheet(){modal=false;$('#sheetBackdrop').hidden=true;scrollArea.inert=false;$('.bottom-bar').inert=false;$('#gift').inert=false;updateChrome();previousFocus?.focus({preventScroll:true});lastTime=null;}
document.addEventListener('click',e=>{const detail=e.target.closest('[data-detail]');if(detail)openSheet(detail.dataset.detail);const offer=e.target.closest('[data-action="offer"]');if(offer)openSheet(slides[Number(offer.dataset.offer)].name);const scroll=e.target.closest('[data-scroll]');if(scroll){const destination=$('#'+scroll.dataset.scroll);scrollArea.scrollTo({top:destination.offsetTop-70,behavior:'smooth'});}if(e.target.closest('[data-home]'))restart();if(e.target.closest('[data-close-sheet],.sheet-close')||e.target===$('#sheetBackdrop'))closeSheet();if(e.target.closest('.gift-close'))setGiftVisibility(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal){closeSheet();return;}if(modal&&e.key==='Tab'){const focusable=[...$('#sheetBackdrop').querySelectorAll('button')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}if(modal||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();selectSlide(active+(e.key==='ArrowRight'?1:-1));}});
async function initialize(){const response=await fetch('slide-data.json');if(!response.ok)throw Error('Slide data unavailable');slides=await response.json();await Promise.all(slides.map(s=>new Promise(resolve=>{const img=new Image();img.onload=img.onerror=resolve;img.src=s.thumbnail;})));selectSlide(0,false);requestAnimationFrame(tick);}
initialize().catch(err=>{console.error(err);$('#announcement').textContent='Не удалось загрузить предложения. Обновите страницу.';});
