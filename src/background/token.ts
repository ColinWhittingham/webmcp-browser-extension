const HOST_NAME = 'com.webmcp.gcloud_token';

async function fetchToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(
      HOST_NAME,
      { type: 'get_token' },
      (response: unknown) => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message ?? 'Native host connection failed';
          reject(new Error(
            `${msg}\n\nRun native-host/install.ps1 to register the gcloud token provider.`,
          ));
          return;
        }
        const r = response as { token?: string; error?: string } | undefined;
        if (!r?.token) {
          reject(new Error(r?.error ?? 'No token returned from native host'));
          return;
        }
        resolve(r.token);
      },
    );
  });
}

/**
 * Get a GCP access token via the local gcloud native messaging host.
 * gcloud handles its own token caching and refresh internally.
 */
export async function getGCPToken(): Promise<string> {
  return fetchToken();
}

/**
 * Make a fetch request authenticated with a GCP token.
 * Retries once on 401 by asking gcloud for a fresh token.
 */
export async function fetchWithGCPAuth(
  url: string,
  init: Omit<RequestInit, 'headers'>,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const makeHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  });

  const token = await getGCPToken();
  const response = await fetch(url, { ...init, headers: makeHeaders(token) });

  if (response.status === 401) {
    // gcloud may have returned a stale cached token; request again to get a fresh one
    const freshToken = await getGCPToken();
    return fetch(url, { ...init, headers: makeHeaders(freshToken) });
  }

  return response;
}
