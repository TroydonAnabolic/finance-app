import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseBearerToken } from "@/lib/server/firebaseAdmin";
import { getBudgetScopedData } from "@/lib/server/transactionsRepository";
import {
  buildForecastPrediction,
  buildForecastSet,
  getBudgetSnapshot,
  getCategorySpendBreakdown,
  getRecentTransactions,
  pickHorizonPrediction,
  type ForecastPrediction,
  type SupportingNumber,
} from "@/lib/server/transactionsInsights";

interface ChatRequestBody {
  budgetId?: string;
  message?: string;
  preferredHorizonDays?: number;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIChatResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
  }>;
}

const MAX_MESSAGE_LENGTH = 1800;

function buildFallbackAnswer(predictions: ForecastPrediction[]): string {
  const lines = predictions.map((prediction) => {
    const sign = prediction.blended.net >= 0 ? "+" : "";
    return `${prediction.horizonDays}d: income ${prediction.blended.income}, expenses ${prediction.blended.expenses}, net ${sign}${prediction.blended.net}`;
  });

  return [
    "I used the app forecasting engine directly and summarized the latest projection below:",
    ...lines,
    "These are directional estimates, not financial advice.",
  ].join("\n");
}

function normalizePreferredHorizon(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "60"), 10);
  if (Number.isNaN(parsed)) return 60;
  if (parsed <= 45) return 30;
  if (parsed <= 75) return 60;
  return 90;
}

function safeJsonParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function toolErrorResult(name: string): Record<string, string> {
  return { error: `Unsupported tool: ${name}` };
}

async function callOpenAIChatCompletion({
  apiKey,
  model,
  messages,
  tools,
}: {
  apiKey: string;
  model: string;
  messages: OpenAIMessage[];
  tools: unknown[];
}): Promise<OpenAIChatResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
      tools,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  return (await response.json()) as OpenAIChatResponse;
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

  if (message.startsWith("Invalid request")) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyFirebaseBearerToken(request.headers.get("authorization"));
    const body = (await request.json()) as ChatRequestBody;

    const budgetId = body?.budgetId;
    const userMessage = body?.message?.trim();

    if (!budgetId || !userMessage) {
      throw new Error("Invalid request. budgetId and message are required.");
    }
    if (userMessage.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Invalid request. message must be <= ${MAX_MESSAGE_LENGTH} characters.`);
    }

    const preferredHorizon = normalizePreferredHorizon(body.preferredHorizonDays);
    const { budget, transactions, people } = await getBudgetScopedData(userId, budgetId);

    const baselinePredictions = buildForecastSet(transactions, [30, 60, 90]);
    const preferredPrediction = pickHorizonPrediction(baselinePredictions, preferredHorizon);

    const tools = [
      {
        type: "function",
        function: {
          name: "get_forecast",
          description: "Get forecast data for one horizon (30, 60, or 90 days).",
          parameters: {
            type: "object",
            properties: {
              horizonDays: {
                type: "integer",
                enum: [30, 60, 90],
              },
            },
            required: ["horizonDays"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_forecast_set",
          description: "Get all standard forecast horizons (30, 60, 90).",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_category_spend_breakdown",
          description: "Get expense category breakdown for a lookback window.",
          parameters: {
            type: "object",
            properties: {
              lookbackDays: { type: "integer", minimum: 7, maximum: 365 },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_recent_transactions",
          description: "Get recent posted transactions for context.",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "integer", minimum: 1, maximum: 25 },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_budget_snapshot",
          description: "Get top-level posted and upcoming totals for the selected budget.",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      },
    ];

    const runTool = (name: string, rawArgs: string) => {
      const args = safeJsonParse(rawArgs);

      switch (name) {
        case "get_forecast": {
          const horizonDays = normalizePreferredHorizon(args.horizonDays);
          return buildForecastPrediction(transactions, horizonDays);
        }
        case "get_forecast_set":
          return baselinePredictions;
        case "get_category_spend_breakdown": {
          const lookbackDays = Number.parseInt(String(args.lookbackDays ?? "90"), 10);
          return getCategorySpendBreakdown(transactions, Number.isNaN(lookbackDays) ? 90 : lookbackDays);
        }
        case "get_recent_transactions": {
          const limit = Number.parseInt(String(args.limit ?? "8"), 10);
          return getRecentTransactions(transactions, Number.isNaN(limit) ? 8 : limit);
        }
        case "get_budget_snapshot":
          return getBudgetSnapshot(transactions);
        default:
          return toolErrorResult(name);
      }
    };

    let answer = buildFallbackAnswer(baselinePredictions);
    let model = "deterministic-forecast";
    const usedTools = new Set<string>(["get_forecast_set"]);

    const openAiApiKey = process.env.OPENAI_API_KEY;
    const openAiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    if (openAiApiKey) {
      const messages: OpenAIMessage[] = [
        {
          role: "system",
          content: [
            "You are a transaction analytics assistant for a budgeting app.",
            "Only answer using tool outputs for numeric claims.",
            "When asked about predictions, compare 30/60/90 day horizons where useful.",
            "Be concise and practical.",
            "Always include a short caveat that forecasts are directional and not financial advice.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Budget: ${budget.name}`,
            `People in budget: ${people.length}`,
            `Transactions available: ${transactions.length}`,
            `Question: ${userMessage}`,
          ].join("\n"),
        },
      ];

      for (let iteration = 0; iteration < 4; iteration += 1) {
        const completion = await callOpenAIChatCompletion({
          apiKey: openAiApiKey,
          model: openAiModel,
          messages,
          tools,
        });

        model = completion.model || openAiModel;

        const assistantMessage = completion.choices?.[0]?.message;
        if (!assistantMessage) break;

        const toolCalls = assistantMessage.tool_calls || [];
        if (toolCalls.length === 0) {
          if (assistantMessage.content && assistantMessage.content.trim().length > 0) {
            answer = assistantMessage.content.trim();
          }
          break;
        }

        messages.push({
          role: "assistant",
          content: assistantMessage.content || "",
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          usedTools.add(toolCall.function.name);
          const result = runTool(toolCall.function.name, toolCall.function.arguments || "{}");
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      }
    }

    const predictions = baselinePredictions.map((prediction) => ({
      horizonDays: prediction.horizonDays,
      runRate: prediction.runRate,
      knownScheduled: prediction.knownScheduled,
      blended: prediction.blended,
      confidence: prediction.confidence,
    }));

    const assumptions = preferredPrediction.assumptions;
    const supportingNumbers: SupportingNumber[] = preferredPrediction.supportingNumbers;

    return NextResponse.json({
      budgetId,
      generatedAt: new Date().toISOString(),
      model,
      answer,
      assumptions,
      supportingNumbers,
      predictions,
      confidence: preferredPrediction.confidence,
      usedTools: [...usedTools],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
