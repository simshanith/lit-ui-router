import { html } from 'lit';
import { uiSref, UIViewInjectedProps } from 'lit-ui-router';

export interface NotFoundResolves {
  attemptedPath: string;
}

/**
 * This is the view for the 'notFound' state. It is activated by the
 * `urlService.rules.otherwise` rule (see router.config.ts) when no other
 * URL rule matches. It shows the URL that failed to match and offers a
 * link back to the welcome state.
 */
export default (props: UIViewInjectedProps<NotFoundResolves>) =>
  html`<div class="container-fluid not-found">
    <h3>404 Page Not Found</h3>
    <p>
      No state matched the URL <code>${props.resolves.attemptedPath}</code>.
    </p>
    <button ${uiSref('welcome')} class="btn btn-primary">
      <i class="fa fa-home"></i><span>Return to Welcome</span>
    </button>
  </div>`;
