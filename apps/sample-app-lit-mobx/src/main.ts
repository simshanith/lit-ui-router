// The whole bootstrap is shared; this app's identity lives in the ~app/*
// modules (appConfig, authService, App, NavHeader, Compose, MessageList)
// that the shared code imports back from src/app/.
//
// No store wiring is needed at startup: components observe the router
// through lit-ui-router-mobx's RouterReactionController, which discovers
// the router from the <ui-router> context and lazily attaches its
// observable RouterStore on first use.
import 'sample-app-shared/main.js';
