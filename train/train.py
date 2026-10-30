# 학습 후 model.json을 내보내고, 독립 평가셋 성능을 report.json에 남긴다.
import json,re,base64,sys,random
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
LABELS=["big_text","plain_words","high_contrast","voice_guide","voice_input","big_touch","one_step","low_reach","more_time"]
DIM=1<<14
def fnv(s):
    h=2166136261
    for c in s: h=((h^ord(c))*16777619)&0xffffffff
    return h
def grams(t):
    t=re.sub(r'[^0-9a-z가-힣\s]','',t.lower()).strip(); w=" "+re.sub(r'\s+',' ',t)+" "
    return [w[i:i+n] for n in (2,3,4) for i in range(len(w)-n+1)]
def vec(t):
    x=np.zeros(DIM,np.float32); idx=list({fnv(g)%DIM for g in grams(t)})
    x[idx]=1/np.sqrt(len(idx) or 1); return x
def load(p):
    rows=[json.loads(l) for l in open(p,encoding='utf8') if l.strip()]
    seen=set();out=[]
    for r in rows:
        if r['t'] in seen: continue
        seen.add(r['t']);out.append(r)
    return out
def XY(rows): return np.stack([vec(r['t']) for r in rows]),np.array([[k in r['y'] for k in LABELS] for r in rows],int)
train=load('train_raw.jsonl')+load('negatives.jsonl')+load('train_agent.jsonl')+load('train_narrative.jsonl'); test=load('test_independent.jsonl')
random.seed(0);random.shuffle(train);nv=len(train)//6;val,tr=train[:nv],train[nv:]
Xt,Yt=XY(tr);Xv,Yv=XY(val);Xs,Ys=XY(test)
W=[];B=[];TH=[]
for l in range(len(LABELS)):
    m=LogisticRegression(C=30,class_weight='balanced',max_iter=400).fit(Xt,Yt[:,l])
    pv=m.predict_proba(Xv)[:,1];ths=np.arange(.2,.9,.05);th=ths[int(np.argmax([f1_score(Yv[:,l],pv>=t,zero_division=0) for t in ths]))]
    W.append(m.coef_[0]);B.append(float(m.intercept_[0]));TH.append(round(float(th),2))
W=np.array(W);P=np.stack([1/(1+np.exp(-(Xs@W[l]+B[l]))) for l in range(len(LABELS))],1);Pred=(P>=np.array(TH)).astype(int)
scale=[float(np.abs(W[l]).max()/127) for l in range(len(LABELS))]
q=np.stack([np.round(W[l]/scale[l]) for l in range(len(LABELS))]).astype(np.int8)
P2=np.stack([1/(1+np.exp(-(Xs@(q[l]*scale[l])+B[l]))) for l in range(len(LABELS))],1);Pred2=(P2>=np.array(TH)).astype(int)
rep={"train":len(tr),"val":len(val),"test":len(test),"micro_f1":round(f1_score(Ys,Pred2,average='micro'),3),"macro_f1":round(f1_score(Ys,Pred2,average='macro',zero_division=0),3),
 "float_micro_f1":round(f1_score(Ys,Pred,average='micro'),3),"exact":round(float((Pred2==Ys).all(1).mean()),3),
 "at_least_one_right":round(float(np.mean([(p&y).any() and not (p&~y.astype(bool)).any() if y.any() else not p.any() for p,y in zip(Pred2.astype(bool),Ys.astype(bool))])),3),
 "per_label":{k:round(f1_score(Ys[:,i],Pred2[:,i],zero_division=0),3) for i,k in enumerate(LABELS)}}
print(rep);json.dump(rep,open('report.json','w'),ensure_ascii=False,indent=1)
json.dump({"labels":LABELS,"dim":DIM,"bias":B,"scale":scale,"th":TH,"w":base64.b64encode(q.tobytes()).decode()},open('../model.json','w'))
errs=[(r['t'],r['y'],[k for k,p in zip(LABELS,row) if p]) for r,row in zip(test,Pred2) if [k for k in LABELS if k in r['y']]!=[k for k,p in zip(LABELS,row) if p]]
json.dump(errs,open('errors.json','w'),ensure_ascii=False,indent=0)
