import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseBearerToken } from "@/lib/server/firebaseAdmin";
import { getBudgetScopedData } from "@/lib/server/transactionsRepository";
import { buildForecastSet } from "@/lib/server/transactionsInsights";

const SUPPORTED_HORIZONS = new Set([30, 60, 90]);

function parseHorizons(daysParam: string | null): number[] {
  if (!daysParam) return [30, 60, 90];

  const parsed = Number.parseInt(daysParam, 10);
  if (Number.isNaN(parsed) || !SUPPORTED_HORIZONS.has(parsed)) {
    throw new Error("Invalid days query parameter. Supported values are 30, 60, or 90.");
  }

  return [parsed];
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";

  if (message.includes("Authorization") || message.includes("ID token")) {
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (message === "Budget not found") {
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  }

  if (message.startsWith("Invalid days")) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const budgetId = request.nextUrl.searchParams.get("budgetId");
    if (!budgetId) {
      return NextResponse.json({ error: "Missing required budgetId query parameter" }, { status: 400 });
    }

    const horizons = parseHorizons(request.nextUrl.searchParams.get("days"));
    const userId = await verifyFirebaseBearerToken(request.headers.get("authorization"));
    const { transactions } = await getBudgetScopedData(userId, budgetId);

    const predictions = buildForecastSet(transactions, horizons);
    return NextResponse.json({
      budgetId,
      generatedAt: new Date().toISOString(),
      predictions,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
