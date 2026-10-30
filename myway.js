// 내 방식 SDK: 키오스크 웹 화면에 이 파일 한 줄만 넣으면 프로필대로 화면이 바뀐다.
(function(){
const LABELS=["big_text","plain_words","high_contrast","voice_guide","voice_input","big_touch","one_step","low_reach","more_time"];
const css=`
[data-mw~=big_text]{font-size:23px!important}
html:has(body[data-mw~=big_text]){zoom:1.7}
[data-mw~=big_text] .grid{grid-template-columns:repeat(2,1fr)!important}
[data-mw~=big_touch] button{min-height:92px!important;min-width:92px!important;margin:6px 0!important}
[data-mw~=big_touch] .grid{gap:14px!important}
[data-mw~=high_contrast],[data-mw~=high_contrast] *{background:#000!important;color:#ffe600!important;border-color:#ffe600!important;box-shadow:none!important}
[data-mw~=high_contrast] button{border:3px solid #ffe600!important}
[data-mw~=low_reach] .body{margin-top:auto!important;max-height:58%;overflow:auto}
[data-mw~=low_reach]{justify-content:flex-end!important}
.mw-hide{display:none!important}
.mw-bar{display:flex;gap:10px;margin:10px 0}.mw-bar button{flex:1;min-height:64px;font-size:1em;font-weight:700;border:2px solid #333;background:#fff;color:#111;border-radius:10px;cursor:pointer}
.mw-count{align-self:center;font-weight:700;white-space:nowrap}
.mw-mic{width:100%;min-height:64px;font-size:1em;font-weight:700;border:0;border-radius:10px;background:#0b6b4f;color:#fff;margin:8px 0;cursor:pointer}
.mw-heard{font-size:.9em;margin:4px 0}`;
function say(t){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang="ko-KR";u.rate=.9;speechSynthesis.speak(u)}catch(e){}}
function plainize(root,dict){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const ns=[];while(w.nextNode())ns.push(w.currentNode);
  const keys=Object.keys(dict).sort((a,b)=>b.length-a.length);
  ns.forEach(n=>{if(n.parentElement.closest(".mw-keep"))return;let t=n.nodeValue,o=t;
    keys.forEach(k=>{if(t.includes(k))t=t.split(k).join(dict[k])});
    if(t!==o){(root._mwOrig=root._mwOrig||[]).push([n,o]);n.nodeValue=t}});
}
// 화면 구성을 몰라도 되도록, 버튼이 가장 많은 묶음을 선택지 목록으로 본다.
function findList(root){let best=null,c=0;root.querySelectorAll("*").forEach(e=>{const n=[...e.children].filter(x=>x.tagName==="BUTTON").length;if(n>c){c=n;best=e}});return c>=2?best:null}
function oneStep(root){
  const list=findList(root);if(!list)return;const items=[...list.children].filter(x=>x.tagName==="BUTTON");let i=0;
  const bar=document.createElement("div");bar.className="mw-bar mw-keep";
  bar.innerHTML='<button type="button" data-a="-1">◀ 앞으로</button><span class="mw-count"></span><button type="button" data-a="1">다음 ▶</button>';
  list.after(bar);list.dataset.mwWas=list.style.gridTemplateColumns;list.style.gridTemplateColumns="1fr";
  const show=()=>{items.forEach((b,k)=>b.classList.toggle("mw-hide",k!==i));bar.querySelector(".mw-count").textContent=(i+1)+" / "+items.length;if(root.dataset.mw.includes("voice_guide"))say(items[i].innerText.replace(/\n/g," "))};
  bar.addEventListener("click",e=>{const a=+e.target.dataset.a;if(a){i=(i+a+items.length)%items.length;show()}});show();
  root._mwCleanup.push(()=>{items.forEach(b=>b.classList.remove("mw-hide"));bar.remove();list.style.gridTemplateColumns=list.dataset.mwWas});
}
function gram(s){s=s.replace(/\s/g,"");const m=new Set();for(let i=0;i<s.length-1;i++)m.add(s.slice(i,i+2));if(s.length===1)m.add(s);return m}
const FILL=/(하나|한\s?잔|두\s?개|주세요|할게요|할래요|볼래요|뽑아|뽑으려고|낼게요|낼래요|부탁|드려요|좀|요$)/g;
function match(text,cands){const q=gram(text.replace(FILL," ").trim());if(!q.size)return null;let best=null,sc=0;cands.forEach(c=>{const g=new Set([...gram(c.say),...c.say.split(/\s+/).filter(w=>w.length===1)]);let n=0;q.forEach(x=>{if(g.has(x))n++});const s=n/q.size;if(s>sc){sc=s;best=c}});return sc>=.3?best:null}
function voiceInput(root){
  const box=document.createElement("div");box.className="mw-keep";
  box.innerHTML='<button type="button" class="mw-mic">🎤 말로 고르기</button><div class="mw-heard" aria-live="polite"></div>';
  const body=root.querySelector(".body")||root;body.prepend(box);const heard=box.querySelector(".mw-heard");
  root.mwHear=text=>{const list=findList(root);if(!list)return null;
    const cands=[...list.querySelectorAll("button")].map(b=>({b,say:b.innerText+" "+(b.dataset.say||"")}));
    const m=match(text,cands);heard.textContent=m?`"${text}" → ${m.b.querySelector("b")?.innerText||m.b.innerText}`:`"${text}" → 못 찾았어요. 다시 말씀해 주세요.`;
    if(m){m.b.click();if(root.dataset.mw.includes("voice_guide"))say(heard.textContent)}return m&&m.b};
  box.querySelector("button").onclick=()=>{const R=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!R){const t=prompt("이 브라우저는 음성 인식이 없어요. 글로 적어 주세요.");if(t)root.mwHear(t);return}
    const r=new R();r.lang="ko-KR";heard.textContent="듣고 있어요…";r.onresult=e=>root.mwHear(e.results[0][0].transcript);r.onerror=()=>{heard.textContent="잘 안 들렸어요. 다시 눌러 주세요."};r.start()};
  root._mwCleanup.push(()=>{box.remove();delete root.mwHear});
}
function voiceGuide(root){
  const h=e=>{const b=e.target.closest("button");if(b)say(b.innerText.replace(/\n/g," "))};
  root.addEventListener("focusin",h);root.addEventListener("mouseover",h);
  say((root.querySelector("h2,h1")?.innerText||"")+" 화면입니다. 버튼을 누르면 읽어 드려요.");
  root._mwCleanup.push(()=>{root.removeEventListener("focusin",h);root.removeEventListener("mouseover",h);speechSynthesis.cancel()});
}
const MyWay={LABELS,
  encode:p=>LABELS.reduce((n,k,i)=>n|(p[k]?1<<i:0),0).toString(36),
  decode:s=>{const n=parseInt(s,36),o={};LABELS.forEach((k,i)=>o[k]=!!(n>>i&1));return o},
  reset(root){(root._mwCleanup||[]).forEach(f=>f());root._mwCleanup=[];(root._mwOrig||[]).forEach(([n,o])=>n.nodeValue=o);root._mwOrig=[];delete root.dataset.mw;root.dataset.mwTime="1"},
  apply(root,p,dict){
    if(!document.getElementById("mw-css")){const s=document.createElement("style");s.id="mw-css";s.textContent=css;document.head.append(s)}
    this.reset(root);root.dataset.mw=LABELS.filter(k=>p[k]).join(" ");
    if(p.plain_words)plainize(root,dict||window.MW_DICT||{});
    if(p.more_time)root.dataset.mwTime="3";
    if(p.voice_input)voiceInput(root);
    if(p.one_step)oneStep(root);
    if(p.voice_guide)voiceGuide(root);
  }};
window.MyWay=MyWay;
// 일반 웹 키오스크에는 이 파일만 넣으면 된다. 주소의 #p= 값(QR 내용)을 읽어 화면 전체에 적용한다.
if(!window.MW_APP)addEventListener("load",()=>setTimeout(()=>{const m=/#p=([0-9a-z]+)/.exec(location.hash);if(m)MyWay.apply(document.body,MyWay.decode(m[1]))},300));
})();
