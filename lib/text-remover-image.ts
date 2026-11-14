import { encode } from "fast-png";
import { coloringImage } from "./coloring-image.ts";
export function textImages(input: Uint8Array, mask: Uint8Array) {
  const image=coloringImage(input,1024), selection=coloringImage(mask,1024);
  if(image.width!==selection.width || image.height!==selection.height || ![3,4].includes(image.channels) || ![3,4].includes(selection.channels)) throw new Error("Use matching RGB PNG images.");
  for(const im of [image,selection]){if(im.channels===4){const rgb=new Uint8Array(im.width*im.height*3);for(let i=0;i<im.width*im.height;i++){if(im.data[i*4+3]!==255)throw new Error("Use opaque prepared images.");for(let c=0;c<3;c++)rgb[i*3+c]=im.data[i*4+c];}im.data=rgb;im.channels=3;}}
  let selected=0;
  for(let i=0;i<selection.data.length;i+=3){const v=selection.data[i];if(![0,255].includes(v)||selection.data[i+1]!==v||selection.data[i+2]!==v)throw new Error("Use a black and white mask.");if(v===255)selected++;}
  if(!selected || selected===image.width*image.height)throw new Error("Brush over some text, not the whole image.");
  return {image,selection};
}
export function mergeTextResult(input: Uint8Array, mask: Uint8Array, result: Uint8Array) {
  const {image,selection}=textImages(input,mask), output=coloringImage(result,1024);
  if(output.width!==image.width||output.height!==image.height||![3,4].includes(output.channels))throw new Error("Unexpected result dimensions.");
  const data=new Uint8Array(image.data);
  for(let i=0;i<image.width*image.height;i++)if(selection.data[i*3]===255)for(let c=0;c<3;c++)data[i*3+c]=output.data[i*output.channels+c];
  return encode({width:image.width,height:image.height,data,channels:3,depth:8});
}
