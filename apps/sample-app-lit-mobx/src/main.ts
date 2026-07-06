import { registerAppModules } from 'sample-app-shared/app/global/appModules.js';

import AppConfig from './app/global/appConfig.js';
import AuthService from './app/global/authService.js';
import App from './app/main/App.js';
import Compose from './app/mymessages/Compose.js';
import MessageList from './app/mymessages/MessageList.js';

// The bootstrap is shared; this app's identity is the reactivity-idiom
// modules registered here, which the shared code reads back lazily.
//
// No router-store wiring is needed: components observe the router through
// lit-ui-router-mobx's RouterReactionController, which discovers the router
// from the <ui-router> context and lazily attaches its observable
// RouterStore on first use.
registerAppModules({ AppConfig, AuthService, App, Compose, MessageList });

await import('sample-app-shared/main.js');
