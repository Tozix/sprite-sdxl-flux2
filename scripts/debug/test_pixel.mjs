import sharp from 'sharp';
// replicate rasterize: transparentize -> resize -> hardenAlpha
const src = 'output/isometric/spider/masters/master-front-left.png';
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W=info.width,H=info.height,C=info.channels;
// createChromaMask (approx green flood from borders)
function isChroma(r,g,b){return g>80&&g>r*1.3&&g>b*1.3;}
const mask=new Uint8Array(W*H);const q=new Int32Array(W*H);let rp=0,wp=0;
function push(p){if(p<0||p>=W*H||mask[p])return;const o=p*C;if(!isChroma(data[o],data[o+1],data[o+2]))return;mask[p]=1;q[wp++]=p;}
for(let x=0;x<W;x++){push(x);push((H-1)*W+x);}for(let y=0;y<H;y++){push(y*W);push(y*W+W-1);}
while(rp<wp){const p=q[rp++];const x=p%W,y=(p/W)|0;if(x>0)push(p-1);if(x<W-1)push(p+1);if(y>0)push(p-W);if(y<H-1)push(p+W);}
const rgba=Buffer.from(data);
for(let p=0;p<mask.length;p++){const o=p*C;if(mask[p]){rgba[o]=rgba[o+1]=rgba[o+2]=0;rgba[o+3]=0;}else rgba[o+3]=255;}

// count components at full res (alpha)
function comps(buf,w,h,c,alphaThresh){
  const m=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*c;if(buf[i+3]>alphaThresh)m[y*w+x]=1;}
  const cm=new Int32Array(w*h).fill(-1);const sizes=[];let n=0;const st=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const idx=y*w+x;if(m[idx]&&cm[idx]===-1){const id=n++;let s=0;st.push(idx);cm[idx]=id;while(st.length){const cur=st.pop();s++;const cx=cur%w,cy=(cur/w)|0;for(const[nx,ny]of[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){if(nx<0||ny<0||nx>=w||ny>=h)continue;const ni=ny*w+nx;if(m[ni]&&cm[ni]===-1){cm[ni]=id;st.push(ni);}}}sizes.push(s);}}
  return sizes.sort((a,b)=>b-a);
}
console.log('FULL RES components (alpha>90):', comps(rgba,W,H,C,90).slice(0,5));

// now resize to 160 and harden
const rs = await sharp(rgba,{raw:{width:W,height:H,channels:C}}).resize(160,160,{fit:'fill',kernel:sharp.kernel.lanczos3}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const rsBuf=Buffer.from(rs.data);
// harden alpha 90
for(let o=0;o<rsBuf.length;o+=4) rsBuf[o+3]=rsBuf[o+3]>=90?255:0;
console.log('160px harden90 components:', comps(rsBuf,160,160,4,128).slice(0,8));
// harden alpha 40
const rs2=Buffer.from(rs.data);for(let o=0;o<rs2.length;o+=4) rs2[o+3]=rs2[o+3]>=40?255:0;
console.log('160px harden40 components:', comps(rs2,160,160,4,128).slice(0,8));
