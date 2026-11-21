import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { servicesPlugin } from '@uirouter/core';
import { UIRouter, UIRouterReact, UIView } from '@uirouter/react';
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';

import { PLANETS } from './planets';
import { states } from './states';
import { Link, RouteStatus } from './views';

const router = new UIRouterReact();

// A router passed by instance needs servicesPlugin; <UIRouter plugins> adds it itself.
router.plugin(servicesPlugin);

router.plugin(navigationLocationPlugin);

states.forEach((state) => router.stateRegistry.register(state));

router.urlService.rules.initial({ state: 'home' });

router.urlService.rules.otherwise({ state: 'home' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UIRouter router={router}>
      <h1>UI-Router for React</h1>
      <RouteStatus />
      <nav aria-label="Planets">
        <Link to="home" params={{}}>
          All
        </Link>
        {PLANETS.map((planet) => (
          <Link key={planet.id} to="planet" params={{ planetId: planet.id }}>
            {planet.name}
          </Link>
        ))}
      </nav>
      <main>
        <UIView />
      </main>
    </UIRouter>
  </StrictMode>,
);
