import React from "react";
import log from "/../helpers/logger"; // Import logger
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import { version } from "../../package.json";
import App from "./app";
import DefaultFallback from "../components/error-fallback";

log.debug("Initializing Sentry...");

if (!process.env.REACT_APP_SENTRY_ENDPOINT) {
  log.warn("Sentry DSN is missing! Error tracking may not work.");
}

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_ENDPOINT,
  environment: process.env.REACT_APP_CONTEXT,
  release: `court@${version}`,
  integrations: [new BrowserTracing()],
});

log.debug("Sentry initialized with:", {
  dsn: process.env.REACT_APP_SENTRY_ENDPOINT,
  environment: process.env.REACT_APP_CONTEXT,
  release: `court@${version}`,
});

log.debug("Wrapping App with Sentry error boundary.");
Sentry.withErrorBoundary(App, { fallback: <DefaultFallback onClick={Sentry.showReportDialog} /> });

log.debug("App successfully wrapped with Sentry error boundary.");
