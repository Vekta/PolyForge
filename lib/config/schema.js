export const CONFIG_VERSION = '1.1.0';

const VALID_PARALLELISM_MODES = ['full', 'serialized'];
const VALID_LEARNING_CONSENT = ['granted', 'declined', 'unasked'];
const VALID_TRANSITION_NAMES = ['onStart', 'onPrReady', 'onBlocked', 'onReject'];

export function validatePolyforgeConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    errors.push('config: must be an object');
    return { valid: false, errors };
  }

  if (config.routines !== undefined) {
    // routines section is validated by lib/routines/schema.js (separate concern)
  }

  if (config.issueTracker?.transitions) {
    validateTransitions(config.issueTracker.transitions, errors);
  }

  if (config.git) {
    if (config.git.defaultBranch !== undefined && typeof config.git.defaultBranch !== 'string') {
      errors.push('git.defaultBranch: must be string');
    }
  }

  if (config.pipeline?.ciMirror) {
    validateCiMirror(config.pipeline.ciMirror, errors);
  }

  if (config.parallelism) {
    validateParallelism(config.parallelism, errors);
  }

  return { valid: errors.length === 0, errors };
}

function validateTransitions(transitions, errors) {
  for (const key of Object.keys(transitions)) {
    if (!VALID_TRANSITION_NAMES.includes(key)) {
      errors.push(`issueTracker.transitions.${key}: unknown transition. Valid: ${VALID_TRANSITION_NAMES.join(', ')}`);
      continue;
    }
    const t = transitions[key];
    if (!t || typeof t.status !== 'string' || !t.status) {
      errors.push(`issueTracker.transitions.${key}.status: required non-empty string`);
    }
  }
}

function validateCiMirror(ciMirror, errors) {
  if (!Array.isArray(ciMirror.commands)) {
    errors.push('pipeline.ciMirror.commands: must be array');
  } else {
    ciMirror.commands.forEach((c, i) => {
      if (!c.cmd || typeof c.cmd !== 'string') {
        errors.push(`pipeline.ciMirror.commands[${i}].cmd: required non-empty string`);
      }
      if (c.blocking !== undefined && typeof c.blocking !== 'boolean') {
        errors.push(`pipeline.ciMirror.commands[${i}].blocking: must be boolean if set`);
      }
    });
  }
  if (ciMirror.learnedCommands !== undefined && !Array.isArray(ciMirror.learnedCommands)) {
    errors.push('pipeline.ciMirror.learnedCommands: must be array if set');
  }
  if (ciMirror.excludePatterns !== undefined && !Array.isArray(ciMirror.excludePatterns)) {
    errors.push('pipeline.ciMirror.excludePatterns: must be array if set');
  } else if (Array.isArray(ciMirror.excludePatterns)) {
    ciMirror.excludePatterns.forEach((p, i) => {
      try { new RegExp(p); }
      catch { errors.push(`pipeline.ciMirror.excludePatterns[${i}]: invalid regex "${p}"`); }
    });
  }
  if (ciMirror.learningConsent !== undefined && !VALID_LEARNING_CONSENT.includes(ciMirror.learningConsent)) {
    errors.push(`pipeline.ciMirror.learningConsent: must be one of ${VALID_LEARNING_CONSENT.join(', ')}`);
  }
}

function validateParallelism(p, errors) {
  if (p.mode !== undefined && !VALID_PARALLELISM_MODES.includes(p.mode)) {
    errors.push(`parallelism.mode: must be one of ${VALID_PARALLELISM_MODES.join(', ')}`);
  }
  if (p.maxConcurrent !== undefined && (typeof p.maxConcurrent !== 'number' || p.maxConcurrent < 1)) {
    errors.push('parallelism.maxConcurrent: must be positive integer');
  }
}

export { VALID_PARALLELISM_MODES, VALID_LEARNING_CONSENT, VALID_TRANSITION_NAMES };
