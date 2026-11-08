import "server-only";
import { z } from "zod";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

const schema = z.object({
  DB_SERVER: z.string().refine((value) => LOCAL_HOSTS.includes(value.toLowerCase()), "DB_SERVER must be a local address"),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: z.literal("FirstSteps_Dev"),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_ENCRYPT: z.enum(["true", "false"]).default("true"),
  DB_TRUST_SERVER_CERT: z.enum(["true", "false"]).default("false"),
  SESSION_SECRET: z.string().min(32),
});

let cached: z.infer<typeof schema> | undefined;

export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`Invalid server configuration (${fields}). Run npm run db:local:setup.`);
    }
    cached = parsed.data;
  }
  return cached;
}
