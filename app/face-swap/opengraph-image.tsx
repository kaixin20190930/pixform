import { ImageResponse } from "next/og";
export const alt = "AI Face Swap · Pixform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", background: "#f8f7f3", color: "#292d25", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 72 }}><div>AI Face Swap</div><div style={{fontSize:32,marginTop:30}}>Two photos. A new look. · Pixform</div></div>, size);
}
