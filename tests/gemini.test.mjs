import test from "node:test";
import assert from "node:assert/strict";
import { requestGeminiDraft } from "../src/lib/gemini.mjs";

const fields = { challengePrompt: "Find the flag", solveNotes: "Ran exiftool", recordedFlag: "CTF{found}" };
const model = "gemini-3.6-flash";
const draft = { overview: "Prompt", observations: "Metadata clue", solution: "Ran `exiftool`", result: "CTF{found}", tools: "exiftool" };

test("Gemini receives source data and a five-section JSON schema, then returns its draft", async () => {
  let called = false;
  const result = await requestGeminiDraft({ key: "test-key", model, fields }, async (url, options) => {
    called = true;
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent");
    assert.equal(options?.method, "POST");
    assert.equal(options?.headers?.["x-goog-api-key"], "test-key");
    const body = JSON.parse(options.body);
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), fields);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.equal(body.generationConfig.responseSchema.additionalProperties, undefined);
    assert.deepEqual(body.generationConfig.responseSchema.required, ["overview", "observations", "solution", "result", "tools"]);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }] });
  });
  assert.equal(called, true);
  assert.deepEqual(result, { ok: true, draft });
});

test("Gemini rate limits return a usable message", async () => {
  const result = await requestGeminiDraft({ key: "test-key", model, fields }, async () => new Response("", { status: 429 }));
  assert.deepEqual(result, { ok: false, message: "Gemini rate limit reached. Try again later." });
});

test("blocked or malformed Gemini responses are rejected", async () => {
  const blocked = await requestGeminiDraft({ key: "test-key", model, fields }, async () => Response.json({ candidates: [] }));
  assert.equal(blocked.ok, false);
  const malformed = await requestGeminiDraft({ key: "test-key", model, fields }, async () => Response.json({ candidates: [{ content: { parts: [{ text: "not JSON" }] } }] }));
  assert.equal(malformed.ok, false);
});

test("network failures do not leak request details", async () => {
  const result = await requestGeminiDraft({ key: "test-key", model, fields }, async () => { throw new Error("private key: test-key"); });
  assert.equal(result.ok, false);
  assert.equal(result.message.includes("test-key"), false);
});
