import sharp from 'sharp';
const a = await sharp('output/isometric/spider/source-ai/masters/master-front-left.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const b = await sharp('output/isometric/spider/masters/master-front-left.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=a.info.width,H=a.info.height,C=a.info.channels;
function isGreen(data,i){const r=data[i],g=data[i+1],bl=data[i+2];return g>80&&g>r*1.3&&g>bl*1.3;}
// pixels that were OBJECT in source-ai (not green) but became GREEN in masters (background)
const eaten=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*C;
  const aGreen=isGreen(a.data,i), bGreen=isGreen(b.data,i);
  if(!aGreen && bGreen) eaten.push([x,y]);
}
console.log(`eaten (obj->green) px=${eaten.length}`);
// cluster eaten pixels by proximity to find "leg" regions
// simple: report bbox of eaten region
if(eaten.length){let minx=W,miny=H,maxx=0,maxy=0;for(const[x,y]of eaten){if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;}
console.log(`eaten bbox=[${minx},${miny},${maxx},${maxy}]`);}
// also: pixels that were OBJECT in source and became GREEN, grouped by connected components
