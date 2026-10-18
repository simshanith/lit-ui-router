import { registerAppModules } from 'sample-app-shared/app/global/appModules.js';
import type { SampleAppStates } from 'sample-app-shared/registry/states.js';
// Carries the registry into lit-ui-router's sref directives.
import type {} from 'ui-router-registry/lit';

import AppConfig from './app/global/appConfig.js';
import AuthService from './app/global/authService.js';
import App from './app/main/App.js';
import Compose from './app/mymessages/Compose.js';
import MessageList from './app/mymessages/MessageList.js';

// The bootstrap is shared; this app's identity is the reactivity-idiom
// modules registered here, which the shared code reads back lazily.
registerAppModules({ AppConfig, AuthService, App, Compose, MessageList });

await import('sample-app-shared/main.js');

// One augmentation types every registry surface in this app.
declare module 'ui-router-registry' {
  interface Register {
    states: SampleAppStates;
  }
}
