import fs from "node:fs/promises";

export async function loadEnv(file = ".env"): Promise<void> {
  try {
    const text = await fs.readFile(file, "utf8");

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const index = line.indexOf("=");

      if (index <= 0) {
        continue;
      }

      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } else {
        const commentIndex = value.indexOf(" #");

        if (commentIndex >= 0) {
          value = value.slice(0, commentIndex).trim();
        }
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      throw error;
    }
  }
}

export function envString(name: string, fallback: string): string {
  const value = process.env[name];

  return value === undefined || value === "" ? fallback : value;
}

export function envInt(
  name: string,
  fallback: number,
  min: number = -Infinity,
  max: number = Infinity,
): number {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);

  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid integer env ${name}=${JSON.stringify(raw)}`);
  }

  return value;
}

export function envFloat(
  name: string,
  fallback: number,
  min: number = -Infinity,
  max: number = Infinity,
): number {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number.parseFloat(raw);

  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid number env ${name}=${JSON.stringify(raw)}`);
  }

  return value;
}

export function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = raw.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  throw new Error(`Invalid boolean env ${name}=${JSON.stringify(raw)}`);
}
