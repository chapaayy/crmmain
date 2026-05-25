import appConfig from "./app.config";
import databaseConfig from "./database.config";
import jwtConfig from "./jwt.config";
import payrollConfig from "./payroll.config";
import { validateEnv } from "./env.validation";

export const configs = [appConfig, databaseConfig, jwtConfig, payrollConfig];
export { validateEnv };
