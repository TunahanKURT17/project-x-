const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const DIYANET_BASE = 'https://awqatsalah.diyanet.gov.tr';
const USER = process.env.DIYANET_EMAIL || '';
const PASS = process.env.DIYANET_PASSWORD || '';
const cache = new Map();
let tokenCache = { accessToken:null, refreshToken:null, expiresAt:0 };
let statesCache = { data:null, expiresAt:0 };
const citiesCache = new Map();

function json(res, code, body){
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});
  res.end(JSON.stringify(body));
}
function norm(s='') { return s.toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/İ/g,'I').replace(/ı/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C').replace(/[^A-Z0-9]/g,''); }
async function apiFetch(p, opts={}) {
  const r = await fetch(DIYANET_BASE+p, opts);
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error(`Diyanet HTTP ${r.status}: ${text.slice(0,200)}`); }
  if (!r.ok) throw new Error(`Diyanet HTTP ${r.status}: ${data.message || 'hata'}`);
  return data;
}
async function login(){
  if (!USER || !PASS) throw new Error('DIYANET_EMAIL ve DIYANET_PASSWORD tanımlı değil.');
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60000) return tokenCache.accessToken;
  if (tokenCache.refreshToken && Date.now() < tokenCache.expiresAt + 14*60*1000) {
    try {
      const d=await apiFetch(`/api/Auth/RefreshToken/${encodeURIComponent(tokenCache.refreshToken)}`);
      tokenCache={accessToken:d.data.accessToken,refreshToken:d.data.refreshToken,expiresAt:Date.now()+44*60*1000};
      return tokenCache.accessToken;
    } catch {}
  }
  const d=await apiFetch('/api/Auth/Login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:USER,password:PASS})});
  tokenCache={accessToken:d.data.accessToken,refreshToken:d.data.refreshToken,expiresAt:Date.now()+44*60*1000};
  return tokenCache.accessToken;
}
async function authGet(p){ const token=await login(); return apiFetch(p,{headers:{Authorization:`Bearer ${token}`}}); }
async function reverse(lat,lon){
  const u=new URL('https://nominatim.openstreetmap.org/reverse');
  u.searchParams.set('format','jsonv2');u.searchParams.set('lat',lat);u.searchParams.set('lon',lon);u.searchParams.set('zoom','10');u.searchParams.set('addressdetails','1');
  const r=await fetch(u,{headers:{'User-Agent':'VakitNamazWeb/1.0 contact@example.invalid'}}); if(!r.ok) throw new Error('Konum servisi cevap vermedi.');
  const d=await r.json(); const a=d.address||{};
  return {province:a.state||a.province||a.region||'',district:a.county||a.town||a.municipality||a.city_district||a.city||''};
}
async function resolveDiyanet(province,district){
  const key=norm(province)+'|'+norm(district);
  if(cache.has('place:'+key)) return cache.get('place:'+key);
  const states = statesCache.data && Date.now()<statesCache.expiresAt ? statesCache.data : (await authGet('/api/Place/States')).data;
  statesCache={data:states,expiresAt:Date.now()+7*24*3600*1000};
  const state=states.find(x=>norm(x.name)===norm(province)||norm(x.code)===norm(province));
  if(!state) throw new Error(`Diyanet il kaydı bulunamadı: ${province}`);
  let cities=citiesCache.get(state.id);
  if(!cities){ cities=(await authGet(`/api/Place/Cities/${state.id}`)).data; citiesCache.set(state.id,cities); }
  let city=cities.find(x=>norm(x.name)===norm(district)||norm(x.code)===norm(district));
  if(!city){
    const dnorm=norm(district); city=cities.find(x=>norm(x.name).includes(dnorm)||dnorm.includes(norm(x.name)));
  }
  if(!city) throw new Error(`Diyanet ilçe kaydı bulunamadı: ${district} / ${province}`);
  const detail=(await authGet(`/api/Place/CityDetail/${city.id}`)).data;
  const result={id:city.id,name:city.name,province:state.name,qiblaAngle:Number(detail.qiblaAngle)||null,distanceToKaaba:detail.distanceToKaaba||null};
  cache.set('place:'+key,result); return result;
}
async function today(lat,lon){
  const key=`today:${lat.toFixed(2)}:${lon.toFixed(2)}:${new Date().toISOString().slice(0,10)}`;
  if(cache.has(key)) return cache.get(key);
  const geo=await reverse(lat,lon); const place=await resolveDiyanet(geo.province,geo.district);
  const prayer=(await authGet(`/api/PrayerTime/Daily/${place.id}`)).data?.[0];
  if(!prayer) throw new Error('Diyanet günlük vakit döndürmedi.');
  const out={source:'Diyanet Awqat Salah',automatic:true,location:{province:geo.province,district:geo.district,latitude:lat,longitude:lon},place,prayers:{imsak:prayer.fajr,gunes:prayer.sunrise,ogle:prayer.dhuhr,ikindi:prayer.asr,aksam:prayer.maghrib,yatsi:prayer.isha},meta:{gregorianDate:prayer.gregorianDateLong,gregorianDateIso:prayer.gregorianDateLongIso8601,hijriDate:prayer.hijriDateLong,qiblaTime:prayer.qiblaTime,timeZone:prayer.greenwichMeanTimeZone}};
  cache.set(key,out); return out;
}
const index=fs.readFileSync(path.join(__dirname,'public','index.html'));
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host}`);
    if(req.method==='GET' && u.pathname==='/api/health') return json(res,200,{ok:true,diyanetConfigured:!!(USER&&PASS)});
    if(req.method==='GET' && u.pathname==='/api/today'){
      const lat=Number(u.searchParams.get('lat')),lon=Number(u.searchParams.get('lon'));
      if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180) return json(res,400,{error:'Geçersiz koordinat.'});
      return json(res,200,await today(lat,lon));
    }
    if(req.method==='GET' && u.pathname==='/api/qibla'){
      const lat=Number(u.searchParams.get('lat')),lon=Number(u.searchParams.get('lon'));
      const bearing=(Math.atan2(Math.sin((39.8262-lon)*Math.PI/180),Math.cos(lat*Math.PI/180)*Math.tan(21.4225*Math.PI/180)-Math.sin(lat*Math.PI/180)*Math.cos((39.8262-lon)*Math.PI/180))*180/Math.PI+360)%360;
      return json(res,200,{bearing});
    }
    if(req.method==='GET' && (u.pathname==='/'||u.pathname==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(index)}
    res.writeHead(404);res.end('Not found');
  }catch(e){ console.error(e); json(res,500,{error:e.message}); }
});
server.listen(PORT,()=>console.log(`Vakit web: http://localhost:${PORT}`));
