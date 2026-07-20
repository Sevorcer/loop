"use client";

export function getDevRole() {
  if (typeof window === "undefined") {
    return "owner";
  }

  return window.localStorage.getItem("loop_dev_role") ?? "owner";
}

export async function requestLoopApiJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-loop-role": getDevRole(),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed.");
  }

  return payload;
}
