// Data only: the regions the home page marks in its code listing, home-sample/app.ts below its imports. test/home-sample.test.ts holds each range to the text it marks.

/** A place in the listing: a line and a column in it, both counted from 1. */
export type Position = readonly [line: number, column: number];

/** A span of the listing the home page boxes, numbers and explains. */
export interface SampleRegion {
  id: string;
  /** One to three words; a region a tour card covers takes the card's title. */
  label: string;
  /** One sentence; backticks set code. */
  explanation: string;
  /** The first character marked. */
  start: Position;
  /** The last character marked. */
  end: Position;
  /** The tour card that runs the same feature; the explanation links to it. */
  card?: 'states' | 'views' | 'resolves';
}

/** The regions in the listing's order, which is the order they are numbered in. */
export const HOME_SAMPLE_REGIONS: readonly SampleRegion[] = [
  {
    id: 'states',
    label: 'States',
    explanation:
      'A state has a name, and links and transitions go to it by that name, not by a URL.',
    start: [2, 3],
    end: [2, 14],
    card: 'states',
  },
  {
    id: 'parameters',
    label: 'URL parameters',
    explanation:
      "`:cardId` is a parameter in the state's URL: `/views` enters the state with `cardId` set to `views`, and a new value re-enters it.",
    start: [3, 3],
    end: [3, 17],
  },
  {
    id: 'resolves',
    label: 'Resolves',
    explanation:
      "By default, a transition waits for a state's resolves before activating it, so the component renders with `card` ready.",
    start: [5, 3],
    end: [12, 4],
    card: 'resolves',
  },
  {
    id: 'views',
    label: 'Views',
    explanation:
      "`<ui-view>` renders the active state's component, and the `app-root` element around it stays mounted.",
    start: [19, 7],
    end: [19, 25],
    card: 'views',
  },
  {
    id: 'links',
    label: 'State links',
    explanation:
      "`uiSref` writes the link's `href` from a state name and its parameters, and a click on the link starts the transition.",
    start: [20, 10],
    end: [20, 47],
  },
];

/** The name the listing is highlighted under: config.ts registers the regions by it, and the page's data loader asks for it. */
export const HOME_SAMPLE_NAME = 'home-sample';

/** The pages the listing's introduction links. */
export const HOME_SAMPLE_LINKS = {
  tourSource:
    'https://github.com/simshanith/lit-ui-router/blob/main/examples/features-tour/src/tour.ts',
  tutorial: '/tutorial/helloworld',
} as const;
