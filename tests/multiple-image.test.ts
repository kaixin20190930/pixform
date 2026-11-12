import test from "node:test";
import assert from "node:assert/strict";
import {checkedBoxes,selectedCrops,decodePng,encodePng,extract,pasteResult} from "../lib/multiple-image.ts";

test("selection rejects duplicate IDs, more than five and neighboring crop overlap",()=>{
 const boxes=checkedBoxes([{x:50,y:50,width:80,height:80},{x:250,y:50,width:80,height:80}],500,300);
 assert.equal(selectedCrops(boxes,[0,1],500,300).length,2);
 assert.throws(()=>selectedCrops(boxes,[0,0],500,300));assert.throws(()=>selectedCrops(boxes,[0,1,2,3,4,5],500,300));
 const near=checkedBoxes([{x:50,y:50,width:80,height:80},{x:140,y:50,width:80,height:80}],500,300);
 assert.throws(()=>selectedCrops(near,[0],500,300),/too close/);
});
test("PNG composition leaves every pixel outside the selected original crop unchanged",()=>{
 const data=new Uint8Array(200*200*4).map((_,i)=>i%251);const base=decodePng(encodePng({width:200,height:200,data}));const before=new Uint8Array(base.data);
 const box={x:40,y:40,width:80,height:80};const patch=extract(base,box);patch.data.fill(255);pasteResult(base,patch,box);
 const result=decodePng(encodePng(base));let changedInside=0;
 for(let y=0;y<200;y++)for(let x=0;x<200;x++)for(let c=0;c<4;c++){
  const i=(y*200+x)*4+c;if(x<40||x>=120||y<40||y>=120)assert.equal(result.data[i],before[i]);else if(result.data[i]!==before[i])changedInside++;
 }assert.ok(changedInside>0);assert.throws(()=>pasteResult(base,{width:1,height:1,data:new Uint8Array(4)},box));
});
test("dimension and box checks reject oversized images and invalid coordinates before processing",()=>{
 const data=encodePng({width:2,height:2,data:new Uint8Array(16)});const forged=Buffer.from(data);forged.writeUInt32BE(50000,16);assert.throws(()=>decodePng(forged),/1600/);
 assert.throws(()=>checkedBoxes([{x:-1,y:0,width:100,height:100}],500,500));assert.throws(()=>checkedBoxes([{x:0,y:0,width:39,height:60}],500,500));
});
