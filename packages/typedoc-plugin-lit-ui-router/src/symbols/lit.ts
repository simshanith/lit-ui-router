const LIT_BASE = 'https://lit.dev/docs/api';

const directiveTemplate = (name: string): Record<string, string> => ({
  [name]: `${LIT_BASE}/custom-directives/#${name.toLowerCase()}`,
});

const baseTemplate = (name: string, path: string): Record<string, string> => ({
  [name]: `${LIT_BASE}/${path}`,
});

export const LIT_SYMBOLS: Record<string, string> = {
  ...directiveTemplate('AsyncDirective'),
  ...directiveTemplate('Directive'),
  ...directiveTemplate('Part'),
  ...directiveTemplate('ChildPart'),
  ...directiveTemplate('ElementPart'),
  ...directiveTemplate('AttributePart'),
  ...directiveTemplate('PropertyPart'),
  ...directiveTemplate('EventPart'),

  ...baseTemplate('LitElement', 'LitElement/'),
  ...baseTemplate('TemplateResult', 'templates/'),
  ...baseTemplate('PartInfo', 'custom-directives/#PartInfo'),
  ...baseTemplate('PartType', 'custom-directives/#PartType'),
  ...baseTemplate('noChange', 'custom-directives/#noChange'),
  ...baseTemplate('directive', 'custom-directives/#directive'),
  ...baseTemplate('ReactiveController', 'ReactiveController/'),
  ...baseTemplate('ReactiveControllerHost', 'ReactiveControllerHost/'),
  ...baseTemplate('PropertyDeclaration', 'decorators/#PropertyDeclaration'),
  ...baseTemplate('PropertyDeclarations', 'decorators/#PropertyDeclarations'),
  ...baseTemplate('DirectiveResult', 'custom-directives/#DirectiveResult'),
};
