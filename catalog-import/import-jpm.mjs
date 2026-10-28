#!/usr/bin/env node
// JPM catalog importer. Node.js 20+, no dependencies. Run from repository root.
import fs from "node:fs/promises";
import path from "node:path";
const ROOT = "https://jpm.kz";
const OUT = path.resolve("catalog-import/jpm-products.js");
const REPORT = path.resolve("catalog-import/import-report.json");
const DELAY_MS = Number(process.env.JPM_DELAY_MS || 500);
const MAX_PAGES = Number(process.env.JPM_MAX_PAGES || 100);
const UA = "GTShopCatalogImporter/1.0 (respectful catalog maintenance)";
const seeds = ["/collection/all","/collection/sbornye-modeli","/collection/odezhda-atributika","/collection/aksessuary","/collection/diski","/collection/interer","/collection/dvigatel","/collection/podveska","/collection/tormoznaya-sistema","/collection/transmissiya","/collection/eksterer","/collection/elektronika","/collection/4x4","/collection/silikonovye-patrubki-shlangi-homuty","/collection/bampery-spoylery-kapoty-obvesy"];
const sleep = ms => new Promise(r => setTimeout(r,ms));
const abs = u => { try { return new URL(u,ROOT).href.split("#")[0]; } catch { return ""; } };
const dec = s => String(s||"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">");
const strip = s => dec(String(s||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ")).trim();
const attr = (tag,n) => { const re = new RegExp("\\b"+n+"\\s*=\\s*([\"'])([\\s\\S]*?)\\1","i"); return dec(tag.match(re)?.[2]||""); };
async function get(url) {
 const res = await fetch(url,{headers:{"user-agent":UA,"accept-language":"ru,en;q=0.8"}});
 if (!res.ok) throw new Error("HTTP "+res.status+" "+url);
 return res.text();
}
function getCategories(html) {
 const out = new Set(seeds);
 for (const m of html.matchAll(/href\s*=\s*["']([^"']*\/collection\/[^"'?#]+)["']/gi)) {
  const u = new URL(dec(m[1]),ROOT);
  if (!u.pathname.includes("/product/") && !u.pathname.endsWith(".json")) out.add(u.pathname.replace(/\/+$/,""));
 }
 return [...out].filter(p => p !== "/collection/all");
}
function classify(url,title) {
 const s=(url+" "+title).toLowerCase();
 if (/sbornye-model|model|сборн|коллекционн/.test(s)) return ["models","Сборные модели"];
 if (/diski|koles|wheel|колёс|колес/.test(s)) return ["wheels","Диски и колёса"];
 if (/odezhda|atribut|футбол|худи|кепк/.test(s)) return ["clothing","Одежда и атрибутика"];
 if (/aksessuar|брелок|ремув|рюкзак|чехол/.test(s)) return ["accessories","Аксессуары"];
 if (/obves|bamper|spoyler|kapot|bodykit|спойлер|бампер/.test(s)) return ["bodykits","Обвесы"];
 if (/podves|suspension/.test(s)) return ["suspension","Подвеска"];
 if (/tormoz|brake/.test(s)) return ["brakes","Тормоза"];
 if (/transmiss|korob|сцеплен/.test(s)) return ["transmission","Трансмиссия"];
 if (/dvigatel|vpus|turbin|intercool|engine|впуск|турбин/.test(s)) return ["engine","Двигатель и впуск"];
 if (/patrub|shlang|homut|hose|силикон/.test(s)) return ["hoses","Патрубки и шланги"];
 if (/4x4|offroad|внедорож/.test(s)) return ["offroad","4×4"];
 if (/interer|salon|коврик|руль|сидень/.test(s)) return ["interior","Интерьер"];
 if (/elektr|svet|far|led|electronic|прибор|датчик/.test(s)) return ["electronics","Электроника"];
 if (/ekster|vnesh|наруж|emblem|nakladk/.test(s)) return ["exterior","Экстерьер"];
 if (/vyhlop|vypusk|glushitel|exhaust/.test(s)) return ["exhaust","Выхлоп"];
 return ["accessories","Автотовары"];
}
function stableId(url) { let h=2166136261; for (const c of url) h=Math.imul(h^c.charCodeAt(0),16777619); return 10000+((h>>>0)%2000000000); }
function parseProducts(html,catUrl) {
 const found=new Map();
 const re=/<a\b[^>]*href\s*=\s*["']([^"']*\/product\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
 for (const m of html.matchAll(re)) {
  const url=abs(dec(m[1]));
  if (!url || !url.startsWith(ROOT) || found.has(url)) continue;
  const chunk=html.slice(Math.max(0,m.index-1800),Math.min(html.length,m.index+m[0].length+2200));
  const tag=m[0].slice(0,m[0].indexOf(">")+1);
  const img=chunk.match(/<img\b[^>]*>/i)?.[0]||"";
  const title=strip(m[2])||attr(tag,"title")||attr(tag,"aria-label")||attr(img,"alt");
  if (!title || title.length<3) continue;
  const image=abs(attr(img,"data-src")||attr(img,"data-original")||attr(img,"src")||attr(img,"srcset").split(",")[0].trim().split(" ")[0]);
  const txt=strip(chunk);
  const pm=txt.match(/(?:от\s*)?([\d][\d\s\u00a0]{2,})(?:[,.]\d{1,2})?\s*(?:₸|тг\.?)/i);
  const price=pm?Number(pm[1].replace(/[^\d]/g,"")):0;
  const sold=/распродано|нет в наличии|sold out/i.test(txt);
  const c=classify(catUrl,title);
  found.set(url,{id:stableId(url),name:title.replace(/\s+/g," ").trim(),short:"Товар из каталога JPM — проверь параметры перед заказом",price,category:c[0],categoryLabel:c[1],badge:price?"JPM · цена на дату импорта":"JPM · цена по запросу",stock:sold?0:1,availability:sold?"На странице источника отмечена распродажа; перепроверь":"Наличие нужно подтвердить у продавца",image,description:"Импортированная карточка JPM. Цена и остатки могут измениться. Совместимость и комплектность уточни у продавца.",specs:[["Источник","JPM Tuning Market"],["Цена при импорте",price?price+" ₸":"Не распознана — уточнить"],["Дата импорта",new Date().toISOString().slice(0,10)]],featured:false,tags:(title+" "+c[1]+" JPM").toLowerCase(),sourceUrl:url,sourceCategory:abs(catUrl),importedAt:new Date().toISOString()});
 }
 return [...found.values()];
}
const sitemap=await get(ROOT+"/page/sitemap").catch(()=> "");
const cats=getCategories(sitemap);
const products=new Map(), errors=[];
let requestCount=0;
for (const cat of cats) {
 for (let page=1;page<=MAX_PAGES;page++) {
  const url=ROOT+cat+(page===1?"":(cat.includes("?")?"&":"?")+"page="+page);
  try {
   const html=await get(url); requestCount++;
   const rows=parseProducts(html,ROOT+cat);
   if (!rows.length) break;
   for (const p of rows) if (!products.has(p.sourceUrl)) products.set(p.sourceUrl,p);
  } catch(e) { errors.push({url,error:String(e)}); break; }
  await sleep(DELAY_MS);
 }
}
const list=[...products.values()].sort((a,b)=>a.name.localeCompare(b.name,"ru"));
await fs.mkdir(path.dirname(OUT),{recursive:true});
await fs.writeFile(OUT,"/* Generated by import-jpm.mjs. Last import: "+new Date().toISOString()+" */\nwindow.JPM_CATALOG_PRODUCTS = "+JSON.stringify(list,null,2)+";\n","utf8");
const report={source:ROOT,generatedAt:new Date().toISOString(),categoryCount:cats.length,requestCount,productCount:list.length,errors,categories:cats.map(c=>ROOT+c)};
await fs.writeFile(REPORT,JSON.stringify(report,null,2)+"\n","utf8");
console.log("Imported "+list.length+" unique products from "+cats.length+" category URLs ("+requestCount+" requests).");
console.log("Wrote "+OUT+" and "+REPORT+".");
if (!list.length) { console.error("No products found. Check network access, markup, robots.txt, and site terms."); process.exitCode=2; }
