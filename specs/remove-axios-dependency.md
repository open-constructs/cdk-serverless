# Spec: Remove the `axios` Runtime Dependency

Status: Proposed
Author: open-constructs
Target: `cdk-serverless@next` (minor or major release — see Breaking Changes)

## Summary

Drop `axios` as a runtime dependency of `cdk-serverless` by replacing every
call site with the platform-native `fetch` API. `axios` is currently declared
in `dependencies` (`^1.15.0`, `package.json:77`) and therefore ships into
every Lambda bundle that pulls in `cdk-serverless/lambda`, and into every
test workspace that pulls in `cdk-serverless/tests`.

The Node.js `fetch` global has been stable since Node 21 and available since
Node 18. The Lambda functions created by this library use
`Runtime.NODEJS_LATEST` (`src/constructs/func.ts:145`), which today resolves
to Node 22, so the runtime requirement is already met.

## Motivation

1. **Smaller Lambda bundles.** `axios` is bundled into the JWT-verifying code
   path that ships with every cdk-serverless Lambda using `auth.ts`. The
   minified+gzipped cost of axios is ~15 KB; with `fetch` that drops to 0.
2. **Smaller dependency surface.** One fewer third-party runtime dependency
   to track for supply-chain and CVE management. axios has had several
   security advisories (CVE-2023-45857, CVE-2024-39338, etc.) which forced
   downstream upgrades in this library before.
3. **Cleaner peer story.** With `axios` gone, the `dependencies` section
   only contains things consumers genuinely need at runtime. `@types/aws-lambda`
   stays for typed handler shapes, and we keep the small set of crypto/JWT
   libs.
4. **Alignment with platform.** AWS Lambda's managed Node runtime ships
   `fetch` and `undici` natively; using them avoids re-shipping HTTP client
   code that the runtime already provides.

## Non-Goals

- Replacing `jsonwebtoken` / `jwk-to-pem`. These do crypto, not HTTP, and
  there is no equivalent built-in.
- Replacing the AWS SDK clients used in `IntegTestUtil` (Cognito, DynamoDB).
- Adding a new HTTP abstraction layer. `fetch` is the abstraction.
- Changing the JWT verification flow itself (token discovery, JWKS caching
  behavior, claims shape).

## Current Usage

`axios` is imported from exactly two source files:

### 1. `src/lambda/auth.ts` — runtime (ships in Lambda bundles)

```ts
import Axios from 'axios';
// ...
const publicKeys: PublicKeys =
  (await Axios.get<PublicKeys>(jwksUrl)).data;                    // line 47
// ...
const issuerMetadata =
  (await Axios.get<IssuerMetadata>(wellKnownUri)).data;           // line 65
```

Both calls are plain GETs against well-known JSON endpoints (the issuer's
`/.well-known` discovery document and the JWKS URL). Response is parsed as
JSON. No retry, no interceptors, no custom transports — trivially mappable
to `fetch(url).then(r => r.json())`.

### 2. `src/tests/integ-test-util.ts` — test utility (consumer-facing API)

```ts
import { Axios, AxiosRequestConfig, HttpStatusCode } from 'axios';

public getClient(config?: AxiosRequestConfig) { return new Axios({...}); }   // line 78
public async getAuthenticatedClient(email, password?, config?) { ... }       // line 99
protected async loginUser(email, password) {
  const cognitoClient = new Axios({ baseURL: '...' });                       // line 204
  const auth = await cognitoClient.post('/', JSON.stringify({...}), {...});
}
```

This file is exported via `src/tests/index.ts` and is part of the **public
API** of `cdk-serverless/tests`. `getClient()` and `getAuthenticatedClient()`
both **return an `Axios` instance** and accept an `AxiosRequestConfig`.
Consumers writing integration tests call `.get()` / `.post()` etc. on the
returned client.

## Proposed Changes

### Phase 1 — `src/lambda/auth.ts` (no breaking change)

Replace the two `Axios.get` calls with `fetch`. The function signatures and
exported types in `auth.ts` do not expose axios, so this is a pure internal
refactor.

```ts
const getPublicKeys = async (jwksUrl: string): Promise<MapOfKidToPublicKey> => {
  if (!cacheKeys) {
    const res = await fetch(jwksUrl);
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    const publicKeys = (await res.json()) as PublicKeys;
    cacheKeys = publicKeys.keys.reduce(/* ... unchanged ... */);
  }
  return cacheKeys;
};

const getJwksUri = async (discoveryUri: string, jwksUri?: string): Promise<string> => {
  if (jwksUri) return jwksUri;
  const res = await fetch(`${discoveryUri}/.well-known`);
  if (!res.ok) throw new Error(`Issuer metadata fetch failed: ${res.status}`);
  const issuerMetadata = (await res.json()) as IssuerMetadata;
  if (!issuerMetadata.jwks_uri) throw new Error('Issuer does not offer JWKS endpoint');
  return issuerMetadata.jwks_uri;
};
```

Behavior delta vs. axios:
- axios throws on non-2xx by default; `fetch` does not. We add an explicit
  `if (!res.ok)` check at each call site to preserve the prior behavior.
- axios JSON-parses based on response `Content-Type`; we call `res.json()`
  explicitly. The two endpoints (JWKS, well-known) are spec-defined to
  return JSON.
- Error shape changes (no `AxiosError`). Callers in this file already wrap
  with try/catch and log via `lambda-log`, so the visible behavior is the
  same.

### Phase 2 — `src/tests/integ-test-util.ts` (breaking change for tests/integ consumers)

Two options, choose one before implementation:

**Option A — Replace return type with a thin `fetch`-based client (breaking).**
Introduce a small internal `HttpClient` class with the methods consumers
actually use (`get`, `post`, optional `put`/`delete`/`patch`), backed by
`fetch`. Update the exported signatures:

```ts
public getClient(config?: HttpClientConfig): HttpClient { ... }
public async getAuthenticatedClient(email, password?, config?): Promise<HttpClient> { ... }
```

`HttpClientConfig` covers the fields actually used today: `baseURL`,
`headers`, `transformRequest`, `transformResponse`. The `loginUser` flow
is rewritten internally to call `fetch` directly against the Cognito
endpoint.

This is the cleanest end state. It is a breaking change for anyone
chaining axios-specific methods (`interceptors`, `defaults`, etc.) on
the returned client — but the existing public surface in this repo only
uses `.get`/`.post` with `baseURL` and headers.

**Option B — Keep axios in `IntegTestUtil`, move to `devDependencies`/`peerDependencies`.**
Remove axios only from `auth.ts`. Move axios from `dependencies` to
`peerDependencies` (optional) in `package.json` so it is no longer pulled
in transitively by consumers who only use the Lambda runtime helpers.
Consumers who use `cdk-serverless/tests` add `axios` to their own
`devDependencies` (standard for test utilities).

This is **lower risk** and still removes axios from production Lambda
bundles, but leaves an axios dep in the picture for test consumers.

**Recommendation: Option A.** The public surface of the integ-test client
is small, the migration is mechanical (replace `client.get('/x').then(r => r.data)`
with `client.get('/x').then(r => r.json())`), and the end state — zero
axios — is clean. Bundle as a `feat!`/major in the next breaking release.

### Phase 3 — Cleanup

- Remove `axios` from `dependencies` in `package.json`.
- Remove `'axios'` from `deps` in `.projenrc.ts:20`.
- Run `npx projen` to regenerate `package.json` and lockfile.
- Verify no transitive axios in the produced Lambda bundles via
  `esbuild --analyze` or `npm ls axios` showing empty.

## API Impact

| Symbol | Before | After (Option A) | Breaking? |
|---|---|---|---|
| `auth.ApiGatewayv1JwtAuthorizer` and friends | — | — | No (internal only) |
| `tests.IntegTestUtil#getClient` | returns `Axios` | returns `HttpClient` | **Yes** |
| `tests.IntegTestUtil#getAuthenticatedClient` | returns `Promise<Axios>` | returns `Promise<HttpClient>` | **Yes** |
| `tests.IntegTestUtil#getClient(config)` | `AxiosRequestConfig` | `HttpClientConfig` (subset) | **Yes** |

Migration note for consumers of `IntegTestUtil`:
- `client.get(path).then(r => r.data)` → `client.get(path).then(r => r.json())`
- `client.post(path, JSON.stringify(body), { headers })` → same shape, but
  the response shape differs (no `.data`, no `.status` — use `.ok`, `.status`,
  `.json()`).

## Testing

1. **Unit tests** — exercise `auth.ts` against a local HTTP server that
   serves a mock `/.well-known` document and JWKS. Confirm:
   - Successful key fetch and PEM conversion (cache populated once).
   - 5xx from JWKS endpoint surfaces as an error (existing behavior).
   - Missing `jwks_uri` in metadata throws.
2. **Lambda test utilities** — update existing `lambda-test-utils.ts` tests
   if any depend on the axios import path (none today, but verify).
3. **Integ tests** — re-run any integ test in this repo that uses
   `IntegTestUtil` against a real Cognito user pool to confirm
   `getClient`/`getAuthenticatedClient`/`loginUser` paths work with the
   new client.
4. **Bundle size check** — run `esbuild` over `src/lambda/handler.ts` before
   and after to record the delta. Include the number in the PR description.

## Alternatives Considered

1. **`node-fetch` or `undici` directly.** `node-fetch` is a polyfill we
   don't need; `undici` is what `fetch` is built on, but using it directly
   adds a runtime dep without benefit. Native `fetch` is the right call.
2. **Keep axios, pin tighter, add interceptors for fetch-like ergonomics.**
   Doesn't address bundle size or supply-chain motivations.
3. **Vendor a tiny `http`/`https` wrapper.** Works on older Node, but the
   minimum supported runtime here (`NODEJS_LATEST`) makes `fetch` strictly
   better.

## Rollout

1. Land Phase 1 (`auth.ts` only) as a non-breaking `chore:` or `refactor:`
   commit. This already removes axios from the **Lambda runtime** code path
   even before the API is changed.
2. Land Phase 2 (`IntegTestUtil`) as a `feat!:` commit gated to a major
   bump. Document the migration in the release notes / CHANGELOG.
3. Land Phase 3 (`package.json` / `.projenrc.ts` cleanup) together with
   Phase 2.

If we choose Option B instead, Phase 2 becomes a `chore:` (move axios to
peerDependencies, document in README) and there is no major bump.

## Open Questions

1. **Option A vs. Option B** — accept a breaking change in `IntegTestUtil`,
   or keep axios there and just move it to `peerDependencies`? (Recommendation
   above is A.)
2. **Cache invalidation on fetch failure** — should we clear `cacheKeys` if
   a JWKS rotation makes a previously-cached `kid` invalid? Out of scope for
   this spec, but worth filing as a follow-up if not already tracked.
3. **Timeout behavior** — `fetch` has no default timeout. Should we wrap
   the JWKS/well-known fetches with `AbortSignal.timeout(5000)`? axios also
   had no default timeout in our usage, so behavior parity is preserved
   without it — but adding one is cheap and prevents a hang on a dead JWKS
   host from blocking a cold start. Recommendation: add
   `AbortSignal.timeout(5000)`.
