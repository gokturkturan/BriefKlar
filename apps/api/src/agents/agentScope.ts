import { AsyncLocalStorage } from "node:async_hooks";
import type { AgentName } from "@briefklar/shared";

/**
 * The run and the agent the current code works for. The orchestrator sets it around each agent,
 * so every model request made inside (through loggedCall) is logged with the run and the agent,
 * without passing them through every function.
 */
export interface AgentScope {
  runId: string;
  agent: AgentName;
}

const storage = new AsyncLocalStorage<AgentScope>();

export function runInAgentScope<T>(scope: AgentScope, work: () => Promise<T>): Promise<T> {
  return storage.run(scope, work);
}

/** The scope of the agent that is running, or undefined outside a run */
export function currentAgentScope(): AgentScope | undefined {
  return storage.getStore();
}
