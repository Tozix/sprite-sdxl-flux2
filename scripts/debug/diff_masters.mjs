import sharp from 'sharp';
const a = await sharp('output/isometric/spider/source-ai/masters/master-front-left.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const b = await sharp('output/isometric/spider/masters/master-front-left.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=a.info.width,H=a.info.height,C=a.info.channels;
// count pixels where alpha or rgb differ significantly
let diff=0; let maxd=0;
const rows=[];
for(let y=0;y<H;y++){let rdiff=0;
  for(let x=0;x<W;x++){const i=(y*W+x)*C;
    const dr=Math.abs(a.data[i]-b.data[i]),dg=Math.abs(a.data[i+1]-b.data[i+1]),db=Math.abs(a.data[i+2]-b.data[i+2]),da=Math.abs(a.data[i+3]-b.data[i+3]);
    const d=Math.max(dr,dg,db,da);
    if(d>40){diff++;rdiff++;}
    if(d>maxd)maxd=d;
  }
  rows.push(rdiff);
}
console.log(`diff>40 px=${diff} maxDelta=${maxd}`);
// find rows with most diff
const top=rows.map((n,y)=>({y,n})).sort((p,q)=>q.n-p.n).slice(0,6);
for(const t of top) console.log(`  y=${t.y} changed=${t.n}`);
