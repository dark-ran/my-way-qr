// 글자 조각 해시 + 선형 분류기. 서버 없이 기기 안에서만 돈다.
(function(){
function fnv(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h}
function grams(t){t=t.toLowerCase().replace(/[^0-9a-z가-힣\s]/g,"").trim();const o=[];const w=" "+t.replace(/\s+/g," ")+" ";for(let n=2;n<=4;n++)for(let i=0;i+n<=w.length;i++)o.push(w.slice(i,i+n));return o}
function features(t,dim){const m=new Map();grams(t).forEach(g=>{const i=fnv(g)%dim;m.set(i,g)});return m}
let M=null,H=null,ex=null;
// 1단계 소형 모델은 바로 돌고, 정밀 모델은 뒤에서 받아 준비되면 넘겨받는다. 정밀 모델을 못 받아도 앱은 계속 쓸 수 있다.
window.MWModel={grams,fnv,get ready(){return !!ex},
 async loadFull(cb){H=await (await fetch("head.json")).json();const {pipeline,env}=await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2");env.allowLocalModels=false;
  ex=await pipeline("feature-extraction","Xenova/paraphrase-multilingual-MiniLM-L12-v2",{quantized:true,progress_callback:cb});return true},
 async predictFull(t){const v=(await ex(t,{pooling:"mean",normalize:true})).data,out={};
  const f=features(t,M.dim),norm=Math.sqrt(f.size)||1;
  H.labels.forEach((k,l)=>{let z=H.bias[l],y=M.bias[l];for(let i=0;i<v.length;i++)z+=H.w[l][i]*v[i];const why=[];f.forEach((g,i)=>{const c=M.w[l*M.dim+i]*M.scale[l]/norm;y+=c;if(c>0)why.push([c,g.trim()])});
   const p=1/(1+Math.exp(-(z+y)/2));why.sort((a,b)=>b[0]-a[0]);out[k]={p,on:p>=H.th_fused[l],why:why.slice(0,3).map(x=>x[1])}});return out},
 async load(url){const j=await (await fetch(url)).json();const b=Uint8Array.from(atob(j.w),c=>c.charCodeAt(0));M={...j,w:new Int8Array(b.buffer)};return M},
 predict(t){const f=features(t,M.dim),norm=Math.sqrt(f.size)||1,out={};
  M.labels.forEach((k,l)=>{let z=M.bias[l];const why=[];f.forEach((g,i)=>{const c=M.w[l*M.dim+i]*M.scale[l]/norm;z+=c;if(c>0)why.push([c,g.trim()])});
   const p=1/(1+Math.exp(-z));why.sort((a,b)=>b[0]-a[0]);out[k]={p,on:p>=M.th[l],why:why.slice(0,3).map(x=>x[1])}});return out}};
})();
