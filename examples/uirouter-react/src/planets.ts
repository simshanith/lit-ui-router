export interface Planet {
  id: string;
  name: string;
  moons: number;
}

export const PLANETS: readonly Planet[] = [
  { id: 'mercury', name: 'Mercury', moons: 0 },
  { id: 'venus', name: 'Venus', moons: 0 },
  { id: 'earth', name: 'Earth', moons: 1 },
  { id: 'mars', name: 'Mars', moons: 2 },
];

// Stands in for a fetch, slow enough that the pending state shows.
export function loadPlanet(id: string): Promise<Planet | undefined> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(PLANETS.find((planet) => planet.id === id)), 400),
  );
}
