## UI-Router 1.0 Lit Sample Application

https://github.simloovoo.com/lit-ui-router/#/mymessages/inbox/5648b50cc586cac4aed6836f

This sample app is intended to demonstrate a non-trivial ui-router lit application.

- Multiple sub-modules
- Managed state lifecycle
- Application data lifecycle
- Authentication (simulated)
- Authenticated and unauthenticated states
- REST data retrieval (simulated)
- [Sticky States](https://github.com/ui-router/sticky-states) with [Deep State Redirect](https://github.com/ui-router/dsr)

---

### Visualizer

We're using the [State and Transition Visualizer](http://github.com/ui-router/visualizer) to visually represent
the current state tree, as well as the transitions between states. Explore how transitions work by hovering
over them, and clicking to expand details (params and resolves).

Note how states are _entered_ when they were previously not active, _exited_ and re-_entered_ when parameters change,
and how parent states whose parameters did not change are _retained_. Each of these (_exited, entered, retained_)
correspond to a Transition Hook.

### Structure

The application is written in TypeScript, and utilizes ES6 modules.

There are many ways to structure a ui-router app. We aren't super opinionated on application structure. Use what works for you. We organized ours in the following way:

- Sub-module (feature) organization
  - Each feature gets its own directory.
  - Features contain states and all its components.
  - Router/state components live in the feature directory.
- Leveraging ES6 modules
  - Each state is defined in its own file
  - Each component is defined in its own file
  - Components export themselves
  - Components are then imported into states where they are composed into the state definition.
  - States export themselves
  - The `router.config.ts` imports all states and registers them with the `stateRegistry`

### UI-Router Patterns

- Defining custom, app-specific global behaviors
  - Add metadata to a state, or state tree
  - Check for metadata in transition hooks
  - Example: `redirectTo`
    - If a transition directly to a state with a `redirectTo` property is started,
      the transition will be redirected to the state which the property names.
  - Example: `global/requiresAuth.hook.ts`
    - If a transition to a state with a truthy `data.authRequired: true` property is started and the user is not currently authenticated
- Defining a default substate for a top-level state
  - Example: declaring `redirectTo: 'mymessages.messagelist'` in `mymessages/states.ts` (`mymessages` state)
- Defining a default parameter for a state
  - Example: `folderId` parameter defaults to 'inbox' in `mymessages/states.ts` (`messagelist` state)
- Application data lifecycle
  - Data loading is managed by the state declaration, via the `resolve:` block
  - Data is fetched before the state is _entered_
  - Data is fetched according to state parameters
  - The state is _entered_ when the data is ready
  - The resolved data is injected into the components via props
  - The resolve data remains loaded until the state is exited
- Lazy Loaded states
  - Contacts, mymessages, and prefs are lazy loaded
  - Future state placeholders are added in `main/states.ts`
  - `import()` is used to lazy load the states
- Deep State Redirect (DSR)
  - DSR used on the `contacts` and `mymessages` top level states
  - When a substate of a DSR state is activated, the state and parameters are memorized
  - When `contacts` or `mymessages` is activated again, the transition redirects to the memorized deep state and params
- Sticky States
  - Sticky States are enabled on the `contacts` and `mymessages` top level states
  - The modules' views (including DOM) and state are retained when a different module is activated
  - When returning to the module, the inactive state is reactivated
  - The views are restored (unhidden)

### Location Plugin Selection

The app supports three location strategies via `locationPluginConfig` in `router.config.ts`:

| Plugin       | URL Format | Browser Support        |
| ------------ | ---------- | ---------------------- |
| `hash`       | `/#/path`  | All browsers           |
| `pushState`  | `/path`    | Modern browsers        |
| `navigation` | `/path`    | Chrome 102+, Edge 102+ |

**Auto-detection**: When `navigation` preference is set, the app automatically selects the best available plugin:

1. Navigation API when supported 🧑‍🔬 _experimental_
2. Push State as fallback for unsupported browsers

**Override options** (in priority order):

1. URL parameter: `?feature-location-plugin=hash`
2. Session storage: Set via Feature Flags panel in Prefs
3. Environment variable: `VITE_SAMPLE_APP_LOCATION_PLUGIN=pushState`

The Feature Flags panel shows browser compatibility indicators for each plugin option.
