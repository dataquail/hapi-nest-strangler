import Boom from "@hapi/boom";

import Joi = require("../joi");
import ValidationError = require("./ValidationError");

type Validator = (value: any, options: any) => Promise<any>;

// Mix Joi validation with our own async validators: Joi runs first over the
// whole object, then each custom validator runs over its key and may replace
// the value (a row id becomes the row), or throw a ValidationError.
export const asyncValidation =
  (joiSchema: Record<string, any>, customSchema: Record<string, Validator>) =>
  async (values: any, options: any) => {
    const schema = Joi.object().keys(joiSchema);
    const { error, value: transformedValues } = schema.validate(values, {
      ...options,
      abortEarly: false,
    });
    if (error) {
      throw Boom.badRequest(error.message);
    }

    const errors: Array<{ path: string; message: string; type: string }> = [];
    for (const key of Object.keys(customSchema)) {
      try {
        transformedValues[key] = await customSchema[key](transformedValues[key], options);
      } catch (err: any) {
        if (err?.name !== "ValidationError") {
          throw err;
        }
        errors.push({ path: key, message: err.message, type: err.type });
      }
    }
    if (errors.length > 0) {
      const boom = Boom.badRequest(errors.map((e) => `${e.path}: ${e.message}`).join("; "));
      (boom.output.payload as any).validationErrors = errors;
      throw boom;
    }
    return transformedValues;
  };

export { ValidationError };
