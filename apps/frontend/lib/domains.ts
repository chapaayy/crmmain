export type WorkspaceMode = "crm" | "admin";

export function getHostMode(hostname?: string | null): WorkspaceMode {
  const host = hostname?.split(":")[0];
  const adminHost = getUrlHost(process.env.NEXT_PUBLIC_ADMIN_URL) ?? process.env.ADMIN_DOMAIN;

  return host && adminHost && host === adminHost ? "admin" : "crm";
}

export function getUrlHost(url?: string) {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).host.split(":")[0];
  } catch {
    return undefined;
  }
}
