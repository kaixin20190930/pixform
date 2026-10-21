import { handleGeneration } from "@/lib/generate";
export async function POST(request: Request) { return handleGeneration(request); }
