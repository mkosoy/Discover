#!/usr/bin/env python3
"""Harvest SkylineWebcams' public index for precise country/city camera coverage."""
import requests,re,html,json,concurrent.futures,unicodedata,csv,zipfile,io
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'lib/cameras.skyline.generated.ts'
CACHE=Path('/tmp/skyline-camera-cache.json'); cache=json.loads(CACHE.read_text()) if CACHE.exists() else {}
S=requests.Session();S.headers.update({'User-Agent':'Mozilla/5.0 elsewhere-discovery-research'})
def norm(x):return re.sub(r'[^a-z0-9]+',' ',unicodedata.normalize('NFKD',x or '').encode('ascii','ignore').decode().lower()).strip()
def get(url):
    if url in cache and cache[url]:return cache[url]
    try:r=S.get(url,timeout=16); text=r.text if r.ok else ''
    except:text=''
    if text:cache[url]=text
    return text
def load_cities():
    z=zipfile.ZipFile(io.BytesIO(requests.get('https://download.geonames.org/export/dump/cities15000.zip',timeout=25).content))
    rows=[]
    for row in csv.reader(io.TextIOWrapper(z.open('cities15000.txt'),encoding='utf-8'),delimiter='\t'):
        try:rows.append({'name':row[1],'ascii':row[2],'lat':float(row[4]),'lon':float(row[5]),'country':row[8],'pop':int(row[14] or 0)})
        except:pass
    return rows
def embeds(vid):
    try:return S.get('https://www.youtube.com/oembed',params={'url':f'https://www.youtube.com/watch?v={vid}','format':'json'},timeout=9).ok
    except:return False
def infer(title):
    t=norm(title)
    if 'volcano' in t:return 'volcano'
    if 'aurora' in t or 'northern lights' in t:return 'aurora'
    if any(x in t for x in ['animal','wildlife','safari','waterhole']):return 'wildlife'
    if any(x in t for x in ['beach','harbour','harbor','port','sea','ocean','lake','river','canal','bay','marina','coast']):return 'water'
    if any(x in t for x in ['mountain','alps','volcano','desert','park','panorama','valley','glacier']):return 'nature'
    return 'city'
def detail(url):
    text=get(url)
    # Detail requests intermittently fail under concurrent load; one immediate retry recovers many real cameras.
    if not text:text=get(url)
    if not text:return None
    m=re.search(r'videoId:\s*["\']([\w-]{11})',text)
    embed_id=(re.search(r'data-e="(\d+)"',text) or [None,None])[1] if re.search(r'data-e="(\d+)"',text) else None
    if (not m or not embeds(m.group(1))) and not embed_id:return None
    title=re.search(r'<title>(.*?)</title>',text,re.S)
    title=html.unescape(title.group(1)).strip() if title else 'Live camera'
    title=re.sub(r'^【LIVE】\s*','',title);title=re.sub(r'\s*\|\s*SkylineWebcams\s*$','',title)
    desc=re.search(r'<meta name="description" content="([^"]+)',text)
    return {'id':m.group(1) if m else None,'embedId':embed_id,'title':html.unescape(title),'description':html.unescape(desc.group(1)) if desc else ''}
def slugify(x):
    return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',x).encode('ascii','ignore').decode().lower()).strip('-')

def main():
    countries=[c for c in requests.get('https://raw.githubusercontent.com/mledoze/countries/master/countries.json',timeout=25).json() if c.get('independent')]
    byname={norm(c['name']['common']):c for c in countries}
    aliases={'turkey':'turkiye','republic of san marino':'san marino','brasil':'brazil','ellada':'greece','cabo verde':'cape verde','czech republic':'czechia'}
    slug_aliases={
        'Brazil':['brasil'],'Spain':['espana'],'Germany':['deutschland'],'Greece':['ellada'],'Czechia':['czech-republic'],
        'Netherlands':['nederland','netherlands'],'Italy':['italia','italy'],'Austria':['osterreich','austria'],
        'Switzerland':['schweiz','switzerland'],'Türkiye':['turkey','turkiye'],'South Korea':['south-korea','korea'],
        'United Arab Emirates':['united-arab-emirates'],'Saudi Arabia':['saudi-arabia'],'South Africa':['south-africa'],
        'Ivory Coast':['ivory-coast','cote-d-ivoire'],'Cabo Verde':['cape-verde','cabo-verde'],
        'San Marino':['republic-of-san-marino','san-marino'],'United Kingdom':['united-kingdom'],
        'United States':['united-states'],'DR Congo':['dr-congo','democratic-republic-of-congo'],
        'Eswatini':['eswatini','swaziland'],'Timor-Leste':['timor-leste','east-timor']
    }
    cities=load_cities()
    index=get('https://www.skylinewebcams.com/en/webcam.html')
    targets={};seen=set()
    for href,name in re.findall(r'<a href="(/en/webcam/[^"/]+\.html)">([^<]+)</a>',index):
        key=norm(html.unescape(name))
        if key in seen:continue
        seen.add(key)
        c=byname.get(aliases.get(key,key))
        if c:targets[c['name']['common']]=(c,name,href)
    # The public index is editorial rather than exhaustive: many valid country pages are not linked there.
    # Probe conservative common/localized slug candidates and keep only pages that contain camera-detail links.
    for c in countries:
        name=c['name']['common']
        if name in targets:continue
        candidates=[]
        for slug in [slugify(name)]+slug_aliases.get(name,[]):
            if slug and slug not in candidates:candidates.append(slug)
        for slug in candidates:
            href=f'/en/webcam/{slug}.html'
            page=get('https://www.skylinewebcams.com'+href)
            if page and re.search(r'href="(/en/webcam/'+re.escape(slug)+r'/[^"]+\.html)"',page):
                targets[name]=(c,name,href);break
    jobs=[]
    for c,name,href in targets.values():
        slug=href.split('/')[-1].replace('.html','')
        page=get('https://www.skylinewebcams.com'+href)
        links=[]
        for link in re.findall(r'href="(/en/webcam/'+re.escape(slug)+r'/[^"]+\.html)"',page):
            parts=link[:-5].split('/')
            # camera pages are below region/city level, not region index pages
            if len(parts)>=7 and link not in links:links.append(link)
        for link in links[:8]:jobs.append((c,name,'https://www.skylinewebcams.com'+link,link))
    print('skyline detail candidates',len(jobs),flush=True)
    out=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futs={ex.submit(detail,url):(c,country,url,link) for c,country,url,link in jobs}
        for fut in concurrent.futures.as_completed(futs):
            c,country,url,link=futs[fut];d=fut.result()
            if not d:continue
            parts=link[:-5].split('/')
            city_slug=parts[-2].replace('-',' ') if len(parts)>=5 else ''
            cc=c.get('cca2','');local=sorted([x for x in cities if x['country']==cc],key=lambda x:-x['pop'])
            hit=next((x for x in local if norm(x['ascii'])==norm(city_slug) or norm(x['name'])==norm(city_slug)),None)
            if not hit and city_slug:
                hit=next((x for x in local if norm(city_slug) in norm(x['ascii']) or norm(x['ascii']) in norm(city_slug)),None)
            fallback=(c.get('capitalInfo') or {}).get('latlng') or c.get('latlng') or [0,0]
            lat=hit['lat'] if hit else fallback[0];lon=hit['lon'] if hit else fallback[1]
            place=(hit['ascii'] if hit else city_slug.title() if city_slug else (c.get('capital') or [c['name']['common']])[0])+', '+c['name']['common']
            out.append({'country':c['name']['common'],'cca2':cc.lower(),'title':d['title'],'lat':round(float(lat),4),'lon':round(float(lon),4),'youtubeId':d['id'],'embedId':d.get('embedId'),'sourceUrl':url,'place':place,'kind':infer(d['title']+' '+d['description']),'cityExact':bool(hit)})
    # strongest first per country, cap 3
    grouped={}
    for x in out:grouped.setdefault(x['country'],[]).append(x)
    final=[]
    for country,items in grouped.items():
        for rank,x in enumerate(items[:3],1):
            x['id']=f"skyline-{x['cca2']}-{rank}";x['quality']=82 if x['cityExact'] else 72;x['confidence']='high' if x['cityExact'] else 'medium';final.append(x)
    lines=['// Generated by tools/generate_skyline_cameras.py from the public SkylineWebcams index. Positions are city-level estimates unless separately curated.','import type { PublicCamera } from "./cameras";','','export const skylineCameras: PublicCamera[] = [']
    for x in sorted(final,key=lambda z:(z['country'],z['id'])):
        q=lambda s:str(s).replace('\\',' ').replace("'","\\'")
        extras=[]
        if x.get('youtubeId'):extras.append("youtubeId: '%s'"%x['youtubeId'])
        if x.get('embedId'):extras.append("stillImage: 'https://embed.skylinewebcams.com/img/%s.jpg'"%x['embedId'])
        if x.get('sourceUrl'):extras.append("sourceUrl: '%s'"%x['sourceUrl'])
        lines.append("  { id: '%s', title: '%s', lat: %s, lon: %s, %s, place: '%s', kind: '%s', quality: %s, country: '%s', confidence: '%s', approximate: true, sourceName: 'SkylineWebcams' },"%(x['id'],q(x['title']),x['lat'],x['lon'],', '.join(extras),q(x['place']),x['kind'],x['quality'],q(x['country']),x['confidence']))
    lines.append('];\n');OUT.write_text('\n'.join(lines));CACHE.write_text(json.dumps(cache))
    print('GENERATED skyline entries',len(final),'countries',len(grouped),'file',OUT)
if __name__=='__main__':main()
