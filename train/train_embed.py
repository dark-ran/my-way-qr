# 문장 임베딩(MiniLM q8) 위에 라벨별 선형 머리를 학습한다. 브라우저와 같은 ONNX를 써서 결과가 일치한다.
import json,sys,os,hashlib
import numpy as np, onnxruntime as ort
from tokenizers import Tokenizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
HF=sys.argv[1]
LABELS=["big_text","plain_words","high_contrast","voice_guide","voice_input","big_touch","one_step","low_reach","more_time"]
tok=Tokenizer.from_file(HF+"/tokenizer.json");tok.enable_truncation(128);tok.enable_padding()
so=ort.SessionOptions();so.intra_op_num_threads=4
s=ort.InferenceSession(HF+"/model_q.onnx",so,providers=["CPUExecutionProvider"]);names=[i.name for i in s.get_inputs()]
cache=HF+"/cache.json";C=json.load(open(cache)) if os.path.exists(cache) else {}
def embed(ts):
    need=[t for t in dict.fromkeys(ts) if t not in C]
    for i in range(0,len(need),32):
        e=tok.encode_batch(need[i:i+32]);ids=np.array([x.ids for x in e],np.int64);m=np.array([x.attention_mask for x in e],np.int64)
        f={"input_ids":ids,"attention_mask":m}
        if "token_type_ids" in names:f["token_type_ids"]=np.zeros_like(ids)
        h=s.run(None,f)[0];v=(h*m[...,None]).sum(1)/m.sum(1,keepdims=True);v/=np.linalg.norm(v,axis=1,keepdims=True)
        for t,x in zip(need[i:i+32],v):C[t]=[round(float(a),5) for a in x]
    json.dump(C,open(cache,"w"));return np.array([C[t] for t in ts],np.float32)
def load(p):
    d={}
    for l in open(p,encoding="utf8"):
        if l.strip():
            r=json.loads(l);d.setdefault(r["t"],r)
    return list(d.values())
tr=load("train_raw.jsonl")+load("negatives.jsonl")+load("train_agent.jsonl");te=load("test_independent.jsonl")
rng=np.random.default_rng(0);rng.shuffle(tr);nv=len(tr)//6;val,trn=tr[:nv],tr[nv:]
Y=lambda rows:np.array([[k in r["y"] for k in LABELS] for r in rows],int)
Xt,Xv,Xs=[embed([r["t"] for r in R]) for R in (trn,val,te)];Yt,Yv,Ys=Y(trn),Y(val),Y(te)
W,B,TH=[],[],[]
for l in range(9):
    m=LogisticRegression(C=float(sys.argv[2]) if len(sys.argv)>2 else 8,class_weight="balanced",max_iter=500).fit(Xt,Yt[:,l])
    pv=m.predict_proba(Xv)[:,1];ths=np.arange(.2,.9,.05);th=ths[int(np.argmax([f1_score(Yv[:,l],pv>=t,zero_division=0) for t in ths]))]
    W.append(m.coef_[0]);B.append(float(m.intercept_[0]));TH.append(round(float(th),2))
W=np.array(W);P=1/(1+np.exp(-(Xs@W.T+np.array(B))));Pr=(P>=np.array(TH)).astype(int)
rep={"train":len(trn),"val":len(val),"test":len(te),"micro_f1":round(f1_score(Ys,Pr,average="micro"),3),"macro_f1":round(f1_score(Ys,Pr,average="macro"),3),"exact":round(float((Pr==Ys).all(1).mean()),3),
"per_label":{k:round(f1_score(Ys[:,i],Pr[:,i],zero_division=0),3) for i,k in enumerate(LABELS)},"th":TH}
print(rep);json.dump(rep,open("report_embed.json","w"),ensure_ascii=False,indent=1)
json.dump({"labels":LABELS,"bias":[round(b,4) for b in B],"th":TH,"w":[[round(float(a),4) for a in r] for r in W]},open("../head.json","w"))
# 소형·정밀 모델 결합: 로그오즈 평균. 임계값은 검증셋으로만 정한다.
import base64,re
def fnv(s):
    h=2166136261
    for c in s:h=((h^ord(c))*16777619)&0xffffffff
    return h
def grams(t):
    t=re.sub(r'[^0-9a-z가-힣\s]','',t.lower()).strip();w=" "+re.sub(r'\s+',' ',t)+" "
    return [w[i:i+n] for n in (2,3,4) for i in range(len(w)-n+1)]
M=json.load(open("../model.json"));Q=np.frombuffer(base64.b64decode(M["w"]),np.int8).reshape(9,M["dim"]).astype(np.float32)
def tiny(rows):
    Z=[]
    for r in rows:
        idx=list({fnv(g)%M["dim"] for g in grams(r["t"])});Z.append([M["bias"][l]+Q[l,idx].sum()*M["scale"][l]/np.sqrt(len(idx) or 1) for l in range(9)])
    return np.array(Z)
zv=(tiny(val)+Xv@W.T+np.array(B))/2;zs=(tiny(te)+Xs@W.T+np.array(B))/2
pv=1/(1+np.exp(-zv));ps=1/(1+np.exp(-zs));ths=np.arange(.2,.9,.05)
TF=[round(float(ths[int(np.argmax([f1_score(Yv[:,l],pv[:,l]>=t,zero_division=0) for t in ths]))]),2) for l in range(9)]
Pf=(ps>=np.array(TF)).astype(int)
shown=(ps>.25);inc=[bool((sh|~y.astype(bool)).all()) for sh,y in zip(shown,Ys) if y.any()]
rep={"fused_micro_f1":round(f1_score(Ys,Pf,average="micro"),3),"fused_macro_f1":round(f1_score(Ys,Pf,average="macro"),3),"exact":round(float((Pf==Ys).all(1).mean()),3),
 "per_label":{k:round(f1_score(Ys[:,i],Pf[:,i],zero_division=0),3) for i,k in enumerate(LABELS)},
 "candidates_contain_all_true":round(sum(inc)/int(Ys.any(1).sum()),3),"n_positive":int(Ys.any(1).sum()),"neg_false_alarm":round(float(Pf[~Ys.any(1)].any(1).mean()),3),"th":TF}
print(rep);json.dump(rep,open("report_fused.json","w"),ensure_ascii=False,indent=1)
h=json.load(open("../head.json"));h["th_fused"]=TF;json.dump(h,open("../head.json","w"))
# 실제 공개 발언 평가: 모델을 고치지 않고 한 번만 잰다.
rq=load("test_real_quotes.jsonl");Xr=embed([r["t"] for r in rq]);Yr=Y(rq);zr=(tiny(rq)+Xr@W.T+np.array(B))/2;pr=1/(1+np.exp(-zr));Pq=(pr>=np.array(TF)).astype(int)
sh=pr>.25;cov=np.mean([bool((a|~y.astype(bool)).all()) for a,y in zip(sh,Yr)]);hit=np.mean([(a&y.astype(bool)).any() for a,y in zip(Pq.astype(bool),Yr)])
FIX=[LABELS.index("big_text"),LABELS.index("high_contrast")];FIX2=FIX+[LABELS.index("plain_words"),LABELS.index("big_touch")]
fx=lambda ids:float(np.mean([not np.delete(y,ids).any() for y in Yr]))
rep={"n":len(rq),"micro_f1":round(f1_score(Yr,Pq,average="micro"),3),"one_right":round(float(hit),3),"all_in_candidates":round(float(cov),3),"fixed_big_contrast_covers":round(fx(FIX),3),"fixed_4_covers":round(fx(FIX2),3),"need_more_than_big_contrast":int(sum(np.delete(y,FIX).any() for y in Yr)),
"per_label":{k:[round(f1_score(Yr[:,i],Pq[:,i],zero_division=0),3),int(Yr[:,i].sum())] for i,k in enumerate(LABELS)}}
print(rep);json.dump(rep,open("report_real.json","w"),ensure_ascii=False,indent=1)
# 실제 발언을 학습에 반영: 5겹 교차검증으로 쓰지 않은 겹만 평가하고, 최종 머리는 전체 발언을 넣어 다시 학습한다.
from sklearn.model_selection import KFold
WQ=10
def fit(Xa,Ya,wa):
    w,b=[],[]
    for l in range(9):
        m=LogisticRegression(C=8,class_weight="balanced",max_iter=500).fit(Xa,Ya[:,l],sample_weight=wa);w.append(m.coef_[0]);b.append(float(m.intercept_[0]))
    return np.array(w),np.array(b)
Pc=np.zeros_like(Yr);Sc=np.zeros(Yr.shape,bool);tz=tiny(rq)
for a,t in KFold(5,shuffle=True,random_state=0).split(Xr):
    w,b=fit(np.vstack([Xt,Xr[a]]),np.vstack([Yt,Yr[a]]),np.r_[np.ones(len(Xt)),np.full(len(a),WQ)])
    p=1/(1+np.exp(-(tz[t]+Xr[t]@w.T+b)/2));Pc[t]=p>=np.array(TF);Sc[t]=p>.25
rep={"cv_micro_f1":round(f1_score(Yr,Pc,average="micro"),3),"cv_one_right":round(float(np.mean([(a&y.astype(bool)).any() for a,y in zip(Pc.astype(bool),Yr)])),3),"cv_all_in_candidates":round(float(np.mean([bool((a|~y.astype(bool)).all()) for a,y in zip(Sc,Yr)])),3)}
W2,B2=fit(np.vstack([Xt,Xr]),np.vstack([Yt,Yr]),np.r_[np.ones(len(Xt)),np.full(len(Xr),WQ)])
ps2=1/(1+np.exp(-(tiny(te)+Xs@W2.T+B2)/2));P2=(ps2>=np.array(TF)).astype(int)
rep["test240_after"]=round(f1_score(Ys,P2,average="micro"),3);rep["test240_all_in_cand"]=round(float(np.mean([bool((a|~y.astype(bool)).all()) for a,y in zip(ps2>.25,Ys) if y.any()])),3);rep["test240_neg_false"]=round(float(P2[~Ys.any(1)].any(1).mean()),3)
print(rep);json.dump(rep,open("report_real_cv.json","w"),ensure_ascii=False,indent=1)
json.dump({"labels":LABELS,"bias":[round(float(b),4) for b in B2],"th":TH,"th_fused":TF,"w":[[round(float(a),4) for a in r] for r in W2]},open("../head.json","w"))
