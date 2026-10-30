// 적용 전후 접근성 지표를 실제 렌더 결과에서 잰다. 사람 평가가 아니라 화면 수치 측정이다.
const {chromium}=require('/tmp/claude-1000/-home-hyunseo---------/97309cce-1026-4f49-a90d-78e6bdad1887/scratchpad/npm/node_modules/playwright-core');const fs=require('fs');
const VOICE=[["cafe","시원한 커피 하나 주세요","Americano (ICE)"],["cafe","따뜻한 커피요","Americano (HOT)"],["cafe","우유 들어간 커피","Caffe Latte"],["cafe","밤에 마셔도 되는 커피","Decaf Americano"],["cafe","자몽 음료 하나","Grapefruit Ade"],["cafe","홍차로 할게요","Earl Grey Tea"],["cafe","잠 잘 오는 차 주세요","Chamomile Tea"],["cafe","진한 찬물 커피","Cold Brew"],["cafe","빵 하나요","Plain Scone"],["cafe","아아 한 잔","Americano (ICE)"],
["civil","등본 뽑으려고요","주민등록표 등본 교부"],["civil","초본 주세요","주민등록표 초본 교부"],["civil","가족 서류요","가족관계증명서"],["civil","세금 낸 거 증명","지방세 납세증명서"],["civil","건강보험 서류","건강보험 자격득실 확인서"],["civil","땅 서류 볼래요","토지대장 등본 열람"],["civil","인감 대신 서명 서류","본인서명사실확인서"],
["hosp","병원비 낼게요","외래 진료비 수납"],["hosp","약 받는 종이 다시요","처방전 재발행"],["hosp","영수증 내역 뽑아 주세요","진료비 세부내역서 발급"],["hosp","진단서 주세요","진단서 발급"],["hosp","보험금 서류","실손보험 청구서류 발급"],["hosp","검사 날짜 볼래요","검사 예약 확인"]];
const metric=()=>{const K=document.getElementById('kiosk');const lum=c=>{const a=c.match(/[\d.]+/g).map(Number);const[r,g,b]=a.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
 const bg=e=>{for(;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;if(!/rgba\(.*, 0\)|transparent/.test(c))return c}return 'rgb(255,255,255)'};
 let fs=1e3,cr=1e3;const w=document.createTreeWalker(K,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode;if(!n.nodeValue.trim())continue;const e=n.parentElement;if(!e.offsetParent)continue;const s=getComputedStyle(e);fs=Math.min(fs,parseFloat(s.fontSize));const a=lum(s.color),b=lum(bg(e));cr=Math.min(cr,(Math.max(a,b)+.05)/(Math.min(a,b)+.05))}
 const bs=[...K.querySelectorAll('button')].filter(b=>b.offsetParent);const dict=Object.keys(MW_DICT).filter(k=>!/^(Cart|Total|sec|Time left)$/.test(k));const hard=dict.filter(k=>K.innerText.includes(k)).length;
 return {min_font_px:fs,min_contrast:+cr.toFixed(2),min_button_h:Math.round(Math.min(...bs.map(b=>b.getBoundingClientRect().height))),hard_terms:hard,timeout_s:30*(+K.dataset.mwTime||1),visible_choices:K.querySelectorAll('.grid button:not(.mw-hide)').length}};
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true});const p=await b.newPage({viewport:{width:1200,height:1000}});
await p.goto('http://127.0.0.1:8765/');await p.waitForTimeout(500);
const out={};const FULL={big_text:1,plain_words:1,high_contrast:1,big_touch:1,more_time:1,voice_input:0,voice_guide:0,one_step:0,low_reach:0};
for(const id of ['cafe','civil','hosp']){await p.evaluate(i=>{cur=i;buildKiosk()},id);out[id]={before:await p.evaluate(metric)};
 await p.locator('#kiosk').screenshot({path:'docs/'+id+'_before.png'});
 await p.evaluate(f=>{profile=f;MyWay.apply(K,f)},FULL);await p.waitForTimeout(100);out[id].after=await p.evaluate(metric);await p.locator('#kiosk').screenshot({path:'docs/'+id+'_after.png'})}
let ok=0;const miss=[];for(const [id,u,want] of VOICE){await p.evaluate(i=>{cur=i;buildKiosk();profile=MyWay.decode(MyWay.encode({voice_input:1}));MyWay.apply(K,profile)},id);
 const got=await p.evaluate(u=>{const b=K.mwHear(u);return b&&b.dataset.n},u);if(got===want)ok++;else miss.push([u,want,got])}
out.voice={n:VOICE.length,ok,miss};
for(const [n,f] of [['one_step',{one_step:1}],['low_reach',{low_reach:1}]]){await p.evaluate(fx=>{cur='cafe';buildKiosk();profile=fx;MyWay.apply(K,fx)},f);await p.waitForTimeout(100);await p.locator('#kiosk').screenshot({path:'docs/cafe_'+n+'.png'})}
fs.writeFileSync('docs/measure.json',JSON.stringify(out,null,1));console.log(JSON.stringify(out));await b.close()})();
