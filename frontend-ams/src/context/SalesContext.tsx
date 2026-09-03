import { createContext, useContext, useReducer, useRef, type ReactNode } from "react";
import type { ChatMessage, EvidenceUpdate, ToolEvent } from "../types";

interface SalesState {
  messages: ChatMessage[];
  toolEvents: ToolEvent[];
  evidenceByZone: Record<string, EvidenceUpdate>;
  isStreaming: boolean;
  sessionId: string | null;
  selectedCustomerId: string | null;
  selectedChillerId: string | null;
}

type Action =
  | { type: "SELECT_CUSTOMER"; customerId: string | null }
  | { type: "SELECT_CHILLER"; chillerId: string | null }
  | { type: "STREAM_START"; userMessage: string }
  | { type: "ASSISTANT_DELTA"; text: string }
  | { type: "TOOL_START"; event: ToolEvent }
  | { type: "TOOL_RESULT"; tool: string; result: unknown; latency_ms: number; query_insight: unknown; round: number }
  | { type: "EVIDENCE_UPDATE"; update: EvidenceUpdate }
  | { type: "DONE"; sessionId: string | null }
  | { type: "ERROR"; message: string }
  | { type: "CLEAR" };

function reducer(state: SalesState, action: Action): SalesState {
  switch (action.type) {
    case "SELECT_CUSTOMER":
      return { ...state, selectedCustomerId: action.customerId };
    case "SELECT_CHILLER":
      return { ...state, selectedChillerId: action.chillerId };
    case "STREAM_START":
      return {
        ...state,
        isStreaming: true,
        messages: [
          ...state.messages,
          { id: crypto.randomUUID(), role: "user", content: action.userMessage },
        ],
      };
    case "ASSISTANT_DELTA": {
      const last = state.messages.length > 0 ? state.messages[state.messages.length - 1] : undefined;
      if (last?.role === "assistant") {
        return {
          ...state,
          messages: [
            ...state.messages.slice(0, -1),
            { ...last, content: last.content + action.text },
          ],
        };
      }
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: crypto.randomUUID(), role: "assistant", content: action.text },
        ],
      };
    }
    case "TOOL_START":
      return { ...state, toolEvents: [...state.toolEvents, action.event] };
    case "TOOL_RESULT": {
      const updated = state.toolEvents.map((e) =>
        e.tool === action.tool && !e.result
          ? {
              ...e,
              result: action.result as Record<string, unknown>,
              latency_ms: action.latency_ms,
              query_insight: action.query_insight as ToolEvent["query_insight"],
              round: action.round,
            }
          : e
      );
      return { ...state, toolEvents: updated };
    }
    case "EVIDENCE_UPDATE":
      return {
        ...state,
        evidenceByZone: {
          ...state.evidenceByZone,
          [action.update.zone]: action.update,
        },
      };
    case "DONE":
      return { ...state, isStreaming: false, sessionId: action.sessionId ?? state.sessionId };
    case "ERROR":
      return {
        ...state,
        isStreaming: false,
        messages: [
          ...state.messages,
          { id: crypto.randomUUID(), role: "assistant", content: `⚠️ Error: ${action.message}` },
        ],
      };
    case "CLEAR":
      return {
        ...state,
        messages: [],
        toolEvents: [],
        evidenceByZone: {},
        sessionId: null,
        isStreaming: false,
      };
    default:
      return state;
  }
}

const initialState: SalesState = {
  messages: [],
  toolEvents: [],
  evidenceByZone: {},
  isStreaming: false,
  sessionId: null,
  selectedCustomerId: null,
  selectedChillerId: null,
};

interface SalesContextValue extends SalesState {
  sendMessage: (message: string, customerId?: string | null) => void;
  sendReaction: (opportunityId: string, reaction: "thumbs_up" | "thumbs_down") => Promise<void>;
  selectCustomer: (customerId: string | null) => void;
  selectChiller: (chillerId: string | null) => void;
  clearChat: () => void;
}

const SalesContext = createContext<SalesContextValue | null>(null);

export function SalesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  function selectCustomer(customerId: string | null) {
    dispatch({ type: "SELECT_CUSTOMER", customerId });
  }

  function selectChiller(chillerId: string | null) {
    dispatch({ type: "SELECT_CHILLER", chillerId });
  }

  function clearChat() {
    dispatch({ type: "CLEAR" });
  }

  async function sendMessage(message: string, customerId?: string | null) {
    if (state.isStreaming) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    dispatch({ type: "STREAM_START", userMessage: message });

    const body: Record<string, unknown> = { message };
    const cid = customerId ?? state.selectedCustomerId;
    if (cid) body.customer_id = cid;

    try {
      const res = await fetch("/api/sales/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        dispatch({ type: "ERROR", message: `Server error ${res.status}` });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let eventType = "";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            if (line.startsWith("data: ")) dataLine = line.slice(6).trim();
          }
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine);
            switch (eventType) {
              case "assistant_delta":
                dispatch({ type: "ASSISTANT_DELTA", text: payload.text ?? "" });
                break;
              case "tool_start":
                dispatch({
                  type: "TOOL_START",
                  event: {
                    id: crypto.randomUUID(),
                    tool: payload.tool,
                    args: payload.args ?? {},
                    timestamp: Date.now(),
                    round: payload.round,
                    pattern: payload.pattern,
                  },
                });
                break;
              case "tool_result":
                dispatch({
                  type: "TOOL_RESULT",
                  tool: payload.tool,
                  result: payload.result,
                  latency_ms: payload.latency_ms ?? 0,
                  query_insight: payload.query_insight,
                  round: payload.round,
                });
                break;
              case "evidence_update":
                dispatch({ type: "EVIDENCE_UPDATE", update: payload });
                break;
              case "done":
                dispatch({ type: "DONE", sessionId: payload.session_id ?? null });
                break;
              case "error":
                dispatch({ type: "ERROR", message: payload.message ?? "Unknown error" });
                break;
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        dispatch({ type: "ERROR", message: (err as Error).message });
      }
    }
  }

  async function sendReaction(opportunityId: string, reaction: "thumbs_up" | "thumbs_down") {
    await fetch("/api/sales/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunity_id: opportunityId, reaction }),
    });
  }

  return (
    <SalesContext.Provider
      value={{ ...state, sendMessage, sendReaction, selectCustomer, selectChiller, clearChat }}
    >
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error("useSales must be used within SalesProvider");
  return ctx;
}
