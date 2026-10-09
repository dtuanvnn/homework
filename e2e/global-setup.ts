import { execSync } from "node:child_process"

/** Every E2E run starts from the same demo data (local database only; the seed refuses others). */
export default function globalSetup() {
  execSync("pnpm db:seed", { stdio: "inherit" })
}
