import { ImageResponse } from "next/og";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", background: "#292d25", color: "#d7ef8a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700 }}>p</div>, size);
}
