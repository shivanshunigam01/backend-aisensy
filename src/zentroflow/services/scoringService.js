const { temperatureFromScore } = require('../utils/helpers');

/**
 * Configuration-driven scoring (SRS §9). Rules stored on tenant.scoreRules.
 */
function applyScoreRules(rules, signals) {
  let score = 0;
  const reasons = [];
  for (const rule of rules || []) {
    const cond = rule.condition || {};
    let match = true;
    for (const [k, v] of Object.entries(cond)) {
      if (signals[k] !== v) {
        match = false;
        break;
      }
    }
    if (match) {
      score += Number(rule.points) || 0;
      reasons.push(rule.label || rule.id || 'rule');
    }
  }
  return { score, reasons, temperature: temperatureFromScore(score) };
}

module.exports = { applyScoreRules };
