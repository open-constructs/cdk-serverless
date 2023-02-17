import { env } from 'process';
import Axios from 'axios';
import { verify, JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
// import jwkToPem = require('jwk-to-pem');
import jwkToPem from 'jwk-to-pem';
import logger from 'lambda-log';
import { ForbiddenError, UnauthenticatedError } from './errors';

const cognitoPoolId = env.USER_POOL_ID ?? '';
const cognitoPoolRegion = env.USER_POOL_REGION ?? env.AWS_REGION ?? 'eu-central-1';
const cognitoIssuer = `https://cognito-idp.${cognitoPoolRegion}.amazonaws.com/${cognitoPoolId}`;

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

interface MapOfKidToPublicKey {
  [key: string]: PublicKeyMeta;
}

let cacheKeys: MapOfKidToPublicKey | undefined;
const getPublicKeys = async (): Promise<MapOfKidToPublicKey> => {
  if (!cacheKeys) {
    const url = `${cognitoIssuer}/.well-known/jwks.json`;

    const publicKeys: PublicKeys = (await Axios.get<PublicKeys>(url)).data;
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

const promisedVerify = (token: string): Promise<{ [name: string]: string }> => {
  return new Promise((resolve, reject) => {
    verify(token, (header: JwtHeader, cb: SigningKeyCallback) => {
      if (!header.kid) {
        cb(new Error('no key id found'));
      }
      getPublicKeys().then((keys) => {
        cb(null, keys[header.kid!].pem);
      }, cb);
    }, { issuer: cognitoIssuer }, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as { [name: string]: string });
      }
    });
  });
};

export abstract class CognitoAuthorizer {

  protected claims?: { [name: string]: string | number | boolean | string[] };

  public abstract authenticate(): Promise<void>;

  public isAuthenticated(): boolean {
    return this.claims !== undefined;
  }

  public assertAuthenticated(): void {
    if (!this.isAuthenticated()) {
      throw new UnauthenticatedError();
    }
  }

  public getGroups(): string[] {
    if (!this.isAuthenticated() || !this.claims!.hasOwnProperty('cognito:groups')) {
      return [];
    }
    return this.claims!['cognito:groups'] as unknown as string[];
  }

  public hasGroup(group: string): boolean {
    // 'cognito:groups': [ 'admin' ],
    return this.getGroups().includes(group);
  }

  public assertGroup(group: string): void {
    this.assertAuthenticated();
    if (!this.hasGroup(group)) {
      throw new ForbiddenError();
    }
  }

  public isAdmin(): boolean {
    return this.hasGroup('admin');
  }

  public assertAdmin(): void {
    this.assertGroup('admin');
  }

  public getEMail(): string {
    this.assertAuthenticated();
    return this.claims!.email as string;
  }

  public getSubject(): string {
    this.assertAuthenticated();
    return this.claims!.sub as string;
  }

  public getClaim(name: string): string | number | boolean | string[] | undefined {
    this.assertAuthenticated();
    return this.claims![name];
  }
}

export class ApiGatewayv1CognitoAuthorizer extends CognitoAuthorizer {

  constructor(protected event: AWSLambda.APIGatewayProxyWithCognitoAuthorizerEvent, private _logger: logger.LambdaLog) {
    super();
  }

  public async authenticate(): Promise<void> {
    this.claims = this.event.requestContext.authorizer?.claims;

    if (!cognitoPoolId || this.claims) {
      return;
    }
    const authHeader = this.event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return;
    }
    const token = authHeader.substring('Bearer '.length);
    try {
      const claims: { [name: string]: string } = await promisedVerify(token);
      this._logger.debug(JSON.stringify(claims));

      this.event.requestContext.authorizer = { claims };
      this.claims = claims;
    } catch (err: any) {
      this._logger.error(err);
    }
  }

}


export class ApiGatewayv2CognitoAuthorizer extends CognitoAuthorizer {

  constructor(protected event: AWSLambda.APIGatewayProxyEventV2WithJWTAuthorizer, private _logger: logger.LambdaLog) {
    super();
  }

  public async authenticate(): Promise<void> {
    this.claims = this.event.requestContext.authorizer?.jwt?.claims;

    if (!cognitoPoolId || this.claims) {
      return;
    }
    const authHeader = this.event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return;
    }
    const token = authHeader.substring('Bearer '.length);
    try {
      const claims: { [name: string]: string } = await promisedVerify(token);
      this._logger.debug(JSON.stringify(claims));

      this.event.requestContext.authorizer = {
        jwt: {
          claims,
          scopes: ['openid', 'email'],
        },
        integrationLatency: 0,
        principalId: 'toolbox',
      };
      this.claims = claims;
    } catch (err: any) {
      this._logger.error(err);
    }
  }

}

export class AppSyncCognitoAuthorizer extends CognitoAuthorizer {

  constructor(protected event: AWSLambda.AppSyncResolverEvent<any>) {
    super();
  }

  public async authenticate(): Promise<void> {
    if (this.event.identity) {
      this.claims = (this.event.identity as AWSLambda.AppSyncIdentityCognito).claims;
    }
  }

}