/**
 * In-memory store for launch runs: messages and done flag.
 * SSE listeners are notified when new messages arrive or run completes.
 */

export interface LaunchRun {
  messages: string[];
  done: boolean;
  error?: string;
  /** Callbacks to invoke when messages change or done is set */
  listeners: Set<() => void>;
}

const runs = new Map<string, LaunchRun>();

const MAX_RUNS = 100;
const runOrder: string[] = [];

function prune() {
  if (runOrder.length <= MAX_RUNS) return;
  const toRemove = runOrder.splice(0, runOrder.length - MAX_RUNS);
  toRemove.forEach((id) => runs.delete(id));
}

export function createRun(runId: string): LaunchRun {
  const run: LaunchRun = { messages: [], done: false, listeners: new Set() };
  runs.set(runId, run);
  runOrder.push(runId);
  prune();
  return run;
}

export function getRun(runId: string): LaunchRun | undefined {
  return runs.get(runId);
}

export function appendMessage(runId: string, message: string): void {
  const run = runs.get(runId);
  if (!run) return;
  run.messages.push(message);
  run.listeners.forEach((cb) => cb());
}

export function finishRun(runId: string, error?: string): void {
  const run = runs.get(runId);
  if (!run) return;
  run.done = true;
  if (error) run.error = error;
  run.listeners.forEach((cb) => cb());
}
