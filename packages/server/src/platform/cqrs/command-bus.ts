import { Inject, Injectable } from "@nestjs/common";
import { type Command, CommandBus } from "@nestjs/cqrs";
import { SpanStatusCode, trace } from "@opentelemetry/api";

export type SpanAttributeValue = string | number | boolean;

export type SpanAttributeExtractor<M> = (
  message: M,
) => Readonly<Record<string, SpanAttributeValue>>;

/** Per-message extractors keyed by the message class name, folded from every module at the composition root. */
export type MessageSpanAttributes = Readonly<Record<string, SpanAttributeExtractor<never>>>;

export abstract class CommandSpanAttributes {}
export interface CommandSpanAttributes extends MessageSpanAttributes {}

const tracer = trace.getTracer("@org/server/cqrs");

/**
 * The command dispatch surface every inbound adapter and event adapter uses.
 * It opens the use-case span `command.<Name>` (ADR-0012) around Nest's bus,
 * which itself opens none; the handler's result rides through untouched.
 */
@Injectable()
export class AppCommandBus {
  constructor(
    @Inject(CommandBus) private readonly bus: CommandBus,
    @Inject(CommandSpanAttributes) private readonly spanAttributes: CommandSpanAttributes,
  ) {}

  public execute<R>(command: Command<R>): Promise<R> {
    const name = command.constructor.name;
    const extractor = this.spanAttributes[name];
    const attributes =
      extractor === undefined ? {} : (extractor as SpanAttributeExtractor<unknown>)(command);
    return tracer.startActiveSpan(`command.${name}`, { attributes }, async (span) => {
      try {
        return await this.bus.execute(command);
      } catch (cause) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw cause;
      } finally {
        span.end();
      }
    });
  }
}
