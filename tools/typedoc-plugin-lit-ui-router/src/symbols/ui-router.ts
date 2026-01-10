const UIROUTER_BASE = 'https://ui-router.github.io/core/docs/latest';

const classTemplate = (
  name: string,
  module: string,
): Record<string, string> => ({
  [name]: `${UIROUTER_BASE}/classes/${module}.${name.toLowerCase()}.html`,
});

const interfaceTemplate = (
  name: string,
  module: string,
): Record<string, string> => ({
  [name]: `${UIROUTER_BASE}/interfaces/${module}.${name.toLowerCase()}.html`,
});

const enumTemplate = (
  name: string,
  module: string,
): Record<string, string> => ({
  [name]: `${UIROUTER_BASE}/enums/${module}.${name.toLowerCase()}.html`,
});

const typeTemplate = (
  name: string,
  module: string,
  anchor?: string,
): Record<string, string> => ({
  [name]: anchor
    ? `${UIROUTER_BASE}/modules/${module}.html#${anchor}`
    : `${UIROUTER_BASE}/modules/${module}.html#${name.toLowerCase()}`,
});

export const UIROUTER_SYMBOLS: Record<string, string> = {
  ...classTemplate('UIRouter', '_router_'),
  ...classTemplate('StateService', '_state_stateservice_'),
  ...classTemplate('StateRegistry', '_state_stateregistry_'),
  ...classTemplate('StateObject', '_state_stateobject_'),
  ...classTemplate('TargetState', '_state_targetstate_'),
  ...classTemplate('TransitionService', '_transition_transitionservice_'),
  ...classTemplate('Transition', '_transition_transition_'),
  ...classTemplate('UrlService', '_url_urlservice_'),
  ...classTemplate('UrlConfig', '_url_urlconfig_'),
  ...classTemplate('UrlRules', '_url_urlrules_'),
  ...classTemplate('Trace', '_common_trace_'),
  ...classTemplate('UrlMatcher', '_url_urlmatcher_'),
  ...classTemplate('Resolvable', '_resolve_resolvable_'),
  ...classTemplate('PathNode', '_path_pathnode_'),
  ...classTemplate('Param', '_params_param_'),
  ...classTemplate('Rejection', '_transition_rejectfactory_'),
  ...classTemplate('Glob', '_common_glob_'),
  ...classTemplate('HookBuilder', '_transition_hookbuilder_'),
  ...classTemplate('StateBuilder', '_state_statebuilder_'),
  ...classTemplate('StateMatcher', '_state_statematcher_'),
  ...classTemplate('StateQueueManager', '_state_statequeuemanager_'),
  ...classTemplate('UrlMatcherFactory', '_url_urlmatcherfactory_'),
  ...classTemplate('UrlRouter', '_url_urlrouter_'),
  ...classTemplate('UrlRule', '_url_urlrule_'),
  ...classTemplate('ResolveContext', '_resolve_resolvecontext_'),

  ...interfaceTemplate('StateDeclaration', '_state_interface_'),
  ...interfaceTemplate('HrefOptions', '_state_interface_'),
  ...interfaceTemplate('LazyLoadResult', '_state_interface_'),
  ...interfaceTemplate('TransitionPromise', '_state_interface_'),
  ...interfaceTemplate('_ViewDeclaration', '_state_interface_'),
  ...interfaceTemplate('TargetStateDef', '_state_interface_'),
  ...interfaceTemplate('RedirectToResult', '_state_interface_'),
  ...interfaceTemplate('IHookRegistry', '_transition_interface_'),
  ...interfaceTemplate('HookMatchCriteria', '_transition_interface_'),
  ...interfaceTemplate('HookRegOptions', '_transition_interface_'),
  ...interfaceTemplate('TransitionHookFn', '_transition_interface_'),
  ...interfaceTemplate('TransitionStateHookFn', '_transition_interface_'),
  ...interfaceTemplate('TransitionCreateHookFn', '_transition_interface_'),
  ...interfaceTemplate('TransitionHookOptions', '_transition_interface_'),
  ...interfaceTemplate('TransitionOptions', '_transition_interface_'),
  ...interfaceTemplate('TreeChanges', '_transition_interface_'),
  ...interfaceTemplate('IMatchingNodes', '_transition_interface_'),
  ...interfaceTemplate('RawParams', '_params_interface_'),
  ...interfaceTemplate('ParamDeclaration', '_params_interface_'),
  ...interfaceTemplate('ParamTypeDefinition', '_params_interface_'),
  ...interfaceTemplate('Replace', '_params_interface_'),
  ...interfaceTemplate('ViewConfig', '_view_interface_'),
  ...interfaceTemplate('ResolvableLiteral', '_resolve_interface_'),
  ...interfaceTemplate('ProviderLike', '_resolve_interface_'),
  ...interfaceTemplate('UIInjector', '_interface_'),

  ...typeTemplate('HookResult', '_transition_interface_', 'hookresult'),
  ...typeTemplate('HookFn', '_transition_interface_', 'hookfn'),
  ...typeTemplate(
    'HookMatchCriterion',
    '_transition_interface_',
    'hookmatchcriterion',
  ),
  ...typeTemplate(
    'IHookRegistration',
    '_transition_interface_',
    'ihookregistration',
  ),
  ...typeTemplate('IStateMatch', '_transition_interface_', 'istatematch'),
  ...typeTemplate('ResolveTypes', '_state_interface_', 'resolvetypes'),
  ...typeTemplate('StateOrName', '_state_interface_', 'stateorname'),
  ...typeTemplate(
    '_StateDeclaration',
    '_state_interface_',
    '_statedeclaration',
  ),

  ...enumTemplate('TransitionHookPhase', '_transition_interface_'),
  ...enumTemplate('TransitionHookScope', '_transition_interface_'),
  ...enumTemplate('RejectType', '_transition_rejectfactory_'),
  ...enumTemplate('TransitionEventType', '_transition_transitioneventtype_'),

  // Location plugins
  ...classTemplate(
    'PushStateLocationService',
    '_vanilla_pushstatelocationservice_',
  ),
  ...classTemplate('HashLocationService', '_vanilla_hashlocationservice_'),
  ...classTemplate('BaseLocationServices', '_vanilla_baselocationservice_'),
};
