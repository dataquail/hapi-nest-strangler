import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

// Loaded with `--import` before the application so the auto-instrumentations
// patch http and pg ahead of their first require.
const sdk = new NodeSDK({
  serviceName: "nest-hexagon-server",
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTLP_URL ?? "http://localhost:4318/v1/traces",
  }),
  instrumentations: [
    getNodeAutoInstrumentations({ "@opentelemetry/instrumentation-fs": { enabled: false } }),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  void sdk.shutdown();
});
