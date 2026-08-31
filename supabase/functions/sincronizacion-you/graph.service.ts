import type {
  EnvConfig,
  GraphBatchResult,
  GraphListResponse,
  GraphTokenResponse,
  SharePointItem,
} from "./types.ts";
import { createAbortSignal, sanitizeErrorMessage } from "./utils.ts";
import { MicrosoftGraphError, MicrosoftOAuthError } from "./types.ts";

export class GraphService {
  constructor(private readonly config: EnvConfig) {}

  async fetchItemsBatch(
    sharePointItemId: string | null,
    offset: number,
    limit: number,
  ): Promise<GraphBatchResult> {
    const token = await this.getAccessToken();
    if (sharePointItemId) {
      const item = await this.fetchItemById(token, sharePointItemId);
      return {
        items: item ? [item] : [],
        totalAvailable: item ? 1 : 0,
        hasMore: false,
        nextOffset: 0,
        offsetUsed: 0,
      };
    }
    return await this.fetchBatchByOffset(token, offset, limit);
  }

  private async getAccessToken(): Promise<string> {
    const url = `https://login.microsoftonline.com/${this.config.msTenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.config.msClientId,
      client_secret: this.config.msClientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: createAbortSignal(this.config.graphTimeoutMs),
      });
    } catch (error) {
      throw new MicrosoftOAuthError(sanitizeErrorMessage(error));
    }

    if (!response.ok) {
      throw new MicrosoftOAuthError(`Microsoft OAuth respondio ${response.status}`);
    }

    const payload = (await response.json()) as GraphTokenResponse;
    if (!payload.access_token) {
      throw new MicrosoftOAuthError();
    }
    return payload.access_token;
  }

  private async fetchItemById(token: string, itemId: string): Promise<SharePointItem | null> {
    const url =
      `https://graph.microsoft.com/v1.0/sites/${this.config.msSiteId}/lists/${this.config.msListId}/items/${encodeURIComponent(itemId)}?$expand=fields`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: createAbortSignal(this.config.graphTimeoutMs),
      });
    } catch (error) {
      throw new MicrosoftGraphError(sanitizeErrorMessage(error));
    }

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new MicrosoftGraphError(`SharePoint respondio ${response.status}`);
    }

    const item = (await response.json()) as { id: string; fields?: Record<string, unknown> };
    return { id: item.id, fields: item.fields ?? {} };
  }

  private async fetchBatchByOffset(token: string, offset: number, limit: number): Promise<GraphBatchResult> {
    const items: SharePointItem[] = [];
    let nextUrl =
      `https://graph.microsoft.com/v1.0/sites/${this.config.msSiteId}/lists/${this.config.msListId}/items?$expand=fields`;
    let currentIndex = 0;

    while (nextUrl) {
      this.ensureGraphNextLink(nextUrl);

      let response: Response;
      try {
        response = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: createAbortSignal(this.config.graphTimeoutMs),
        });
      } catch (error) {
        throw new MicrosoftGraphError(sanitizeErrorMessage(error));
      }

      if (!response.ok) {
        throw new MicrosoftGraphError(`SharePoint respondio ${response.status}`);
      }

      const payload = (await response.json()) as GraphListResponse;
      const pageItems = payload.value ?? [];

      for (const rawItem of pageItems) {
        if (currentIndex >= offset && items.length < limit) {
          items.push({
            id: rawItem.id,
            fields: rawItem.fields ?? {},
          });
        }
        currentIndex += 1;
      }

      const followingUrl = payload["@odata.nextLink"] ?? "";
      const hasMoreInCurrentPage = currentIndex > offset + items.length;
      if (items.length >= limit) {
        const hasMore = hasMoreInCurrentPage || Boolean(followingUrl);
        return {
          items,
          totalAvailable: null,
          hasMore,
          nextOffset: hasMore ? offset + items.length : 0,
          offsetUsed: offset,
        };
      }

      nextUrl = followingUrl;
    }

    return {
      items,
      totalAvailable: currentIndex,
      hasMore: false,
      nextOffset: 0,
      offsetUsed: offset,
    };
  }

  private ensureGraphNextLink(url: string): void {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "graph.microsoft.com") {
      throw new MicrosoftGraphError("Se rechazo un @odata.nextLink invalido");
    }
  }
}
