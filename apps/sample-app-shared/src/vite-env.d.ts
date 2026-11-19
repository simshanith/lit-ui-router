// vite/client's ImportMetaEnv index signature leaves custom vars `any`.
interface ImportMetaEnv {
  readonly VITE_SAMPLE_APP_BASE_URL?: string;
  readonly VITE_SAMPLE_APP_LOCATION_PLUGIN?: string;
  readonly VITE_OTLP_TRACES_ENDPOINT?: string;
  readonly VITE_OTLP_TRACES_HEADERS?: string;
  readonly VITE_OTLP_SERVICE_NAME?: string;
}
