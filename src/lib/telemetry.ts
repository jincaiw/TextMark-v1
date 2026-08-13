type SentrySdk = typeof import("@sentry/react");

const dsn = String(import.meta.env.VITE_SENTRY_DSN ?? "").trim();
let sdk: SentrySdk | null = null;
let active = false;

export const crashReportingAvailable = Boolean(dsn);

function sanitizeEvent(event: Parameters<NonNullable<Parameters<SentrySdk["init"]>[0]["beforeSend"]>>[0]) {
  event.user = undefined;
  event.request = undefined;
  event.breadcrumbs = [];
  event.server_name = undefined;
  event.modules = undefined;
  event.transaction = undefined;
  event.contexts = {};
  event.extra = {};
  event.tags = {};
  event.message = undefined;
  for (const exception of event.exception?.values ?? []) {
    exception.value = exception.type ? `${exception.type} in TextMark` : "TextMark exception";
    for (const frame of exception.stacktrace?.frames ?? []) {
      frame.abs_path = undefined;
      frame.filename = frame.filename?.split(/[\\/]/).pop();
      frame.context_line = undefined;
      frame.pre_context = undefined;
      frame.post_context = undefined;
      frame.vars = undefined;
    }
  }
  return event;
}

export async function configureCrashReporting(enabled: boolean) {
  if (!crashReportingAvailable) return false;
  if (!enabled) {
    if (sdk && active) await sdk.close(1_000);
    active = false;
    return false;
  }
  if (active) return true;
  sdk ??= await import("@sentry/react");
  sdk.init({
    dsn,
    sendDefaultPii: false,
    sendClientReports: false,
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    beforeBreadcrumb: () => null,
    beforeSend: sanitizeEvent,
    integrations: (defaults) => defaults.filter((integration) => !["Breadcrumbs", "BrowserSession", "HttpContext", "BrowserTracing"].includes(integration.name)),
  });
  active = true;
  return true;
}
