import { environment } from "@/lib/cloudflare";
import { generateMultiple, multipleStatus } from "@/lib/multiple-jobs";
import { json } from "@/lib/jobs";
export async function POST(request: Request) { try { return await generateMultiple(request,await environment()); } catch { return json({error:"The image service is temporarily unavailable."},503); } }
export async function GET(request: Request) { try { return await multipleStatus(request,await environment()); } catch { return json({error:"We couldn't check the result. Please retry."},503); } }
