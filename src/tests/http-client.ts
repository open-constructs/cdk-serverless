/**
 * A minimal HTTP client used by IntegTestUtil, backed by the native `fetch`
 * API. It exists to keep the integration-test API stable while removing the
 * `axios` runtime dependency.
 */

export interface HttpClientConfig {
  /**
   * Base URL prepended to relative paths passed to client methods.
   */
  readonly baseURL?: string;

  /**
   * Default headers applied to every request issued by this client.
   * Per-request headers override these on collision.
   */
  readonly headers?: Record<string, string>;
}

export interface HttpClientRequestOptions {
  /**
   * Per-request headers, merged on top of the client's default headers.
   */
  readonly headers?: Record<string, string>;
}

/**
 * Response wrapper returned by every `HttpClient` request method.
 */
export class HttpClientResponse {
  public readonly status: number;
  public readonly ok: boolean;
  public readonly headers: Headers;
  public readonly body: string;

  constructor(status: number, ok: boolean, headers: Headers, body: string) {
    this.status = status;
    this.ok = ok;
    this.headers = headers;
    this.body = body;
  }

  /**
   * Parse the response body as JSON. Throws if the body is not valid JSON.
   */
  public json<T = unknown>(): T {
    return JSON.parse(this.body) as T;
  }
}

export class HttpClient {
  private readonly baseURL?: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: HttpClientConfig = {}) {
    this.baseURL = config.baseURL;
    this.defaultHeaders = { ...(config.headers ?? {}) };
  }

  public get(path: string, options?: HttpClientRequestOptions): Promise<HttpClientResponse> {
    return this.request('GET', path, undefined, options);
  }

  public delete(path: string, options?: HttpClientRequestOptions): Promise<HttpClientResponse> {
    return this.request('DELETE', path, undefined, options);
  }

  public post(path: string, body?: unknown, options?: HttpClientRequestOptions): Promise<HttpClientResponse> {
    return this.request('POST', path, body, options);
  }

  public put(path: string, body?: unknown, options?: HttpClientRequestOptions): Promise<HttpClientResponse> {
    return this.request('PUT', path, body, options);
  }

  public patch(path: string, body?: unknown, options?: HttpClientRequestOptions): Promise<HttpClientResponse> {
    return this.request('PATCH', path, body, options);
  }

  private async request(method: string, path: string, body: unknown, options?: HttpClientRequestOptions): Promise<HttpClientResponse> {
    const url = this.resolveUrl(path);
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(options?.headers ?? {}),
    };

    let requestBody: BodyInit | undefined;
    if (body !== undefined && body !== null) {
      if (typeof body === 'string') {
        requestBody = body;
      } else {
        requestBody = JSON.stringify(body);
        if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    const res = await fetch(url, { method, headers, body: requestBody });
    const responseBody = await res.text();
    return new HttpClientResponse(res.status, res.ok, res.headers, responseBody);
  }

  private resolveUrl(path: string): string {
    if (!this.baseURL) {
      return path;
    }
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    const base = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
  }
}
