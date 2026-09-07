import { readdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
async function walk(dir, ext, base=dir, out=[]) { for (const n of await readdir(dir,{withFileTypes:true})) { const p=path.join(dir,n.name); if(n.isDirectory()) await walk(p,ext,base,out); else if(n.name.endsWith(ext)) out.push(path.relative(base,p).replace(ext,'')); } return out; }
const uni=await walk(path.resolve(root,'../uni-app/pages'),'.vue');
const taro=await walk(path.resolve(root,'src'),'.tsx');
const missing=uni.filter(p=>!taro.some(x=>x.endsWith(p)||x.endsWith(p.replaceAll('/','-'))));
console.log(JSON.stringify({uniPages:uni.length,taroPages:taro.length,missingCount:missing.length,missing},null,2));
