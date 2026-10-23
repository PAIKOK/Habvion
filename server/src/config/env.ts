import "dotenv/config";
import { parseEnvironment } from "./envSchema.js";

// Parse exactly once at startup. No controllers read process.env.
export const env = parseEnvironment(process.env);
