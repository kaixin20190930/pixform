import type { FaceBox } from "./multiple-image";
import type { FaceDetector } from "@mediapipe/tasks-vision";
let detector:Promise<FaceDetector>|undefined;
async function loadDetector(){
  // Group photos can contain clear faces below 0.5 confidence; keep them selectable.
  if(!detector)detector=import("@mediapipe/tasks-vision").then(async({FaceDetector,FilesetResolver})=>FaceDetector.createFromOptions(await FilesetResolver.forVisionTasks("/models/vision"),{baseOptions:{modelAssetPath:"/models/blaze-face.tflite",delegate:"CPU"},runningMode:"IMAGE",minDetectionConfidence:.3})).catch(e=>{detector=undefined;throw e;});
  return detector;
}
export async function prepareFacePhoto(file:File):Promise<{file:File;url:string;boxes:FaceBox[];width:number;height:number}>{
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||!file.size||file.size>10*1024*1024)throw new Error("Choose a JPG, PNG or WEBP photo under 10 MB.");
  const bitmap=await createImageBitmap(file);try{
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Your browser couldn't open this photo.");ctx.drawImage(bitmap,0,0,width,height);
    const model=await loadDetector();const detections=model.detect(canvas).detections;
    const boxes=detections.flatMap(d=>{const b=d.boundingBox;if(!b)return [];const x=Math.max(0,Math.floor(b.originX)),y=Math.max(0,Math.floor(b.originY));const width=Math.min(canvas.width-x,Math.ceil(b.width)),height=Math.min(canvas.height-y,Math.ceil(b.height));return width>=40&&height>=40?[{x,y,width,height}]:[];}).sort((a,b)=>a.x-b.x||a.y-b.y);
    if(!boxes.length)throw new Error("No clear faces found. Try a larger, front-facing group photo.");if(boxes.length>40)throw new Error("Choose a smaller group photo.");
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Couldn't prepare your photo.")),"image/png"));if(blob.size>10*1024*1024)throw new Error("This photo is too detailed to process. Try a smaller image.");
    return {file:new File([blob],"photo.png",{type:"image/png"}),url:URL.createObjectURL(blob),boxes,width,height};
  }finally{bitmap.close();}
}
