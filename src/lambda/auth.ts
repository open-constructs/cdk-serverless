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

/**
 * CognitoAuthorizer is an abstract class representing an authorizer
 * that can be used to authenticate and authorize a user through Cognito.
 */
export abstract class CognitoAuthorizer {

  /**
   * The claims of the authenticated user.
   */
  protected claims?: { [name: string]: string | number | boolean | string[] };

  /**
   * Authenticates the user and sets the claims.
   */
  public abstract authenticate(): Promise<void>;

  /**
   * Returns true if the user is authenticated, false otherwise.
   */
  public isAuthenticated(): boolean {
    return this.claims !== undefined;
  }

  /**
   * Throws an UnauthenticatedError if the user is not authenticated.
   */
  public assertAuthenticated(): void {
    if (!this.isAuthenticated()) {
      throw new UnauthenticatedError();
    }
  }

  /**
   * Returns an array of groups the user belongs to, or an empty array if the user
   * is not authenticated or has no groups.
   */
  public getGroups(): string[] {
    if (!this.isAuthenticated() || !this.claims!.hasOwnProperty('cognito:groups')) {
      return [];
    }
    return this.claims!['cognito:groups'] as unknown as string[];
  }

  /**
   * Returns true if the user belongs to the specified group, false otherwise.
   * @param group The name of the group to check.
   */
  public hasGroup(group: string): boolean {
    // 'cognito:groups': [ 'admin' ],
    return this.getGroups().includes(group);
  }

  /**
   * Throws a ForbiddenError if the user is not authenticated or does not belong
   * to the specified group.
   * @param group The name of the group to check.
   */
  public assertGroup(group: string): void {
    this.assertAuthenticated();
    if (!this.hasGroup(group)) {
      throw new ForbiddenError();
    }
  }

  /**
   * Returns true if the user belongs to the 'admin' group, false otherwise.
   */
  public isAdmin(): boolean {
    return this.hasGroup('admin');
  }

  /**
   * Throws a ForbiddenError if the user is not authenticated or is not an admin.
   */
  public assertAdmin(): void {
    this.assertGroup('admin');
  }

  /**
   * Returns the email of the authenticated user.
   */
  public getEMail(): string {
    this.assertAuthenticated();
    return this.claims!.email as string;
  }

  /**
   * Returns the subject of the authenticated user.
   */
  public getSubject(): string {
    this.assertAuthenticated();
    return this.claims!.sub as string;
  }

  /**
   * Returns the value of the claim with the specified name, or undefined if the
   * claim does not exist.
   * @param name The name of the claim to retrieve.
   */
  public getClaim(name: string): string | number | boolean | string[] | undefined {
    this.assertAuthenticated();
    return this.claims![name];
  }
}

/**
 * ApiGatewayv1CognitoAuthorizer is a class that extends CognitoAuthorizer
 * and implements authentication logic for API Gateway v1 requests with a
 * Cognito authorizer.
 */
export class ApiGatewayv1CognitoAuthorizer extends CognitoAuthorizer {

  /**
   * The event that triggered the authorization check.
   */
  constructor(protected event: AWSLambda.APIGatewayProxyWithCognitoAuthorizerEvent, private _logger: logger.LambdaLog) {
    super();
  }

  /**
   * Authenticates the user using the claims provided by the API Gateway event or
   * by decoding a JWT token from the 'Authorization' header.
   */
  public async authenticate(): Promise<void> {
    // Try to get the claims from the event
    this.claims = this.event.requestContext.authorizer?.claims;

    // If no pool ID is defined or claims exist, return early
    if (!cognitoPoolId || this.claims) {
      return;
    }

    // Extract the token from the Authorization header
    const authHeader = this.event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return;
    }
    const token = authHeader.substring('Bearer '.length);

    // Verify the token and set the claims on the event and this object
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

/**
 * ApiGatewayv2CognitoAuthorizer is a class that extends CognitoAuthorizer
 * and implements authentication logic for API Gateway v2 requests with a
 * JWT authorizer.
 */
export class ApiGatewayv2CognitoAuthorizer extends CognitoAuthorizer {

  /**
   * The event that triggered the authorization check.
   */
  constructor(protected event: AWSLambda.APIGatewayProxyEventV2WithJWTAuthorizer, private _logger: logger.LambdaLog) {
    super();
  }

  /**
   * Authenticates the user using the claims provided by the API Gateway event or
   * by decoding a JWT token from the 'Authorization' header.
   */
  public async authenticate(): Promise<void> {
    // Try to get the claims from the event
    this.claims = this.event.requestContext.authorizer?.jwt?.claims;

    // If no pool ID is defined or claims exist, return early
    if (!cognitoPoolId || this.claims) {
      return;
    }

    // Extract the token from the Authorization header
    const authHeader = this.event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return;
    }
    const token = authHeader.substring('Bearer '.length);

    // Verify the token and set the claims on the event and this object
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

/**
 * AppSyncCognitoAuthorizer is a class that extends CognitoAuthorizer
 * and implements authentication logic for AppSync resolver events with a
 * Cognito authorizer.
 */
export class AppSyncCognitoAuthorizer extends CognitoAuthorizer {

  /**
   * The event that triggered the authorization check.
   */
  constructor(protected event: AWSLambda.AppSyncResolverEvent<any>) {
    super();
  }

  /**
   * Authenticates the user using the claims provided by the AppSync event.
   */
  public async authenticate(): Promise<void> {
    // Try to get the claims from the event
    if (this.event.identity) {
      this.claims = (this.event.identity as AWSLambda.AppSyncIdentityCognito).claims;
    }
  }

}
