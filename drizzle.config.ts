import { defineConfig } from "drizzle-kit";
import environment from "@server/environment";
import path from "path";

export default defineConfig({
    dialect: "sqlite",
    schema: path.join(__dirname, "server", "db", "schema.ts"),
    out: path.join(__dirname, "server", "migrations"),
    verbose: true,
    dbCredentials: {
        url: path.join(environment.CONFIG_PATH, "db", "db.sqlite"),
    },
});
