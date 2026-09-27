// Node OTEL on Next boot, exporting to the same collector the server uses so a
// browser → Next → server request is one trace (ADR-0012).
import { OTLPHttpJsonTraceExporter, registerOTel } from "@vercel/otel";

const OTLP_URL = process.env.OTLP_URL ?? "http://localhost:4318/v1/traces";

export const register = (): void => {
  registerOTel({
    serviceName: "nest-hexagon-web",
    traceExporter: new OTLPHttpJsonTraceExporter({ url: OTLP_URL }),
  });
};
