import { Controller, Get } from "@nestjs/common";
import { buildOpenApiDocument, type OpenApiDocument } from "@org/contracts/openapi/document";

@Controller()
export class OpenApiController {
  private readonly document = buildOpenApiDocument();

  @Get("/openapi.json")
  public openapi(): OpenApiDocument {
    return this.document;
  }
}
