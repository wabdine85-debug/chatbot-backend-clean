import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = JSON.parse(readFileSync(new URL("../wisy.json", import.meta.url), "utf8"));
const rules = workflow.nodes.find((node) => node.name === "Switch").parameters.rules.values;
const outputs = workflow.connections.Switch.main;

function route(query) {
  const text = query.toLowerCase();
  const branch = rules.findIndex((rule) =>
    rule.conditions.conditions.every((condition) =>
      new RegExp(condition.rightValue).test(text),
    ),
  );
  return outputs[branch < 0 ? rules.length : branch][0].node;
}

test("consultation cost questions receive one concise booking answer", () => {
  for (const query of [
    "kostet der beratungstermin",
    "Ist die Beratung kostenlos?",
    "Was kostet die Hautanalyse?",
  ]) {
    assert.equal(route(query), "Edit Beratung Kosten", query);
  }
  const node = workflow.nodes.find((item) => item.name === "Edit Beratung Kosten");
  const reply = node.parameters.assignments.assignments.find((item) => item.name === "reply").value;
  assert.match(reply, /kostenlos \(0 €\)/);
  assert.doesNotMatch(reply, /angerechnet|Kontaktformular/);
  assert.equal(workflow.connections["Edit Beratung Kosten"].main[0][0].node, "Respond Beratung");
});

test("credit questions receive the separate explanation", () => {
  assert.equal(route("Wird die Beratung bei einer Behandlung angerechnet?"), "Edit Beratung Anrechnung");
  const node = workflow.nodes.find((item) => item.name === "Edit Beratung Anrechnung");
  const reply = node.parameters.assignments.assignments.find((item) => item.name === "reply").value;
  assert.match(reply, /keine Beratungsgebühr/);
  assert.match(reply, /angerechnet/);
  assert.equal(workflow.connections["Edit Beratung Anrechnung"].main[0][0].node, "Respond Beratung");
});

test("booking and unrelated price questions retain their existing branches", () => {
  assert.equal(route("Ich möchte einen Beratungstermin buchen"), "Edit Beratung");
  assert.equal(route("Hautanalyse buchen"), "Edit Beratung");
  assert.equal(route("Was kostet Morpheus8?"), "Edit Preisfrage");
  assert.notEqual(route("Was kostet die Beratung als Member?"), "Edit Beratung Kosten");
});
