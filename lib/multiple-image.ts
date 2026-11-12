import { decode, encode } from "fast-png";
import jpeg from "jpeg-js";

export type FaceBox = { x: number; y: number; width: number; height: number };
export type Raster = { width: number; height: number; data: Uint8Array };
export const MAX_SIDE = 1600;
export function decodePng(bytes: Uint8Array): Raster {
  const b = Buffer.from(bytes);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString("ascii", 12, 16) !== "IHDR") throw new Error("Upload a normalized PNG photo.");
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  if (!w || !h || w > MAX_SIDE || h > MAX_SIDE) throw new Error("Photos must be at most 1600 pixels on each side.");
  const image=decode(bytes,{checkCrc:true});
  if(image.depth!==8||![3,4].includes(image.channels)||image.palette)throw new Error("Use a standard RGB or RGBA PNG photo.");
  if(image.channels===4)return {width:w,height:h,data:new Uint8Array(image.data)};
  const data=new Uint8Array(w*h*4);for(let i=0;i<w*h;i++){data.set(image.data.subarray(i*3,i*3+3),i*4);data[i*4+3]=255;}
  return {width:w,height:h,data};
}
export function encodePng(image: Raster): Uint8Array {
  return encode({...image,depth:8,channels:4},{zlib:{level:3}});
}
export function checkedBoxes(value: unknown, width: number, height: number): FaceBox[] {
  if (!Array.isArray(value) || !value.length || value.length > 40) throw new Error("Detect the faces again before swapping.");
  const boxes: FaceBox[] = value.map(b => {
    if (!b || ![b.x,b.y,b.width,b.height].every(Number.isInteger) || b.x < 0 || b.y < 0 || b.width < 40 || b.height < 40 || b.x+b.width > width || b.y+b.height > height) throw new Error("A face is too small or outside the photo. Try a clearer photo.");
    return {x:b.x,y:b.y,width:b.width,height:b.height};
  });
  return boxes;
}
export function cropBox(face: FaceBox, width: number, height: number): FaceBox {
  const x=Math.max(0,Math.floor(face.x-face.width*.25)),y=Math.max(0,Math.floor(face.y-face.height*.25));
  return {x,y,width:Math.min(width,Math.ceil(face.x+face.width*1.25))-x,height:Math.min(height,Math.ceil(face.y+face.height*1.25))-y};
}
export function selectedCrops(boxes: FaceBox[], selected: unknown, width:number,height:number): FaceBox[] {
  if (!Array.isArray(selected) || !selected.length || selected.length>5 || new Set(selected).size!==selected.length || !selected.every(i=>Number.isInteger(i)&&i>=0&&i<boxes.length)) throw new Error("Select between one and five different faces.");
  const crops=selected.map(i=>cropBox(boxes[i],width,height));
  for (let n=0;n<crops.length;n++) {
    const c=crops[n];
    for(let i=0;i<boxes.length;i++) if(i!==selected[n]) {
      const b=boxes[i]; const overlap=Math.max(0,Math.min(c.x+c.width,b.x+b.width)-Math.max(c.x,b.x))*Math.max(0,Math.min(c.y+c.height,b.y+b.height)-Math.max(c.y,b.y));
      if(overlap>0) throw new Error("These faces are too close to isolate safely. Choose a more spaced-out group photo.");
    }
    for(let j=0;j<n;j++) {const b=crops[j];if(Math.min(c.x+c.width,b.x+b.width)>Math.max(c.x,b.x)&&Math.min(c.y+c.height,b.y+b.height)>Math.max(c.y,b.y)) throw new Error("Selected face regions overlap. Try another group photo.");}
  }
  return crops;
}
export function extract(image:Raster,box:FaceBox): Raster {
  const data=new Uint8Array(box.width*box.height*4);
  for(let y=0;y<box.height;y++) data.set(image.data.subarray(((box.y+y)*image.width+box.x)*4,((box.y+y)*image.width+box.x+box.width)*4),y*box.width*4);
  return {width:box.width,height:box.height,data};
}
export function decodeResult(bytes:Uint8Array):Raster {
  if(bytes[0]===137)return decodePng(bytes);
  return jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:4,maxMemoryUsageInMB:48,tolerantDecoding:false});
}
// Only selected rectangles are written. PNG encoding preserves every other decoded pixel.
export function pasteResult(base:Raster,patch:Raster,box:FaceBox) {
  if(patch.width!==box.width||patch.height!==box.height)throw new Error("The model changed the crop dimensions.");
  for(let y=0;y<box.height;y++)for(let x=0;x<box.width;x++) {
    const edge=Math.min(x,y,box.width-1-x,box.height-1-y);const alpha=Math.min(1,edge/8);
    const dst=((box.y+y)*base.width+box.x+x)*4,src=(y*patch.width+x)*4;
    for(let c=0;c<3;c++)base.data[dst+c]=Math.round(base.data[dst+c]*(1-alpha)+patch.data[src+c]*alpha);
  }
}
