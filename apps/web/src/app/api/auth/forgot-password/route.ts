import { NextResponse } from "next/server";
import { API_URL } from "@/lib/auth/api-url";

export async function POST() {
  const res = await fetch(`${API_URL}/auth/forgot-password`, { method: "POST" });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
