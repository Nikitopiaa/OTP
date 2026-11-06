const $=(s)=>document.querySelector(s);
const duration=10000,circumference=2*Math.PI*19;
const scrollArea=$('#scrollArea'),hero=$('#hero'),thumbs=$('#thumbnails');
const lightweightRendering=CSS.supports('-webkit-touch-callout','none')||new URLSearchParams(location.search).get('render')==='light';
document.body.classList.toggle('lightweight-rendering',lightweightRendering);
let slides=[],active=0,elapsed=0,lastTime=null,paused=false,held=false,modal=false,previousFocus=null,gesture=null;
let slideAnimations=[],slideAnimationEpoch=0;
let photoMotions=[],thumbnailAnimations=[],timerId=null,heroVisible=true,scrolling=false,scrollIdleTimer=null,chromeFrame=null,chromeOpacity=-1;
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
 if(previous===index||scrolling||!heroVisible||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const outgoing=elements[previous],incoming=elements[index];outgoing.classList.add('is-leaving');
 const options={duration:560,easing:'cubic-bezier(.22,.61,.36,1)'};
 slideAnimations=[outgoing.animate([{transform:'translateX(0)'},{transform:'translateX('+(-direction*100)+'%)'}],options),incoming.animate([{transform:'translateX('+(direction*100)+'%)'},{transform:'translateX(0)'}],options)];
 Promise.all(slideAnimations.map(a=>a.finished)).then(()=>{if(epoch===slideAnimationEpoch){outgoing.classList.remove('is-leaving');slideAnimations=[];}},()=>{});
}
function createThumbnails(){
 slides.forEach((slide,i)=>{
  const button=document.createElement('button');button.className='thumbnail';button.dataset.target=i;button.setAttribute('aria-label',slide.name);
  const picture=document.createElement('span');picture.className='thumbnail-picture';
  const image=new Image();image.src=slide.thumbnail;image.alt='';image.draggable=false;image.style.objectPosition=i===0?'center 46%':'center 42%';picture.append(image);button.append(picture);
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 40 40');svg.classList.add('thumbnail-ring');svg.setAttribute('aria-hidden','true');
  const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx','20');circle.setAttribute('cy','20');circle.setAttribute('r','19');circle.style.strokeDasharray=circumference;svg.append(circle);button.append(svg);
  button.addEventListener('click',()=>selectSlide(i));thumbs.append(button);
 });
}
const thumbnailSlot=(index,current)=>[0,1,-1][(index-current+3)%3];
const thumbnailTransform=slot=>'translateX('+(34+slot*40.4285)+'px) scale('+(slot===0?1:.678575)+')';
function renderThumbnails(previous,direction){
 const buttons=[...thumbs.children],before=buttons.map(b=>({transform:getComputedStyle(b).transform,opacity:getComputedStyle(b).opacity}));
 thumbnailAnimations.forEach(a=>a.cancel());thumbnailAnimations=[];
 const animate=previous!==active&&heroVisible&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 buttons.forEach((button,i)=>{
  const slot=thumbnailSlot(i,active),oldSlot=thumbnailSlot(i,previous),transform=thumbnailTransform(slot),opacity=slot===0?1:.8;
  button.classList.toggle('active',i===active);button.setAttribute('aria-current',String(i===active));button.style.transform=transform;button.style.opacity=opacity;
  const circle=button.querySelector('circle');circle.style.strokeDashoffset=0;
  if(!animate)return;
  // Recycle the outgoing edge preview outside the clipped strip, retaining its DOM.
  const wraps=oldSlot===-direction&&slot===direction;
  const frames=wraps?[before[i],{transform:thumbnailTransform(-2*direction),opacity:0,offset:.44},{transform:thumbnailTransform(2*direction),opacity:0,offset:.45},{transform,opacity}]:[before[i],{transform,opacity}];
  thumbnailAnimations.push(button.animate(frames,{duration:560,easing:'cubic-bezier(.22,.61,.36,1)'}));
 });
}
function syncOfferBackdrops(){
 hero.querySelectorAll('.hero-slide.active,.hero-slide.is-leaving').forEach(slide=>{
  const background=slide.querySelector('.hero-background'),offer=slide.querySelector('.offer'),photo=slide.querySelector('.offer-blur-photo');
  Object.assign(photo.style,{width:background.offsetWidth+'px',height:background.offsetHeight+'px',left:-offer.offsetLeft+'px',top:-offer.offsetTop+'px'});
 });
}
new ResizeObserver(syncOfferBackdrops).observe(hero);
function selectSlide(index,announce=true){const previous=active,delta=index-active,direction=delta===-1||delta===2?-1:1;active=(index+slides.length)%slides.length;elapsed=0;lastTime=null;renderSlide(previous,active,direction);renderThumbnails(previous,direction);syncOfferBackdrops();$('#slideNumber').textContent=String(active+1).padStart(2,'0');$('#slideName').textContent=slides[active].name;hero.dataset.activeSlide=active;updateProgress();startPhotoMotion();if(announce)$('#announcement').textContent='Предложение '+(active+1)+' из 3. '+slides[active].name;}
function updateProgress(){if(!heroVisible)return;const progress=Math.min(1,elapsed/duration),ring=thumbs.querySelector('.thumbnail.active circle');if(ring)ring.style.strokeDashoffset=circumference*progress;}
function scheduleTick(){clearTimeout(timerId);timerId=null;if(!slides.length||paused||held||modal||document.hidden){lastTime=null;return;}timerId=setTimeout(tick,heroVisible&&!scrolling?1000/30:250);}
function tick(){timerId=null;const time=performance.now();if(lastTime!==null)elapsed+=Math.min(time-lastTime,1000);if(elapsed>=duration)selectSlide(active+1,false);else updateProgress();lastTime=time;scheduleTick();}
function syncPlayback(){photoMotions.forEach(motion=>{motion.currentTime=Math.min(duration,elapsed);if(!paused&&!held&&!modal&&!document.hidden&&heroVisible&&!scrolling)motion.play();else motion.pause();});scheduleTick();}
function startPhotoMotion(){
 photoMotions.forEach(motion=>{const target=motion.effect.target;target.style.transform=getComputedStyle(target).transform;motion.cancel();});photoMotions=[];
 hero.querySelectorAll('.hero-slide.active .hero-photo,.hero-slide.active .offer-blur-photo').forEach(target=>{
  target.style.transform='';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)photoMotions.push(target.animate([{transform:'translate(0,0) scale(1)'},{transform:'translate(-6px,-4px) scale(1.06)'}],{duration,easing:'linear',fill:'forwards'}));
 });
 syncPlayback();
}
$('#pauseButton').addEventListener('click',()=>{paused=!paused;$('#pauseButton').setAttribute('aria-pressed',String(paused));$('#pauseButton').setAttribute('aria-label',paused?'Продолжить автопереключение':'Приостановить автопереключение');$('#pauseLabel').textContent=paused?'Продолжить':'Пауза';$('#pauseIcon').textContent=paused?'▷':'Ⅱ';lastTime=null;syncPlayback();});
function restart(){if(modal)closeSheet();scrollArea.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});selectSlide(0);}
$('#restartButton').addEventListener('click',restart);
function setGiftVisibility(visible){$('#gift').hidden=!visible;$('#giftToggleButton').textContent=visible?'Скрыть подарок':'Показать подарок';$('#giftToggleButton').setAttribute('aria-pressed',String(visible));}
$('#giftToggleButton').addEventListener('click',()=>setGiftVisibility($('#gift').hidden));
hero.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;gesture={x:e.clientX,y:e.clientY,id:e.pointerId};held=true;syncPlayback();});
hero.addEventListener('pointerup',e=>{if(!gesture)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;held=false;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.3)selectSlide(active+(dx<0?1:-1));gesture=null;lastTime=null;syncPlayback();});
hero.addEventListener('pointercancel',()=>{gesture=null;held=false;lastTime=null;syncPlayback();});
hero.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){gesture=null;held=false;lastTime=null;syncPlayback();}});
document.addEventListener('pointerup',()=>{held=false;syncPlayback();});
document.addEventListener('visibilitychange',()=>{lastTime=null;syncPlayback();});
function updateChrome(){const scrollTop=scrollArea.scrollTop,stories=$('.offer-navigation');stories.classList.toggle('hidden-on-scroll',scrollTop>24);stories.inert=modal||scrollTop>24;$('#statusBar').classList.toggle('scrolled',scrollTop>360);$('#screen').classList.toggle('content-scrolled',scrollTop>360);const opacity=Math.round(Math.max(0,Math.min(1,(scrollTop-280)/160))*20)/20;if(opacity!==chromeOpacity){chromeOpacity=opacity;$('#screen').style.setProperty('--chrome-opacity',String(opacity));}}
scrollArea.addEventListener('scroll',()=>{if(!scrolling){scrolling=true;$('#screen').classList.add('is-scrolling');syncPlayback();}clearTimeout(scrollIdleTimer);scrollIdleTimer=setTimeout(()=>{scrolling=false;$('#screen').classList.remove('is-scrolling');syncPlayback();},180);if(chromeFrame===null)chromeFrame=requestAnimationFrame(()=>{chromeFrame=null;updateChrome();});},{passive:true});updateChrome();
new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;syncPlayback();},{root:scrollArea}).observe(hero);
function openSheet(title){previousFocus=document.activeElement;modal=true;$('#sheetTitle').textContent=title;$('#sheetBackdrop').hidden=false;scrollArea.inert=true;$('.bottom-bar').inert=true;$('.offer-navigation').inert=true;$('#gift').inert=true;$('.sheet-close').focus();lastTime=null;syncPlayback();}
function closeSheet(){modal=false;$('#sheetBackdrop').hidden=true;scrollArea.inert=false;$('.bottom-bar').inert=false;$('#gift').inert=false;updateChrome();previousFocus?.focus({preventScroll:true});lastTime=null;syncPlayback();}
document.addEventListener('click',e=>{const detail=e.target.closest('[data-detail]');if(detail)openSheet(detail.dataset.detail);const offer=e.target.closest('[data-action="offer"]');if(offer)openSheet(slides[Number(offer.dataset.offer)].name);const scroll=e.target.closest('[data-scroll]');if(scroll){const destination=$('#'+scroll.dataset.scroll);if(destination){const root=scrollArea.getBoundingClientRect(),scale=root.height/scrollArea.clientHeight;scrollArea.scrollTo({top:scrollArea.scrollTop+(destination.getBoundingClientRect().top-root.top)/scale-70,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}if(e.target.closest('[data-home]'))restart();if(e.target.closest('[data-close-sheet],.sheet-close')||e.target===$('#sheetBackdrop'))closeSheet();if(e.target.closest('.gift-close'))setGiftVisibility(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal){closeSheet();return;}if(modal&&e.key==='Tab'){const focusable=[...$('#sheetBackdrop').querySelectorAll('button')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}if(modal||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();selectSlide(active+(e.key==='ArrowRight'?1:-1));}});
async function initialize(){const response=await fetch('slide-data.json');if(!response.ok)throw Error('Slide data unavailable');slides=await response.json();await Promise.all(slides.map(s=>new Promise(resolve=>{const img=new Image();img.onload=img.onerror=resolve;img.src=s.thumbnail;})));createThumbnails();selectSlide(0,false);scheduleTick();}
initialize().catch(err=>{console.error(err);$('#announcement').textContent='Не удалось загрузить предложения. Обновите страницу.';});
