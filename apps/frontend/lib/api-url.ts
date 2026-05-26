export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    return "/api";
  }

  return process.env.NEXT_PUBLIC_API_URL || "/api";
}
