#!/usr/bin/env python3
"""Generate a broad, embeddable public-camera registry from keyless public metadata.
This intentionally favors precision over coverage: candidates must be currently badged LIVE,
embeddable, visual-camera-like, and contain recognizable geography from the target country."""
import requests,re,json,html,concurrent.futures,unicodedata,csv,zipfile,io
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'lib/cameras.generated.ts'
CACHE=Path('/tmp/global-camera-cache-v2.json')
cache=json.loads(CACHE.read_text()) if CACHE.exists() else {}
embed_cache=cache.setdefault('_embed',{})
session=requests.Session(); session.headers.update({'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36 elsewhere-discovery-research'})

def norm(x):
    x=unicodedata.normalize('NFKD',x or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+',' ',x).strip()

def contains_token(text,token):
    token=norm(token)
    return bool(token) and re.search(r'\b'+re.escape(token)+r'\b',text) is not None

def parse_videos(q):
    if q in cache:return cache[q]
    try:
        r=session.get('https://www.youtube.com/results',params={'search_query':q},timeout=18)
        m=re.search(r'var ytInitialData = (\{.+?\});</script>',r.text)
        rows=[]
        if m:
            data=json.loads(m.group(1))
            def walk(x):
                if isinstance(x,dict):
                    if 'videoRenderer' in x:rows.append(x['videoRenderer'])
                    for v in x.values():walk(v)
                elif isinstance(x,list):
                    for v in x:walk(v)
            walk(data)
        out=[]
        for v in rows[:24]:
            title=''.join(z.get('text','') for z in v.get('title',{}).get('runs',[]))
            channel=''.join(z.get('text','') for z in v.get('ownerText',{}).get('runs',[]))
            live=any(b.get('metadataBadgeRenderer',{}).get('style')=='BADGE_STYLE_TYPE_LIVE_NOW' for b in v.get('badges',[]))
            overlay=json.dumps(v.get('thumbnailOverlays',[]))
            out.append({'id':v.get('videoId'),'title':html.unescape(title),'channel':html.unescape(channel),'live':live,'unplayable':'Playback unavailable' in overlay})
        cache[q]=out
        return out
    except Exception:
        cache[q]=[];return []

def embeds(vid):
    if vid in embed_cache:return embed_cache[vid]
    try:ok=session.get('https://www.youtube.com/oembed',params={'url':f'https://www.youtube.com/watch?v={vid}','format':'json'},timeout=10).ok
    except Exception:ok=False
    embed_cache[vid]=ok
    return ok

negative=['breaking news','news live','attack','politics','protest','walking tour','travel vlog','review','compilation','timelapse','documentary','interview','music video','radio','podcast','reaction','explained','storm batters','world live original','around the world','world with relaxing music','webcams around the world','match',' vs ','cricket','football','soccer','basketball','flight arrivals','departures board','departures & arrivals','runway radar','headlines','bulletin','fast food','street food',' irl walk','walk food eats','news updates']
visual=['webcam','web cam','live cam','camera','live view','skyline','street','city','beach','harbour','harbor','port','volcano','mountain','alps','safari','wildlife','waterhole','watering hole','airport','resort','fjord','aurora','northern lights','desert','weather cam','traffic cam','earthcam','skylinewebcams','africam','explore org','panorama']
strong=['webcam','live cam','camera','earthcam','skylinewebcams','africam','safari','waterhole','volcano','harbour','harbor','port','beach','mountain','aurora','northern lights','panorama']

def infer_kind(title):
    t=norm(title)
    if 'volcano' in t or 'etna' in t or 'kilauea' in t:return 'volcano'
    if 'aurora' in t or 'northern lights' in t:return 'aurora'
    if any(x in t for x in ['safari','wildlife','waterhole','watering hole','animal','bonobo']):return 'wildlife'
    if any(x in t for x in ['beach','harbour','harbor','port','canal','river','ocean','sea','fjord']):return 'water'
    if any(x in t for x in ['mountain','alps','everest','desert','national park','panorama']):return 'nature'
    return 'city'

def load_countries():
    return [c for c in requests.get('https://raw.githubusercontent.com/mledoze/countries/master/countries.json',timeout=25).json() if c.get('independent')]

def load_cities():
    z=zipfile.ZipFile(io.BytesIO(requests.get('https://download.geonames.org/export/dump/cities15000.zip',timeout=25).content))
    rows=[]
    for row in csv.reader(io.TextIOWrapper(z.open('cities15000.txt'),encoding='utf-8'),delimiter='\t'):
        try:rows.append({'name':row[1],'ascii':row[2],'lat':float(row[4]),'lon':float(row[5]),'country':row[8],'pop':int(row[14] or 0)})
        except:pass
    return rows

def country_geo(c,cities):
    names={c['name']['common'],c['name'].get('official','')}
    for translations in (c['name'].get('native') or {}).values():
        names.add(translations.get('common',''));names.add(translations.get('official',''))
    capital=(c.get('capital') or [''])[0]
    cc=c.get('cca2','')
    local=sorted([x for x in cities if x['country']==cc and x['pop']>=45000],key=lambda x:-x['pop'])[:18]
    tokens=[]
    for x in names:
        if len(norm(x))>3:tokens.append({'token':x,'weight':15,'lat':None,'lon':None,'kind':'country'})
    if capital:
        hit=next((x for x in local if norm(x['name'])==norm(capital) or norm(x['ascii'])==norm(capital)),None)
        tokens.append({'token':capital,'weight':22,'lat':hit and hit['lat'],'lon':hit and hit['lon'],'kind':'capital'})
    for x in local[:12]:
        if len(norm(x['ascii']))>3:tokens.append({'token':x['ascii'],'weight':12,'lat':x['lat'],'lon':x['lon'],'kind':'city'})
    # unique by normalized token, strongest first
    out=[];seen=set()
    for x in sorted(tokens,key=lambda z:-z['weight']):
        k=norm(x['token'])
        if k not in seen:out.append(x);seen.add(k)
    fallback=(c.get('capitalInfo') or {}).get('latlng') or c.get('latlng') or [0,0]
    return capital,out,local,fallback

def evaluate(v,geo):
    text=norm(v.get('title','')+' '+v.get('channel',''))
    if not v.get('id') or not v.get('live') or v.get('unplayable'):return None
    if not any(x in text for x in visual):return None
    if any(x in text for x in negative):return None
    match=next((g for g in geo if contains_token(text,g['token'])),None)
    if not match:return None
    s=35+match['weight']
    for x in strong:
        if x in text:s+=4
    if '24 7' in text:s+=5
    if any(x in v.get('channel','').lower() for x in ['earthcam','skylinewebcams','africam','explore','webcam','live cam','feratel']):s+=8
    if 'music' in text or 'lofi' in text:s-=14
    if 'multicam' in text or 'cameras' in text:s-=4
    return min(92,s),match

def process(c,cities):
    country=c['name']['common'];capital,geo,local,fallback=country_geo(c,cities)
    queries=[]
    if capital:queries += [f'{capital} {country} live webcam',f'{capital} live cam',f'webcam {capital} live',f'{capital} traffic camera live']
    queries += [f'{country} live webcam',f'{country} live camera',f'{country} webcam live 24/7',f'{country} skyline webcam live']
    city_names=[]
    for city in local[:5]:
        name=city['ascii']
        if norm(name) != norm(capital) and norm(name) not in [norm(x) for x in city_names]: city_names.append(name)
    for city in city_names[:4]:
        queries += [f'{city} {country} live webcam',f'{city} live camera']
    rows=[];seen=set()
    for q in queries:
        for v in parse_videos(q):
            if v.get('id') and v['id'] not in seen:rows.append(v);seen.add(v['id'])
    scored=[]
    for v in rows:
        ev=evaluate(v,geo)
        if ev:
            score,match=ev;vv=dict(v);vv['score']=score;vv['match']=match;scored.append(vv)
    scored.sort(key=lambda x:x['score'],reverse=True)
    valid=[]
    for v in scored[:4]:
        if len(valid)<3 and embeds(v['id']):valid.append(v)
    items=[]
    for rank,v in enumerate(valid[:3]):
        m=v['match'];lat=m['lat'] if m['lat'] is not None else fallback[0];lon=m['lon'] if m['lon'] is not None else fallback[1]
        exact_capital=m['kind']=='capital'
        place=(capital+', '+country) if exact_capital and capital else ((m['token']+', '+country) if m['kind']=='city' else country)
        items.append({'id':f"country-{c.get('cca2','xx').lower()}-{rank+1}",'country':country,'capital':capital,'title':v['title'].replace('\\',' '),'channel':v['channel'].replace('\\',' '),'lat':round(float(lat),4),'lon':round(float(lon),4),'youtubeId':v['id'],'place':place,'kind':infer_kind(v['title']+' '+v['channel']),'quality':max(42,v['score']-rank*3),'confidence':'high' if exact_capital and v['score']>=75 else 'medium' if v['score']>=63 else 'low','approximate':True})
    return {'country':country,'rows':len(rows),'items':items}

def main():
    countries=load_countries();cities=load_cities();results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as ex:
        futs=[ex.submit(process,c,cities) for c in countries]
        for n,f in enumerate(concurrent.futures.as_completed(futs),1):
            try:results.append(f.result())
            except Exception:pass
            if n%20==0:CACHE.write_text(json.dumps(cache));print('done',n,'coverage',sum(bool(r['items']) for r in results),flush=True)
    CACHE.write_text(json.dumps(cache))
    items=[x for r in results for x in r['items']]
    coverage=sum(bool(r['items']) for r in results)
    missing=sorted(r['country'] for r in results if not r['items'])
    lines=['// Generated by tools/generate_global_cameras.py. Generated positions are city/country estimates, not precise camera survey coordinates.','import type { PublicCamera } from "./cameras";','','export const generatedCountryCameras: PublicCamera[] = [']
    for x in sorted(items,key=lambda z:(z['country'],z['id'])):
        q=lambda s:str(s).replace('\\',' ').replace("'","\\'")
        lines.append("  { id: '%s', title: '%s', lat: %s, lon: %s, youtubeId: '%s', place: '%s', kind: '%s', quality: %s, country: '%s', confidence: '%s', approximate: true },"%(x['id'],q(x['title']),x['lat'],x['lon'],x['youtubeId'],q(x['place']),x['kind'],x['quality'],q(x['country']),x['confidence']))
    lines.append('];\n')
    OUT.write_text('\n'.join(lines))
    print('GENERATED entries',len(items),'countries',coverage,'missing',len(missing))
    print('missing',', '.join(missing))
if __name__=='__main__':main()
