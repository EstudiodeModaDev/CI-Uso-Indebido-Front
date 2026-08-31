// Cliente mínimo de Microsoft Graph: auth por client credentials + lectura paginada
// de items de una lista de SharePoint.

export interface SharePointItem {
  id: string;
  fields: Record<string, unknown>;
}

interface GraphTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export async function getGraphToken(): Promise<string> {
  const tenantId = Deno.env.get("MS_TENANT_ID");
  const clientId = Deno.env.get("MS_CLIENT_ID");
  const clientSecret = Deno.env.get("MS_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Faltan variables de entorno MS_TENANT_ID, MS_CLIENT_ID o MS_CLIENT_SECRET",
    );
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Autenticación contra Graph falló (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as GraphTokenResponse;
  return data.access_token;
}

export async function fetchAllListItems(token: string): Promise<SharePointItem[]> {
  const siteId = Deno.env.get("MS_SITE_ID");
  const listId = Deno.env.get("MS_LIST_ID");

  if (!siteId || !listId) {
    throw new Error("Faltan variables de entorno MS_SITE_ID o MS_LIST_ID");
  }

  let url: string | null =
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`;

  const items: SharePointItem[] = [];

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Lectura de items de SharePoint falló (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();

    for (const raw of data.value ?? []) {
      items.push({ id: raw.id, fields: raw.fields ?? {} });
    }

    url = data["@odata.nextLink"] ?? null;
  }

  return items;
}
