import { html } from 'lit';

export const styles = (color: string) => [
  html`<style>
    p {
      color: red;
    }
  </style>`,
  html`<style>
    p {
      --accent: ${color};
    }
  </style>`,
  html`<div>
    <style>
      :host {
        display: block;
      }
    </style>
  </div>`,
  html`<style>
    p {
      /* a typed property's value gets postcss-lit's placeholder, as in a css block */
      /* expect invalid-css */
      color: ${color};
    }
  </style>`,
  html`<style>
    p {
      /* expect invalid-css */
      colr: red;
    }
  </style>`,
  html`<style>
    p {
      /* expect invalid-css, invalid-css */
      color: nonsense(1);
    }
  </style>`,
  html`<style>
    p {
      /* expect invalid-css */
      colr: ${color};
    }
  </style>`,
  html`<!-- @ts-expect-error -->
    <style>
      p {
        colr: red;
      }
    </style>`,
  // expect suppression
  html`<!-- @ts-expect-error -->
    <style>
      p {
        color: red;
      }
    </style>`,
  html`<style>
    p {
      /* stylelint-disable-next-line property-no-unknown -- fixture */
      colr: red;
    }
  </style>`,
  html`<style>
    p {
      /* expect invalid-css */
      /* stylelint-disable-next-line property-no-unknown -- fixture */
      color: red;
    }
  </style>`,
];
