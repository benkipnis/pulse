#!/usr/bin/env node
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRerankQuery, isRerankStageError } from "../../backend/src/lib/rerank.js";

describe("buildRerankQuery", () => {
  it("returns the raw query when no operational context is present", () => {
    assert.equal(buildRerankQuery("motor temperature"), "motor temperature");
  });

  it("prepends instruction-following context for model, alarms, and subsystem", () => {
    const text = buildRerankQuery("compressor motor temperature too high", {
      model_family: "30XA",
      alarm_codes: ["A1.01"],
      subsystem: "motor",
    });
    assert.ok(text.startsWith("Prefer passages that apply to"));
    assert.ok(text.includes("model family 30XA"));
    assert.ok(text.includes("alarm code(s) A1.01"));
    assert.ok(text.includes("subsystem motor"));
    assert.ok(text.endsWith("compressor motor temperature too high"));
  });

  it("accepts related_alarm_codes from case search filters", () => {
    const text = buildRerankQuery("condenser pressure", { related_alarm_codes: ["207"] });
    assert.ok(text.includes("alarm code(s) 207"));
  });
});

describe("isRerankStageError", () => {
  it("matches $rerank and Native Reranking failures", () => {
    assert.equal(isRerankStageError(new Error("Unrecognized pipeline stage name: '$rerank'")), true);
    assert.equal(isRerankStageError({ message: "Native Reranking is not enabled" }), true);
  });

  it("does not match unrelated hybrid-search failures", () => {
    assert.equal(isRerankStageError(new Error("index not found: knowledge_search")), false);
    assert.equal(isRerankStageError(new Error("$rankFusion is not allowed")), false);
  });
});
