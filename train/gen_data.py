# 로컬 Qwen으로 라벨별 학습 문장을 만든다. 라벨은 프롬프트에서 정해지므로 문장별 수동 라벨링이 필요 없다.
import json, random, re, urllib.request, sys
LABELS = {
 "big_text":"글씨가 작아서 안 보인다, 글씨를 크게 해 달라",
 "plain_words":"말이 어렵다, 영어나 외래어를 모른다, 쉬운 말로 해 달라",
 "high_contrast":"화면이 흐리다, 색 구분이 안 된다, 눈이 부시다, 글자와 배경이 잘 구분되었으면 한다",
 "voice_guide":"앞이 잘 안 보여서 화면 내용을 소리로 읽어 달라",
 "voice_input":"손가락으로 누르기 어려워서 말로 주문하고 싶다",
 "big_touch":"손이 떨리거나 손가락이 굵어서 버튼을 잘못 누른다, 버튼을 크게 해 달라",
 "one_step":"한 화면에 너무 많아서 헷갈린다, 하나씩 천천히 골랐으면 한다",
 "low_reach":"휠체어를 타거나 키가 작아서 화면 위쪽에 손이 안 닿는다",
 "more_time":"너무 빨리 넘어가거나 시간이 초과된다, 시간을 넉넉히 달라",
}
PERSONA = ["70대 어르신","80대 할머니","60대 아저씨","저시력 시각장애인","지적장애인","뇌병변장애인","휠체어 이용자","키가 작은 왜소증 당사자","손떨림이 있는 파킨슨병 환자","난독증이 있는 청년","디지털이 낯선 중년","한국에 온 지 얼마 안 된 결혼이주여성","청각장애인","어린이"]
def ask(prompt):
    body=json.dumps({"model":"qwen3.5-9b-16k","stream":False,"think":False,"keep_alive":"10m","options":{"temperature":0.9,"num_predict":900},"messages":[{"role":"user","content":prompt}]}).encode()
    r=urllib.request.urlopen(urllib.request.Request("http://localhost:11434/api/chat",body,{"Content-Type":"application/json"}),timeout=300)
    return json.load(r)["message"]["content"]
random.seed(1)
keys=list(LABELS); out=open("train_raw.jsonl","a",encoding="utf8")
n=int(sys.argv[1]) if len(sys.argv)>1 else 90
jobs=[[k] for k in keys]*5
for _ in range(n-len(jobs)):
    jobs.append(random.sample(keys,2))
random.shuffle(jobs)
for i,ls in enumerate(jobs):
    want=" 그리고 ".join(LABELS[k] for k in ls)
    p=random.choice(PERSONA)
    pr=f"""{p}가 키오스크를 쓰기 전에 도우미에게 자기 불편이나 바람을 말한다고 하자. 뜻: {want}.
이 뜻을 담은 서로 다른 한국어 말을 20개 쓰라. 입말로, 사투리·맞춤법 틀림·짧은 말·긴 말을 섞고, 뜻을 그대로 베끼지 말고 저마다 다른 낱말을 써라. 다른 불편은 넣지 말라. 번호 없이 한 줄에 하나만."""
    try: t=ask(pr)
    except Exception as e: print("err",e,flush=True); continue
    for l in t.splitlines():
        l=re.sub(r'^[\s\-\*\d\.\)"]+','',l).strip(' "')
        if 3<=len(l)<=70 and re.search('[가-힣]',l):
            out.write(json.dumps({"t":l,"y":ls},ensure_ascii=False)+"\n")
    out.flush(); print(i,ls,flush=True)
