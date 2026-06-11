import { env } from 'process';
import { verify, JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwkToPem from 'jwk-to-pem';

const jwtIssuerUrl = env.JWT_ISSUER_URL ?? '';
const jwtJwksUrl = env.JWT_JWKS_URL;
const jwtAudience = (env.JWT_AUDIENCE_URL && env.JWT_AUDIENCE_URL.length > 0) ? env.JWT_AUDIENCE_URL.split('||') : undefined;

interface PublicKey {
  alg: string;
  e: string;
  kid: string;
  kty: string;
  n: string;
  use: string;
}

interface PublicKeyMeta {
  instance: PublicKey;
  pem: string;
}

interface PublicKeys {
  keys: PublicKey[];
}

interface IssuerMetadata {
  jwks_uri?: string;
  [key: string]: unknown;
}

interface MapOfKidToPublicKey {
  [key: string]: PublicKeyMeta;
}

let cacheKeys: MapOfKidToPublicKey | undefined;

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    throw new Error(`Request to ${url} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
};

const getPublicKeys = async (jwksUrl: string): Promise<MapOfKidToPublicKey> => {
  if (!cacheKeys) {
    const publicKeys = await fetchJson<PublicKeys>(jwksUrl);
    cacheKeys = publicKeys.keys.reduce((agg, current) => {
      const pem = jwkToPem(current as jwkToPem.JWK);
      agg[current.kid] = { instance: current, pem };
      return agg;
    }, {} as MapOfKidToPublicKey);
    return cacheKeys;
  } else {
    return cacheKeys;
  }
};

const getJwksUri = async (discoveryUri: string, jwksUri?: string): Promise<string> => {
  if (jwksUri) {
    return jwksUri;
  }
  const wellKnownUri = `${discoveryUri}/.well-known`;
  const issuerMetadata = await fetchJson<IssuerMetadata>(wellKnownUri);
  if (!issuerMetadata.jwks_uri) {
    throw new Error('Issuer does not offer JWKS endpoint');
  }
  return issuerMetadata.jwks_uri;
};

const promisedVerify = (token: string, issuerUri: string, jwksUri?: string): Promise<{ [name: string]: string }> => {
  return new Promise((resolve, reject) => {
    verify(token, (header: JwtHeader, cb: SigningKeyCallback) => {
      if (!header.kid) {
        cb(new Error('no key id found'));
      }
      getJwksUri(issuerUri, jwksUri).then(getPublicKeys).then((keys) => {
        cb(null, keys[header.kid!].pem);
      }, cb);
    }, { issuer: issuerUri, audience: jwtAudience as [string, ...string[]] }, (err: any, decoded: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as { [name: string]: string });
      }
    });
  });
};

function generatePolicy(principalId: string, effect: 'Allow' | 'Deny', resource: string, context?: { [key: string]: string }): AWSLambda.APIGatewayAuthorizerResult {
  const policyDocument: AWSLambda.PolicyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      },
    ],
  };

  return {
    principalId,
    policyDocument,
    ...(context && { context }),
  };
}

export async function handler(event: AWSLambda.APIGatewayTokenAuthorizerEvent): Promise<AWSLambda.APIGatewayAuthorizerResult> {
  const token = event.authorizationToken;

  if (!token || !token.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const jwtToken = token.substring('Bearer '.length);

  try {
    const claims = await promisedVerify(jwtToken, jwtIssuerUrl, jwtJwksUrl);

    const context: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(claims)) {
      if (typeof value === 'string') {
        context[key] = value;
      } else {
        context[key] = JSON.stringify(value);
      }
    }

    return generatePolicy(claims.sub || 'user', 'Allow', event.methodArn, context);
  } catch (err) {
    throw new Error('Unauthorized');
  }
}
