// Odoo JSON-RPC client (no external dependency).
// Uses the standard /jsonrpc endpoint with an Odoo API key as password.

export type OdooCreds = {
  url: string;
  db_name: string;
  username: string;
  api_key: string;
};

function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

async function rpc(url: string, params: unknown) {
  const res = await fetch(`${normalizeUrl(url)}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params, id: Date.now() }),
  });
  if (!res.ok) throw new Error(`Odoo a répondu ${res.status}`);
  const json = (await res.json()) as {
    result?: unknown;
    error?: { message?: string; data?: { message?: string } };
  };
  if (json.error) {
    throw new Error(json.error.data?.message || json.error.message || "Erreur Odoo");
  }
  return json.result;
}

export async function odooLogin(creds: OdooCreds): Promise<number> {
  const uid = (await rpc(creds.url, {
    service: "common",
    method: "login",
    args: [creds.db_name, creds.username, creds.api_key],
  })) as number | false;
  if (!uid) throw new Error("Identifiants Odoo refusés (base, utilisateur ou clé API).");
  return uid;
}

export async function odooCall<T = unknown>(
  creds: OdooCreds,
  uid: number,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  return (await rpc(creds.url, {
    service: "object",
    method: "execute_kw",
    args: [creds.db_name, uid, creds.api_key, model, method, args, kwargs],
  })) as T;
}
