import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { firstErrorMessage, settingsUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = settingsUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const settings = await updateSettings(parsed.data);
  return NextResponse.json(settings);
}
