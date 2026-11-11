// The solar system's data: no lit, so the prerender script can read it too.
export interface SolarBody {
  id: number;
  name: string;
  kind: 'star' | 'rocky planet' | 'gas giant' | 'ice giant' | 'dwarf planet';
  distanceAu: number;
  diameterKm: number;
  moons: number;
  orbitalPeriod: string;
  funFact: string;
  gradient: string;
}

// Ordered by distance from the Sun.
export const solarBodies: SolarBody[] = [
  {
    id: 1,
    name: 'Sun',
    kind: 'star',
    distanceAu: 0,
    diameterKm: 1392700,
    moons: 0,
    orbitalPeriod: '230 million years around the galactic center',
    funFact: "Contains 99.86% of the solar system's mass.",
    gradient:
      'radial-gradient(circle at 35% 35%, #fff7ae, #ffb703 55%, #d00000)',
  },
  {
    id: 2,
    name: 'Mercury',
    kind: 'rocky planet',
    distanceAu: 0.39,
    diameterKm: 4879,
    moons: 0,
    orbitalPeriod: '88 days',
    funFact: 'One solar day on Mercury lasts about two Mercury years.',
    gradient:
      'radial-gradient(circle at 35% 35%, #d8d8d8, #8d8d8d 60%, #4a4a4a)',
  },
  {
    id: 3,
    name: 'Venus',
    kind: 'rocky planet',
    distanceAu: 0.72,
    diameterKm: 12104,
    moons: 0,
    orbitalPeriod: '225 days',
    funFact: 'Spins backwards, so the Sun rises in the west.',
    gradient:
      'radial-gradient(circle at 35% 35%, #f5e3b3, #e0b060 60%, #9c6f2f)',
  },
  {
    id: 4,
    name: 'Earth',
    kind: 'rocky planet',
    distanceAu: 1,
    diameterKm: 12756,
    moons: 1,
    orbitalPeriod: '365.25 days',
    funFact: 'The only known world with liquid-water oceans at the surface.',
    gradient:
      'radial-gradient(circle at 35% 35%, #9bd4f5, #2a7fd4 55%, #123c7a)',
  },
  {
    id: 5,
    name: 'Mars',
    kind: 'rocky planet',
    distanceAu: 1.52,
    diameterKm: 6792,
    moons: 2,
    orbitalPeriod: '687 days',
    funFact: 'Home to Olympus Mons, the tallest volcano in the solar system.',
    gradient:
      'radial-gradient(circle at 35% 35%, #f0a075, #c1440e 60%, #6e2408)',
  },
  {
    id: 6,
    name: 'Jupiter',
    kind: 'gas giant',
    distanceAu: 5.2,
    diameterKm: 142984,
    moons: 95,
    orbitalPeriod: '11.9 years',
    funFact: 'The Great Red Spot is a storm larger than Earth.',
    gradient:
      'radial-gradient(circle at 35% 35%, #f3ddc0, #c88b3a 55%, #7a4a1f)',
  },
  {
    id: 7,
    name: 'Saturn',
    kind: 'gas giant',
    distanceAu: 9.5,
    diameterKm: 120536,
    moons: 274,
    orbitalPeriod: '29.4 years',
    funFact: 'Less dense than water, it would float in a big enough bathtub.',
    gradient:
      'radial-gradient(circle at 35% 35%, #f7e7b8, #d9b36c 60%, #8f6f3a)',
  },
  {
    id: 8,
    name: 'Uranus',
    kind: 'ice giant',
    distanceAu: 19.2,
    diameterKm: 51118,
    moons: 28,
    orbitalPeriod: '84 years',
    funFact: 'Rotates on its side, tilted about 98 degrees.',
    gradient:
      'radial-gradient(circle at 35% 35%, #d8f7f7, #7fd4d4 60%, #3a8f9c)',
  },
  {
    id: 9,
    name: 'Neptune',
    kind: 'ice giant',
    distanceAu: 30.1,
    diameterKm: 49528,
    moons: 16,
    orbitalPeriod: '165 years',
    funFact: 'Winds reach 2,000 km/h, the fastest in the solar system.',
    gradient:
      'radial-gradient(circle at 35% 35%, #9fb8f5, #3b5bdb 60%, #1a2f7a)',
  },
  {
    id: 10,
    name: 'Pluto',
    kind: 'dwarf planet',
    distanceAu: 39.5,
    diameterKm: 2377,
    moons: 5,
    orbitalPeriod: '248 years',
    funFact: 'Reclassified as a dwarf planet in 2006, but still beloved.',
    gradient:
      'radial-gradient(circle at 35% 35%, #e8d8c8, #b09880 60%, #6a5a4a)',
  },
];
