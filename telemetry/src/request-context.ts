import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
  requestId?: string;
  traceId?: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore {
  return requestContext.getStore() ?? {};
}

export function runWithRequestContext<T>(
  store: RequestContextStore,
  fn: () => T,
): T {
  return requestContext.run(store, fn);
}
