import type { LitViewDeclaration } from 'lit-ui-router';

import type { MessageListResolves } from '../mymessages/interface.js';

/**
 * The contract between the shared sample-app code and each concrete app.
 *
 * The sample apps differ only in their reactivity idiom; these are the
 * modules that express it. Each app implements them and provides them via
 * {@link registerAppModules} before booting the shared entry point (see the
 * apps' `src/main.ts`). Code evaluated before registration — all shared
 * modules, and the app modules `main.ts` imports — must read these bindings
 * lazily (inside constructors, methods, or state definitions), never at
 * module scope; work that must start eagerly can `await`
 * {@link appModulesRegistered} instead.
 */
export interface AppModules {
  AppConfig: AppConfig;
  AuthService: AuthService;
  App: LitViewDeclaration;
  Compose: LitViewDeclaration;
  MessageList: LitViewDeclaration<MessageListResolves>;
}

/** Stores and retrieves user preferences in session storage. */
export interface AppConfig {
  sort: string;
  emailAddress: string | undefined;
  restDelay: number;
  load(): void;
  save(): void;
}

/** Emulates an authentication service. */
export interface AuthService {
  usernames: string[];
  isAuthenticated(): boolean;
  authenticate(username: string, password: string): Promise<void>;
  logout(): void;
}

export let AppConfig: AppConfig;
export let AuthService: AuthService;
export let App: LitViewDeclaration;
export let Compose: LitViewDeclaration;
export let MessageList: LitViewDeclaration<MessageListResolves>;

let markRegistered: (modules: AppModules) => void;

/** Resolves with the app's modules once {@link registerAppModules} runs. */
export const appModulesRegistered = new Promise<AppModules>((resolve) => {
  markRegistered = resolve;
});

export function registerAppModules(modules: AppModules) {
  ({ AppConfig, AuthService, App, Compose, MessageList } = modules);
  markRegistered(modules);
}
