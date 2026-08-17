import fs from "node:fs/promises";

export type Template = Record<string, unknown>;

export const isString = (value: unknown): value is string =>
  typeof value === "string";

export const isArrayOfString = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const isArrayOfStringArray = (value: unknown): value is string[][] =>
  Array.isArray(value) &&
  value.every(
    (item) => Array.isArray(item) && item.every((entry) => typeof entry === "string"),
  );

export function parseTemplateArg(argv: string[]): string | null {
  const index = argv.indexOf("--template");

  if (index === -1) {
    return null;
  }

  if (index === argv.length - 1) {
    throw new Error("Missing path after --template");
  }

  const templatePath = argv[index + 1];

  if (!templatePath || templatePath.startsWith("--")) {
    throw new Error("Invalid --template value");
  }

  return templatePath;
}

export function parseModeArg(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--template") {
      i += 1;
      continue;
    }

    if (arg === "--force" || arg.startsWith("--")) {
      continue;
    }

    return arg.toLowerCase();
  }

  return "all";
}

export async function loadTemplate(pathname: string | null): Promise<Template | null> {
  if (!pathname) {
    return null;
  }

  const raw = await fs.readFile(pathname, "utf8");
  const template = JSON.parse(raw) as unknown;

  if (template === null || typeof template !== "object") {
    throw new Error(`Invalid template JSON: ${pathname}`);
  }

  return template as Template;
}

export function cloneArrayOfStrings(values: readonly string[]): string[] {
  return values.map((value) => value.trim());
}
