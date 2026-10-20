import { ImageResponse } from "next/og";
export const alt = "Image to Image AI · Pixform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", background: "white", color: "black", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64, fontWeight: 500 }}>Image to Image AI · Pixform</div>, size);
}
