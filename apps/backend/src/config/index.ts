import appConfig from "./app.config";
import databaseConfig from "./database.config";
import jwtConfig from "./jwt.config";
import { validateEnv } from "./env.validation";

export const configs = [appConfig, databaseConfig, jwtConfig];
export { validateEnv };
