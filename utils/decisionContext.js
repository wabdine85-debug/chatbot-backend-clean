// utils/decisionContext.js

import { DECISION_AXES } from "./decisionFramework.js";

export function initDecisionContext(intent, matches) {
  return {
    active: true,
    intent,
    candidates: matches,
    askedAxes: [],
    stage: "clarify"
  };
}

export function isRefinementInput(message) {
  return (
    typeof message === "string" &&
    message.trim().split(" ").length <= 2
  );
}

export function getNextDecisionQuestion(context) {
  const axis = DECISION_AXES[context.intent];
  if (!axis) return null;

  if (context.askedAxes.includes(context.intent)) return null;

  context.askedAxes.push(context.intent);

  const options = axis.options
    .map(o => `– ${o.text}`)
    .join("<br>");

  return `
${axis.question}<br><br>
${options}
`;
}

export function refineCandidates(context, userInput) {
  const input = userInput.toLowerCase();

  const refined = context.candidates.map(t => {
    let bonus = 0;

    const wisy = t.wisy || {};

    if (wisy.ziele?.some(z => input.includes(z))) bonus += 3;
    if (wisy.probleme?.some(p => input.includes(p))) bonus += 3;
    if (wisy.tags?.some(tag => input.includes(tag))) bonus += 2;

    return { ...t, score: (t.score || 0) + bonus };
  });

  return refined.sort((a, b) => b.score - a.score);
}
