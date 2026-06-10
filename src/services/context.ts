import { AsyncLocalStorage } from "async_hooks";

export interface UserContext {
  userId: number;
}

export const userContextStore = new AsyncLocalStorage<UserContext>();
