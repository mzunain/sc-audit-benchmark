import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "..", "output", "presentation_data.json");
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Data not found" }, { status: 404 });
  }
}
