import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { Response } from "express";

import { HttpProblem } from "./http-problem.js";

const STATUS_TAGS: Readonly<Record<number, string>> = {
  400: HttpErrors.BadRequest.tag,
  401: HttpErrors.Unauthorized.tag,
  403: HttpErrors.Forbidden.tag,
  404: HttpErrors.NotFound.tag,
  409: HttpErrors.Conflict.tag,
  410: HttpErrors.Gone.tag,
  422: HttpErrors.UnprocessableEntity.tag,
  502: HttpErrors.BadGateway.tag,
  503: HttpErrors.ServiceUnavailable.tag,
};

/**
 * Every failure leaves as a tagged problem body, including the ones Nest raises
 * on its own (an unknown route, a rejected body) and the defects nothing
 * translated, so a client can always switch on `_tag`.
 */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (HttpProblem.is(exception)) {
      response.status(exception.definition.status).json(exception.body);
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const inner = exception.getResponse();
      const message =
        typeof inner === "string"
          ? inner
          : (((inner as { message?: unknown }).message as string | undefined) ?? exception.message);
      response.status(status).json({
        _tag: STATUS_TAGS[status] ?? HttpErrors.InternalServerError.tag,
        message: Array.isArray(message) ? message.join("; ") : message,
      });
      return;
    }
    this.logger.error("Unhandled defect", exception instanceof Error ? exception.stack : exception);
    response.status(500).json({ _tag: HttpErrors.InternalServerError.tag });
  }
}
