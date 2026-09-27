import { Inject, Injectable } from "@nestjs/common";
import { type Query, QueryBus } from "@nestjs/cqrs";
import { SpanStatusCode, trace } from "@opentelemetry/api";

import type { MessageSpanAttributes, SpanAttributeExtractor } from "./command-bus.js";

export abstract class QuerySpanAttributes {}
export interface QuerySpanAttributes extends MessageSpanAttributes {}

const tracer = trace.getTracer("@org/server/cqrs");

/** The query dispatch surface; opens `query.<Name>` around Nest's bus. */
@Injectable()
export class AppQueryBus {
  constructor(
    @Inject(QueryBus) private readonly bus: QueryBus,
    @Inject(QuerySpanAttributes) private readonly spanAttributes: QuerySpanAttributes,
  ) {}

  public execute<R>(query: Query<R>): Promise<R> {
    const name = query.constructor.name;
    const extractor = this.spanAttributes[name];
    const attributes =
      extractor === undefined ? {} : (extractor as SpanAttributeExtractor<unknown>)(query);
    return tracer.startActiveSpan(`query.${name}`, { attributes }, async (span) => {
      try {
        return await this.bus.execute(query);
      } catch (cause) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw cause;
      } finally {
        span.end();
      }
    });
  }
}
