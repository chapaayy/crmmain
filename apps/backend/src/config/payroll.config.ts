import { registerAs } from "@nestjs/config";

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

export default registerAs("payroll", () => ({
  currency: process.env.PAYROLL_CURRENCY ?? "RUB",
  timezone: process.env.PAYROLL_TIMEZONE ?? "Europe/Berlin",
  defaultWorkdayHours: Number(process.env.PAYROLL_DEFAULT_WORKDAY_HOURS ?? 8),
  overtimeMultiplier: Number(process.env.PAYROLL_OVERTIME_MULTIPLIER ?? 1.5),
  enableSalesCommission: parseBoolean(process.env.PAYROLL_ENABLE_SALES_COMMISSION, true),
  enableAttendance: parseBoolean(process.env.PAYROLL_ENABLE_ATTENDANCE, true)
}));
