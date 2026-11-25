"""한국 음력을 천문 계산으로 독립 산출: KST 기준 삭(朔) + 중기(30° 배수) + 무중월=윤달"""
import ephem, datetime as dt, bisect, json, sys, math
UTC0 = dt.datetime(1899,12,31,12)  # ephem.Date 0
def to_dt(e): return ephem.Date(e).datetime()
def kst_offset(d):  # 한국 표준시: 1954-03-21~1961-08-09 는 UTC+8:30
    if d < dt.datetime(1912,1,1): return 8.5
    if d < dt.datetime(1954,3,21): return 9
    if d < dt.datetime(1961,8,10): return 8.5
    return 9
def kst_date(e):
    u = to_dt(e); return (u + dt.timedelta(hours=kst_offset(u))).date()

sun = ephem.Sun()
def sun_lon(e):
    sun.compute(e, epoch=e)
    ecl = ephem.Ecliptic(ephem.Equatorial(sun.g_ra, sun.g_dec, epoch=e))  # 겉보기 지심 위치(광행차·장동 반영)
    return math.degrees(float(ecl.lon)) % 360
def wrap(x): return (x+180)%360-180
def find_term(guess, L):
    """태양 겉보기 황경이 L이 되는 시각: 평균 각속도로 반복 보정(뉴턴법)"""
    t=guess
    for _ in range(12):
        t += wrap(L - sun_lon(t)) / (360/365.2422)
    assert abs(wrap(sun_lon(t)-L)) < 1e-6, (guess, L)
    return t

Y0, Y1 = 1899, 2052
# 삭
nms=[]; d=ephem.Date('1899/10/01')
while True:
    n=ephem.next_new_moon(d); 
    if to_dt(n).year>Y1: break
    nms.append(n); d=ephem.Date(n+1)
starts=[kst_date(n) for n in nms]
# 중기
terms=[]  # (kst_date, L)
for y in range(Y0, Y1):
    g = ephem.Date(f'{y}/03/20 12:00')
    for k in range(12):
        L=(30*k)%360
        t=find_term(ephem.Date(g+30.4375*k), L)
        terms.append((kst_date(t), L))
terms.sort()
# 월 번호 부여: 동지(270°)가 든 달 = 11월. 동지월~다음 동지월 사이가 13개월이면 '중기 없는 첫 달'이 윤달
raw=[]  # (start,end,[중기L...])
for i in range(len(starts)-1):
    s_,e_=starts[i],starts[i+1]
    raw.append((s_,e_,[L for (td,L) in terms if s_<=td<e_]))
dz=[i for i,(s_,e_,zs) in enumerate(raw) if 270 in zs]
months=[]
for a_,b_ in zip(dz,dz[1:]):
    n_months=b_-a_
    leap_idx=None
    if n_months==13:
        for j in range(a_+1,b_):
            if not raw[j][2]: leap_idx=j; break
        if leap_idx is None: print("WARN 13개월인데 무중월 없음", raw[a_][0])
    num=11
    for j in range(a_,b_):
        if j==a_: cur=11; leap=False
        elif j==leap_idx: cur=cur; leap=True
        else: cur=cur%12+1; leap=False
        months.append((raw[j][0],raw[j][1],cur,leap))
mstarts=[m[0] for m in months]
def lunar(date):
    i=bisect.bisect_right(mstarts,date)-1
    s,e,num,leap=months[i]
    return num,(date-s).days+1,leap
if __name__=="__main__":
    a=dt.date(int(sys.argv[1]),1,1); b=dt.date(int(sys.argv[2]),12,31)
    out=[]; d=a
    while d<=b:
        n,dd,l=lunar(d); out.append(f"{d.isoformat()} {n} {dd} {int(l)}"); d+=dt.timedelta(days=1)
    open(sys.argv[3],'w').write("\n".join(out))
    # 정합성: 춘분 2026
    print("sanity 2026-02-17:",lunar(dt.date(2026,2,17)),"2026-09-25:",lunar(dt.date(2026,9,25)),"2028-01-27:",lunar(dt.date(2028,1,27)))
