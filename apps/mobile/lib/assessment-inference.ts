/**
 * Assessment Inference — Phase 1 (The Moment)
 *
 * Maps Phase 1 responses to backend signals for Phase 2 cluster weighting.
 * Output is stored ONLY in assessment_sessions.inferences_json.
 * These classifications are NEVER shown to the user in any form.
 */

export interface Phase1Responses {
  p1_q1: string; // free text: what happened
  p1_q2: string; // free text: body sensation (optional)
  p1_q3: string; // single choice: action taken
  p1_q4_answer: string; // yes | no | not_sure
  p1_q4_text?: string; // conditional: what the second voice said
  p1_q5: string; // single choice: frequency
}

export interface Phase1Inferences {
  action_pattern: string;
  has_inner_critic: boolean;
  inner_critic_content?: string;
  frequency: string;
  signals: {
    manager: number; // 0–5
    firefighter: number; // 0–5
    exile: number; // 0–5
    inner_critic: number; // 0–5
  };
  /** Multipliers applied to each cluster's questions in Phase 2. Base = 1.0. */
  cluster_weights: {
    clusterA: number; // Standards & Effort
    clusterB: number; // Relief & Escape
    clusterC: number; // Connection & Relationships
    clusterD: number; // The Voice Inside
  };
}

/**
 * Derives inference signals from Phase 1 responses.
 * Called once at Phase 1 completion — output stored, never surfaced in UI.
 */
export function inferPhase1(responses: Phase1Responses): Phase1Inferences {
  const signals = { manager: 0, firefighter: 0, exile: 0, inner_critic: 0 };

  // p1_q3: action taken in the reactive moment
  switch (responses.p1_q3) {
    case 'withdrew':
      signals.exile += 2;
      break;
    case 'acted_out':
      signals.firefighter += 2;
      break;
    case 'went_busy':
      signals.firefighter += 1;
      signals.manager += 1;
      break;
    case 'went_numb':
      signals.exile += 2;
      break;
    case 'tried_to_fix':
      signals.manager += 3;
      break;
    // 'something_else' — no signal assigned
  }

  // p1_q4: presence of an inner critical voice
  const has_inner_critic = responses.p1_q4_answer === 'yes';
  if (has_inner_critic) {
    signals.inner_critic += 2;
    signals.manager += 1;
  }

  // p1_q5: frequency boost — more frequent activation amplifies all signals
  let frequencyMultiplier = 1.0;
  if (responses.p1_q5 === 'very_often') frequencyMultiplier = 1.5;
  else if (responses.p1_q5 === 'often') frequencyMultiplier = 1.2;

  const cap = (v: number) => Math.min(5, Math.round(v * frequencyMultiplier));
  signals.manager = cap(signals.manager);
  signals.firefighter = cap(signals.firefighter);
  signals.exile = cap(signals.exile);
  signals.inner_critic = cap(signals.inner_critic);

  // Derive Phase 2 cluster weights from signals
  const cluster_weights = {
    clusterA: 1.0,
    clusterB: 1.0,
    clusterC: 1.0,
    clusterD: 1.0,
  };

  if (signals.manager >= 2) {
    cluster_weights.clusterA += signals.manager * 0.1;
  }
  if (signals.firefighter >= 2) {
    cluster_weights.clusterB += signals.firefighter * 0.1;
  }
  if (signals.inner_critic >= 2 || signals.exile >= 2) {
    cluster_weights.clusterD += (signals.inner_critic + signals.exile) * 0.1;
  }

  return {
    action_pattern: responses.p1_q3,
    has_inner_critic,
    inner_critic_content: responses.p1_q4_text,
    frequency: responses.p1_q5,
    signals,
    cluster_weights,
  };
}
