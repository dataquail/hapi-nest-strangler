import { readFileSync } from "fs";
import handlebars from "handlebars";
import path from "path";

const compiled = new Map<string, HandlebarsTemplateDelegate>();

// Templates ship beside the build (tsc copies nothing; the folder sits at the
// package root either way), compiled once per process.
export const renderTemplate = (name: string, context: Record<string, unknown>): string => {
  let template = compiled.get(name);
  if (!template) {
    const source = readFileSync(path.join(__dirname, "../../templates", `${name}.html`), "utf8");
    template = handlebars.compile(source);
    compiled.set(name, template);
  }
  return template(context);
};
