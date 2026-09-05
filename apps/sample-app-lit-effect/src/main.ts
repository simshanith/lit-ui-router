import { registerAppModules } from 'sample-app-shared/app/global/appModules.js';

import AppConfig from './app/global/appConfig.js';
import AuthService from './app/global/authService.js';
import App from './app/main/App.js';
import Compose from './app/mymessages/Compose.js';
import MessageList from './app/mymessages/MessageList.js';

// The bootstrap is shared; this app's identity is the reactivity-idiom
// modules registered here, which the shared code reads back lazily.
//
// No router wiring and no core plugin: app state lives in Effect
// SubscriptionRefs, and components follow them through the RefController /
// RouterRefController in src/app/effect/. The router's own ref is attached
// lazily per router (one onSuccess hook, keyed in a WeakMap) the first time a
// component asks for it.
registerAppModules({ AppConfig, AuthService, App, Compose, MessageList });

await import('sample-app-shared/main.js');
