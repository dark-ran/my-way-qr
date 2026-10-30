const NAMES={big_text:"글씨 크게",plain_words:"쉬운 말로",high_contrast:"또렷한 색",voice_guide:"소리로 읽어 주기",voice_input:"말로 고르기",big_touch:"버튼 크게",one_step:"하나씩 천천히",low_reach:"손 닿는 아래쪽으로",more_time:"시간 넉넉히"};
const SAMPLES=["글씨가 너무 작아서 안 보이고 영어 메뉴는 도통 모르겠어","휠체어라 위쪽 버튼에 손이 안 닿아요","손이 떨려서 자꾸 다른 걸 눌러요","종류가 너무 많고 금방 넘어가서 어지러워요","앞이 잘 안 보여서 읽어 줬으면 해"];
const $=id=>document.getElementById(id);const K=$("kiosk");
let profile=null,cur="cafe",left=0,timer=null,cart=[];
function drawQR(){const code=MyWay.encode(profile);const url=location.origin+location.pathname+"#p="+code;
 const q=qrcode(0,"M");q.addData(url);q.make();const c=$("qr"),n=q.getModuleCount(),s=Math.floor(c.width/(n+8)),g=c.getContext("2d");
 g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.fillStyle="#000";const o=Math.floor((c.width-s*n)/2);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))g.fillRect(o+x*s,o+y*s,s,s);
 location.replace("#p="+code);$("scan").disabled=$("cam").disabled=false;$("status").textContent="QR 대기를 누르거나 카메라에 QR을 비춰 보세요."}
function renderChips(pred){$("chips").innerHTML="";[...MyWay.LABELS].sort((x,y)=>profile[y]-profile[x]||(pred?pred[y].p-pred[x].p:0)).forEach(k=>{
 const b=document.createElement("button");b.type="button";b.className="chip";b.setAttribute("aria-pressed",profile[k]);
 const hint=pred?[...new Set(pred[k].why.filter(w=>w.length>1))]:[];const why=profile[k]&&hint.length?`단서: ${hint.join(", ")}`:"";
 b.innerHTML=`<span class="m">${NAMES[k]}</span><span>${pred?Math.round(pred[k].p*100)+"%":""}</span><small>${why}</small>`;
 b.onclick=()=>{profile[k]=!profile[k];b.setAttribute("aria-pressed",profile[k]);drawQR()};$("chips").append(b)})}
async function run(){const t=$("say").value.trim();if(!t){$("say").focus();return}
 const pred=MWModel.ready?await MWModel.predictFull(t):MWModel.predict(t);profile={};MyWay.LABELS.forEach(k=>profile[k]=pred[k].on);
 $("result").hidden=false;renderChips(pred);drawQR()}
function buildKiosk(){const k=KIOSKS[cur];clearInterval(timer);cart=[];MyWay.reset(K);
 K.className="kiosk "+k.cls;
 K.innerHTML=`<div class="timer"><span class="tl">Time left</span> <span id="t"></span> <span>sec</span></div><h2>${k.title}</h2><p class="sub">${k.sub}</p>
 <div class="body"><div class="grid">${k.items.map(([n,p,s])=>`<button type="button" data-say="${s}" data-n="${n}" data-p="${p}"><b>${n}</b><i>${p.toLocaleString()}${k.unit}</i></button>`).join("")}</div></div>
 <div class="foot"><p><span>Cart</span>: <span id="cart">-</span></p><p><span>Total</span> <span id="sum">0</span>${k.unit}</p><button type="button" class="pay">${k.pay}</button></div>`;
 K.querySelector(".grid").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;cart.push(b.querySelector("b").innerText);
  $("cart").textContent=cart.join(", ");$("sum").textContent=(+$("sum").textContent.replace(/,/g,"")+ +b.dataset.p).toLocaleString();left=base()});
 K.querySelector(".pay").onclick=()=>{$("status").textContent=cart.length?"시연이 끝났습니다. 실제 결제는 되지 않습니다.":"먼저 하나를 골라 주세요."};
 left=base();tick();timer=setInterval(tick,1000)}
const base=()=>30*(+K.dataset.mwTime||1);
function tick(){$("t").textContent=left;if(left<=0){const p=K.dataset.mw;buildKiosk();if(p&&profile)MyWay.apply(K,profile);left=base();return}left--}
function applyFrom(code){const p=MyWay.decode(code);profile=profile||p;MyWay.apply(K,p);left=base();
 $("status").textContent="적용됨: "+MyWay.LABELS.filter(k=>p[k]).map(k=>NAMES[k]).join(", ");}
function read(data){const m=/#p=([0-9a-z]+)/.exec(data);if(m)applyFrom(m[1]);return !!m}
// 시연 버튼도 화면의 QR 이미지를 실제로 해독한다.
$("scan").onclick=()=>{const c=$("qr"),d=c.getContext("2d").getImageData(0,0,c.width,c.height),r=jsQR(d.data,c.width,c.height);if(!r||!read(r.data))$("status").textContent="QR을 읽지 못했습니다."};
$("off").onclick=()=>{buildKiosk();$("status").textContent="원래 화면입니다."};
$("cam").onclick=async()=>{const v=$("video");try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});v.srcObject=s;v.hidden=false;await v.play();
 const c=document.createElement("canvas"),g=c.getContext("2d",{willReadFrequently:true});const end=()=>{s.getTracks().forEach(t=>t.stop());v.hidden=true};
 const loop=()=>{if(v.hidden)return;c.width=v.videoWidth;c.height=v.videoHeight;if(c.width){g.drawImage(v,0,0);const r=jsQR(g.getImageData(0,0,c.width,c.height).data,c.width,c.height);if(r&&read(r.data))return end()}requestAnimationFrame(loop)};loop()}catch(e){$("status").textContent="카메라를 쓸 수 없습니다. QR 대기를 눌러 주세요."}};
$("mic").onclick=()=>{const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R){$("say").placeholder="이 브라우저는 음성 인식이 없어요. 글로 적어 주세요.";$("say").focus();return}
 const r=new R();r.lang="ko-KR";$("mic").textContent="듣고 있어요…";r.onresult=e=>{$("say").value=e.results[0][0].transcript;run()};r.onend=()=>$("mic").textContent="🎤 말하기";r.start()};
$("go").onclick=run;$("print").onclick=()=>print();
SAMPLES.forEach(s=>{const b=document.createElement("button");b.type="button";b.textContent=s;b.onclick=()=>{$("say").value=s;run()};$("samples").append(b)});
Object.entries(KIOSKS).forEach(([id,k])=>{const b=document.createElement("button");b.type="button";b.role="tab";b.textContent=k.tab;b.setAttribute("aria-selected",id===cur);
 b.onclick=()=>{cur=id;document.querySelectorAll("#tabs button").forEach(x=>x.setAttribute("aria-selected",x===b));const p=K.dataset.mw;buildKiosk();if(p&&profile)MyWay.apply(K,profile),left=base()};$("tabs").append(b)});
buildKiosk();
MWModel.loadFull(p=>{if(p.status==="progress"&&/onnx/.test(p.file))$("aistat").textContent=`정밀 AI 내려받는 중 ${Math.round(p.progress)}% (처음 한 번만, 약 118MB). 그동안은 소형 AI로 작동합니다.`}).then(()=>{$("aistat").textContent="정밀 AI 준비 완료. 이 기기 안에서만 분석합니다."}).catch(()=>{$("aistat").textContent="소형 AI로 작동 중입니다."});
MWModel.load("model.json").then(()=>{const m=/#p=([0-9a-z]+)/.exec(location.hash);if(m){profile=MyWay.decode(m[1]);$("result").hidden=false;renderChips(null);drawQR();applyFrom(m[1])}});
