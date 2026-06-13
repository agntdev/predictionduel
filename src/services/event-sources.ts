import type { Event } from "../types";

export type EventSourceResolver = (event: Event) => Promise<string | null>;

const resolvers: Map<string, EventSourceResolver> = new Map();

export function registerResolver(sourceKind: string, resolver: EventSourceResolver): void {
  resolvers.set(sourceKind, resolver);
}

export async function resolveEventOutcome(event: Event): Promise<string | null> {
  if (event.source_kind === "manual") {
    return null;
  }

  const resolver = resolvers.get(event.source_kind) ?? resolvers.get(event.type);
  if (!resolver) {
    return null;
  }

  try {
    return await resolver(event);
  } catch {
    return null;
  }
}
