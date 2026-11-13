import { decode, encode } from "fast-png";

// Bound dimensions before decoding to avoid decompressing an oversized image.
export function coloringImage(bytes: Uint8Array, maxSide = 1600) {
  const b = Buffer.from(bytes);
  if (b.length < 33 || b.subarray(0,8).toString("hex") !== "89504e470d0a1a0a" || b.toString("ascii",12,16) !== "IHDR") throw new Error("Use a standard PNG image.");
  const width = b.readUInt32BE(16), height = b.readUInt32BE(20);
  if (!width || !height || width > maxSide || height > maxSide || width * height > 1048576) throw new Error("Image dimensions are too large.");
  const image = decode(bytes, { checkCrc: true });
  if (image.depth !== 8 || image.palette || ![1,2,3,4].includes(image.channels)) throw new Error("Use an 8-bit PNG image.");
  return image;
}

export function blackWhitePng(bytes: Uint8Array) {
  const image = coloringImage(bytes);
  const data = new Uint8Array(image.width * image.height * 3);
  let black = 0;
  for (let i = 0; i < image.width * image.height; i++) {
    const pos = i * image.channels;
    const gray = image.channels <= 2 ? image.data[pos] : .299 * image.data[pos] + .587 * image.data[pos+1] + .114 * image.data[pos+2];
    const alpha = image.channels === 2 || image.channels === 4 ? image.data[pos+image.channels-1] / 255 : 1;
    const value = gray * alpha + 255 * (1-alpha) >= 200 ? 255 : 0;
    if (!value) black++;
    data.fill(value, i*3, i*3+3);
  }
  if (black === 0 || black === image.width * image.height) throw new Error("The model returned an empty image.");
  return encode({ width: image.width, height: image.height, data, depth: 8, channels: 3 }, { zlib: { level: 3 } });
}
