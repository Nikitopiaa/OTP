const $=(s)=>document.querySelector(s);
const duration=10000,circumference=2*Math.PI*19;
const photoMotionEnd=['translate(-10px,-7px) scale(1.12)','translate(10px,-6px) scale(1.12)','translate(-14px,-9px) scale(1.14)'];
const scrollArea=$('#scrollArea'),hero=$('#hero'),thumbs=$('#thumbnails');
const prototypeControls = $('.prototype-controls');
const prototypeBack = $('.sf-back');
let slides=[],active=0,elapsed=0,lastTime=null,paused=false,held=false,modal=false,previousFocus=null,gesture=null;
let slideAnimations=[],slideAnimationEpoch=0;
let photoMotions=[],thumbnailAnimations=[],timerId=null,heroVisible=true,scrolling=false,scrollIdleTimer=null,chromeFrame=null,chromeOpacity=-1;
let pulling=false,pullInput=null,pullFrame=null,pullReturnTimer=null,pullClickUntil=0;
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
const thumbnailTransform=(slot,scale=slot===0?1:.678575)=>'translateX('+(34+slot*40.4285)+'px) scale('+scale+')';
function renderThumbnails(previous,direction){
 const buttons=[...thumbs.children],before=buttons.map(b=>({transform:getComputedStyle(b).transform,opacity:getComputedStyle(b).opacity}));
 thumbnailAnimations.forEach(a=>a.cancel());thumbnailAnimations=[];
 const animate=previous!==active&&heroVisible&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 buttons.forEach((button,i)=>{
  const slot=thumbnailSlot(i,active),oldSlot=thumbnailSlot(i,previous),transform=thumbnailTransform(slot),opacity=slot===0?1:.8;
  button.classList.toggle('active',i===active);button.setAttribute('aria-current',String(i===active));button.style.transform=transform;button.style.opacity=opacity;
  const circle=button.querySelector('circle');circle.style.strokeDashoffset=0;
  if(!animate)return;
  // Shrink at the old position, then grow in place at the new position.
  const wraps=oldSlot===-direction&&slot===direction;
  const frames=wraps?[before[i],{transform:thumbnailTransform(oldSlot,.08),opacity:0,offset:.4},{transform:thumbnailTransform(slot,.08),opacity:0,offset:.42},{transform,opacity}]:[before[i],{transform,opacity}];
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
function scheduleTick(){clearTimeout(timerId);timerId=null;if(!slides.length||paused||held||pulling||modal||document.hidden){lastTime=null;return;}timerId=setTimeout(tick,heroVisible&&!scrolling?1000/30:250);}
function tick(){timerId=null;const time=performance.now();if(lastTime!==null)elapsed+=Math.min(time-lastTime,1000);if(elapsed>=duration)selectSlide(active+1,false);else updateProgress();lastTime=time;scheduleTick();}
function syncPlayback(){photoMotions.forEach(motion=>{motion.currentTime=Math.min(duration,elapsed);if(!paused&&!held&&!pulling&&!modal&&!document.hidden&&heroVisible&&!scrolling)motion.play();else motion.pause();});scheduleTick();}
function startPhotoMotion(){
 photoMotions.forEach(motion=>{const target=motion.effect.target;target.style.transform=getComputedStyle(target).transform;motion.cancel();});photoMotions=[];
 hero.querySelectorAll('.hero-slide.active .hero-photo,.hero-slide.active .offer-blur-photo').forEach(target=>{
  target.style.transform='';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)photoMotions.push(target.animate([{transform:'translate(0,0) scale(1.02)'},{transform:photoMotionEnd[active]}],{duration,easing:'cubic-bezier(.3,0,.7,1)',fill:'forwards'}));
 });
 syncPlayback();
}
function beginPull(x,y,id,kind,target){
 if(pulling||modal||scrollArea.scrollTop>0||target.closest('input,textarea,select')||(kind==='mouse'&&target.closest('button,a')))return;
 pullInput={x,y,id,kind,base:hero.clientWidth*535/393,distance:0};
}
function movePull(x,y,event){
 if(!pullInput)return;
 const dy=y-pullInput.y,dx=x-pullInput.x;
 if(!pulling){
  if(scrollArea.scrollTop>0||Math.abs(dx)>Math.max(6,Math.abs(dy))){pullInput=null;return;}
  if(dy<=0)return;
  if(!event.cancelable){pullInput=null;return;}
  pulling=true;gesture=null;held=false;hero.classList.add('is-pulling');scrollArea.classList.add('is-pulling');syncPlayback();
  if(pullInput.kind==='mouse')scrollArea.setPointerCapture(pullInput.id);
 }
 if(event.cancelable)event.preventDefault();
 const limit=Math.min(360,pullInput.base*.8);
 pullInput.distance=limit*(1-Math.exp(-Math.max(0,dy)*.65/limit));
 if(pullFrame===null)pullFrame=requestAnimationFrame(()=>{pullFrame=null;if(pullInput)hero.style.height=(pullInput.base+pullInput.distance)+'px';});
}
function finishPull(){
 const input=pullInput;pullInput=null;
 if(pullFrame!==null){cancelAnimationFrame(pullFrame);pullFrame=null;}
 if(!pulling||!input)return;
 pullClickUntil=performance.now()+450;gesture=null;held=false;
 hero.classList.remove('is-pulling');scrollArea.classList.remove('is-pulling');
 hero.classList.add('is-pull-returning');hero.style.height=input.base+'px';
 clearTimeout(pullReturnTimer);
 const returnDuration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:440;
 pullReturnTimer=setTimeout(()=>{hero.classList.remove('is-pull-returning');hero.style.removeProperty('height');pulling=false;lastTime=null;syncPlayback();},returnDuration);
}
scrollArea.addEventListener('touchstart',event=>{if(event.touches.length!==1){finishPull();return;}const t=event.touches[0];beginPull(t.clientX,t.clientY,t.identifier,'touch',event.target);},{passive:true});
scrollArea.addEventListener('touchmove',event=>{if(pullInput?.kind!=='touch')return;if(event.touches.length!==1){finishPull();return;}const t=event.touches[0];if(t.identifier===pullInput.id)movePull(t.clientX,t.clientY,event);},{passive:false});
scrollArea.addEventListener('touchend',()=>{if(pullInput?.kind==='touch')finishPull();},{passive:true});
scrollArea.addEventListener('touchcancel',()=>{if(pullInput?.kind==='touch')finishPull();},{passive:true});
scrollArea.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button===0)beginPull(event.clientX,event.clientY,event.pointerId,'mouse',event.target);});
scrollArea.addEventListener('pointermove',event=>{if(pullInput?.kind==='mouse'&&event.pointerId===pullInput.id)movePull(event.clientX,event.clientY,event);});
for(const eventName of ['pointerup','pointercancel','lostpointercapture'])scrollArea.addEventListener(eventName,event=>{if(pullInput?.kind==='mouse'&&event.pointerId===pullInput.id)finishPull();});
scrollArea.addEventListener('click',event=>{if(performance.now()<pullClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
$('#pauseButton').addEventListener('click',()=>{paused=!paused;$('#pauseButton').setAttribute('aria-pressed',String(paused));$('#pauseButton').setAttribute('aria-label',paused?'Продолжить автопереключение':'Приостановить автопереключение');$('#pauseLabel').textContent=paused?'Продолжить':'Пауза';$('#pauseIcon').textContent=paused?'▷':'Ⅱ';lastTime=null;syncPlayback();});
function restart(){if(modal)closeSheet();scrollArea.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});selectSlide(0);}
$('#restartButton').addEventListener('click',restart);
function setGiftVisibility(visible){$('#gift').hidden=!visible;$('#giftToggleButton').textContent=visible?'Скрыть подарок':'Показать подарок';$('#giftToggleButton').setAttribute('aria-pressed',String(visible));}
const giftMotionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let giftEffects=[],giftEffectFrame=null;
function syncGiftEffects(){
 if(giftEffectFrame!==null){cancelAnimationFrame(giftEffectFrame);giftEffectFrame=null;}
 giftEffects.forEach(effect=>effect.cancel());giftEffects=[];
 if(giftMotionPreference.matches)return;
 giftEffectFrame=requestAnimationFrame(time=>{
  giftEffectFrame=null;if(giftMotionPreference.matches)return;
  const style=getComputedStyle($('.gift-open'));
  const timing={duration:parseFloat(style.getPropertyValue('--gift-effect-period'))*1000,delay:parseFloat(style.getPropertyValue('--gift-effect-delay'))*1000,iterations:Infinity,fill:'both'};
  const end=.13;
  const lift=[{offset:0,transform:'translateY(0)',easing:'ease-in-out'},{offset:end/2,transform:'translateY(-4px)',easing:'ease-in-out'},{offset:end,transform:'translateY(0)'},{offset:1,transform:'translateY(0)'}];
  const shine=[[0,0],[.007,.9],[end/2,.9],[.123,.9],[end,0],[1,0]].map(([offset,opacity])=>({offset,opacity,transform:'translateX('+(90*Math.min(offset/end,1))+'px) skewX(-18deg)'}));
  const epoch=document.timeline.currentTime??time;
  giftEffects=[$('.gift-art').animate(lift,timing),$('.gift-shine-streak').animate(shine,timing)];
  // Both effects share an exact timeline origin, even if their assets load separately.
  giftEffects.forEach(effect=>{effect.startTime=epoch;});
 });
}
giftMotionPreference.addEventListener('change',syncGiftEffects);
syncGiftEffects();
$('#giftToggleButton').addEventListener('click',()=>setGiftVisibility($('#gift').hidden));
hero.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;gesture={x:e.clientX,y:e.clientY,id:e.pointerId};held=true;syncPlayback();});
hero.addEventListener('pointerup',e=>{if(!gesture)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;held=false;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.3)selectSlide(active+(dx<0?1:-1));gesture=null;lastTime=null;syncPlayback();});
hero.addEventListener('pointercancel',()=>{gesture=null;held=false;lastTime=null;syncPlayback();});
hero.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){gesture=null;held=false;lastTime=null;syncPlayback();}});
document.addEventListener('pointerup',()=>{if(pullInput?.kind==='mouse')finishPull();held=false;syncPlayback();});
document.addEventListener('visibilitychange',()=>{lastTime=null;syncPlayback();});
function updateChrome(){const scrollTop=scrollArea.scrollTop,stories=$('.offer-navigation');stories.classList.toggle('hidden-on-scroll',scrollTop>24);stories.inert=modal||scrollTop>24;$('#statusBar').classList.toggle('scrolled',scrollTop>360);$('#screen').classList.toggle('content-scrolled',scrollTop>360);const opacity=Math.round(Math.max(0,Math.min(1,(scrollTop-280)/160))*20)/20;if(opacity!==chromeOpacity){chromeOpacity=opacity;$('#screen').style.setProperty('--chrome-opacity',String(opacity));}}
scrollArea.addEventListener('scroll',()=>{if(!scrolling){scrolling=true;$('#screen').classList.add('is-scrolling');syncPlayback();}clearTimeout(scrollIdleTimer);scrollIdleTimer=setTimeout(()=>{scrolling=false;$('#screen').classList.remove('is-scrolling');syncPlayback();},180);if(chromeFrame===null)chromeFrame=requestAnimationFrame(()=>{chromeFrame=null;updateChrome();});},{passive:true});updateChrome();
new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;syncPlayback();},{root:scrollArea}).observe(hero);
function openSheet(title){previousFocus=document.activeElement;modal=true;$('#sheetTitle').textContent=title;$('#sheetBackdrop').hidden=false;scrollArea.inert=true;$('.bottom-bar').inert=true;$('.offer-navigation').inert=true;$('#gift').inert=true;prototypeControls.open=false;prototypeControls.inert=true;prototypeBack.inert=true;$('.sheet-close').focus();lastTime=null;syncPlayback();}
function closeSheet(){modal=false;$('#sheetBackdrop').hidden=true;scrollArea.inert=false;$('.bottom-bar').inert=false;$('#gift').inert=false;prototypeControls.inert=false;prototypeBack.inert=false;updateChrome();previousFocus?.focus({preventScroll:true});lastTime=null;syncPlayback();}
document.addEventListener('click',e=>{const detail=e.target.closest('[data-detail]');if(detail)openSheet(detail.dataset.detail);const offer=e.target.closest('[data-action="offer"]');if(offer)openSheet(slides[Number(offer.dataset.offer)].name);const scroll=e.target.closest('[data-scroll]');if(scroll){const destination=$('#'+scroll.dataset.scroll);if(destination){const root=scrollArea.getBoundingClientRect(),scale=root.height/scrollArea.clientHeight;scrollArea.scrollTo({top:scrollArea.scrollTop+(destination.getBoundingClientRect().top-root.top)/scale-70,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}if(e.target.closest('[data-home]'))restart();if(e.target.closest('[data-close-sheet],.sheet-close')||e.target===$('#sheetBackdrop'))closeSheet();if(e.target.closest('.gift-close'))setGiftVisibility(false);});
document.addEventListener('click', event => {
  if (prototypeControls.open && !prototypeControls.contains(event.target)) prototypeControls.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (modal) closeSheet();
    else if (prototypeControls.open) {
      prototypeControls.open = false;
      prototypeControls.querySelector('summary').focus();
    }
    return;
  }
  if (modal && event.key === 'Tab') {
    const focusable = [...$('#sheetBackdrop').querySelectorAll('button')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    return;
  }
  if (modal || prototypeControls.open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    selectSlide(active + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
async function initialize(){const response=await fetch('slide-data.json');if(!response.ok)throw Error('Slide data unavailable');slides=await response.json();await Promise.all(slides.map(s=>new Promise(resolve=>{const img=new Image();img.onload=img.onerror=resolve;img.src=s.thumbnail;})));createThumbnails();selectSlide(0,false);scheduleTick();}
initialize().catch(err=>{console.error(err);$('#announcement').textContent='Не удалось загрузить предложения. Обновите страницу.';});
