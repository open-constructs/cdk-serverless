import { env } from 'process';
import logger, { LambdaLog } from 'lambda-log';
import * as appsyncErrors from './appsync-errors';
import {
  ApiGatewayv1CognitoAuthorizer,
  ApiGatewayv1JwtAuthorizer,
  AppSyncCognitoAuthorizer,
  CognitoAuthorizer,
  JwtAuthorizer,
} from './auth';
import * as errors from './errors';


/////////////////////////////////
/// HTTP Api
/////////////////////////////////

/**
 * An object containing the properties for an HTTP response.
 */
export interface HttpResponseContext {
  statusCode?: number;
  headers: { [name: string]: string };
  json: boolean;
}

/**
 * An object containing the properties for an HTTP request handler.
 */
export interface HttpHandlerContext {
  event: AWSLambda.APIGatewayProxyWithCognitoAuthorizerEvent;
  lambdaContext: AWSLambda.Context;
  logger: logger.LambdaLog;
  response: HttpResponseContext;
  auth: JwtAuthorizer;
}

/**
 * A type definition for an HTTP handler.
 */
export type HttpHandler<T, R> = (
  context: HttpHandlerContext,
  body: T,
) => Promise<R>;

/**
 * An object containing the properties for an OpenAPI operation.
 */
export interface Operation {
  responses: {
    [statusCode: number]: {
      content: {
        'application/json': any;
      };
    } | any;
  };
}

/**
 * A type definition for an API Gateway v1 request handler.
 */
export type APIGatewayv1Handler =
  AWSLambda.Handler<AWSLambda.APIGatewayProxyWithCognitoAuthorizerEvent, AWSLambda.APIGatewayProxyResult | undefined>;

/**
 * An object containing the properties for an OpenAPI operation with a request body.
 */
export interface OperationWithRequestBody extends Operation {
  requestBody: { content: { 'application/json': any } };
}

/**
 * A factory function that creates an HTTP request handler for an OpenAPI operation with a request body.
 */
export const createOpenApiHandlerWithRequestBody = <OP extends OperationWithRequestBody, SC extends number = 200>(handler: HttpHandler<OP['requestBody']['content']['application/json'], OP['responses'][SC]['content']['application/json']>): APIGatewayv1Handler => {
  return createHttpHandler(handler);
};

/**
 * A factory function that creates an HTTP request handler for an OpenAPI operation with a request body and no response.
 */
export const createOpenApiHandlerWithRequestBodyNoResponse = <OP extends OperationWithRequestBody>(handler: HttpHandler<OP['requestBody']['content']['application/json'], void>): APIGatewayv1Handler => {
  return createHttpHandler(handler);
};

/**
 * A factory function that creates an HTTP request handler for an OpenAPI operation.
 */
export const createOpenApiHandler = <OP extends Operation, SC extends number = 200>(handler: HttpHandler<any, OP['responses'][SC]['content']['application/json']>): APIGatewayv1Handler => {
  return createHttpHandler(handler);
};

/**
 * Create an authorizer for the authentication method chosen (JWT or Cognito).
 */
const createAuthorizer = (event: AWSLambda.APIGatewayProxyEventBase<AWSLambda.APIGatewayProxyCognitoAuthorizer>, log: LambdaLog) => {
  // If Cognito is used, USER_POOL_ID is injected into the function's environment. Currently assumes JWT otherwise.
  if (env.USER_POOL_ID) {
    return new ApiGatewayv1CognitoAuthorizer(event, log);
  } else {
    // This might need to get more sophisticated if more authorization methods need to be supported.
    return new ApiGatewayv1JwtAuthorizer(event, 'admin', log);
  }
};

/**
 * A factory function that creates an HTTP request handler.
 */
export const createHttpHandler =
  <T, R>(handler: HttpHandler<T, R>): APIGatewayv1Handler => {
    return async (event, context) => {
      // Create an object to hold the context for this HTTP request
      const auth = createAuthorizer(event, logger as unknown as logger.LambdaLog);
      const ctx: HttpHandlerContext = {
        event,
        auth,
        lambdaContext: context,
        logger: logger as unknown as logger.LambdaLog,
        response: { headers: {}, json: true },
      };
      // Add the request ID to the logging metadata, and enable debug logging if the DEBUG environment variable is set to "true"
      ctx.logger.options.meta.requestId = context.awsRequestId;
      ctx.logger.options.debug = process.env.DEBUG === 'true';

      // Log the event object for debugging purposes
      ctx.logger.debug(JSON.stringify(event));

      try {
        // Authenticate the user using the Cognito authorizer
        await ctx.auth.authenticate();

        // Call the user-defined handler function, passing in the request context object and the parsed request body
        const res = await handler(ctx, parseBody(event));

        // Construct and return the HTTP response
        return {
          statusCode: ctx.response.statusCode ?? (res ? 200 : 204),
          headers: {
            'Content-Type': 'application/json',
            ...corsHeader(event),
            ...ctx.response.headers,
          },
          body: res ? (ctx.response.json ? JSON.stringify(res) : res) : '',
        };
      } catch (error: any) {
        // Handle any errors that occur during request processing

        // If the error is an instance of HttpError, return an HTTP response with the error status code and message
        if (error instanceof errors.HttpError) {
          return {
            statusCode: error.statusCode,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeader(event),
              ...ctx.response.headers,
            },
            body: error.message,
          };
        }
        // If the error is a Boom error (from the hapi.js framework), return an HTTP response with the error status code and payload
        if (error.isBoom) {
          return {
            statusCode: error.output.statusCode,
            headers: {
              'Content-Type': 'application/json',
              ...error.output.headers,
              ...corsHeader(event),
              ...ctx.response.headers,
            },
            body: JSON.stringify(error.output.payload),
          };
        }
        // For all other types of errors, log the error and return a 500 status code with the error message
        ctx.logger.error(error);
        return {
          statusCode: ctx.response.statusCode ?? 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeader(event),
            ...ctx.response.headers,
          },
          body: error.toString(),
        };
      }
    };
  };

/**
 * Looks up a header value case-insensitively.
 * HTTP header names are case-insensitive per RFC 9110 §5.1.
 */
function headerValue(headers: Record<string, string | undefined> | null | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

/**
 * This function takes an event object representing an API Gateway Proxy event
 * with a Cognito authorizer, and extracts and parses the request body, if present.
 *
 * @param event The API Gateway Proxy event with a Cognito authorizer
 * @returns The parsed request body
 */
function parseBody<T>(event: AWSLambda.APIGatewayProxyWithCognitoAuthorizerEvent): T {
  let body = event.body;

  // If the request body is base64-encoded, decode it
  if (event.body && event.isBase64Encoded) {
    const buff = Buffer.from(event.body!, 'base64');
    body = buff.toString('utf8');
  }

  // If the request body is in JSON format, parse it into a JavaScript object
  if (headerValue(event.headers, 'content-type')?.includes('application/json')) {
    return JSON.parse(body ?? '{}');
  }

  // If the request body is not present or not in JSON format, return it as-is
  return body as any;
}


/**
 * Returns the CORS headers to be included in the API Gateway response.
 *
 * @param event - The API Gateway event object.
 * @returns An object containing the CORS headers.
 */
function corsHeader(event: AWSLambda.APIGatewayProxyWithCognitoAuthorizerEvent): { [name: string]: string } {
  const origin = headerValue(event?.headers, 'origin');
  return {
    'Access-Control-Allow-Origin': origin ?? '*', // Allow requests from the origin header, or allow any origin if not present
    'Access-Control-Allow-Credentials': origin ? 'true' : 'false', // Include cookies in cross-origin requests if the origin header is present
    'Access-Control-Allow-Methods': '*', // Allow any HTTP method
    'Access-Control-Allow-Headers': 'Authorization, *', // Allow the Authorization header and any other headers
  };
}

/////////////////////////////////
/// AppSync
/////////////////////////////////

/**
 * The context for the AppSync resolver function.
 * Contains information about the event, lambda context, logger, and Cognito authorizer.
 */
export interface AppSyncHandlerContext<T> {
  event: AWSLambda.AppSyncResolverEvent<T>;
  lambdaContext: AWSLambda.Context;
  logger: logger.LambdaLog;
  cognitoAuth: CognitoAuthorizer;
}

/**
 * A function that handles an AppSync resolver event.
 * Receives the context object and returns the response.
 */
export type AppSyncHandler<T, R> = (
  context: AppSyncHandlerContext<T>,
) => Promise<R>;

/**
 * Maps an HTTP status code to the GraphQL errorType reported to AppSync.
 *
 * Local (non-exported) helper used only by createAppSyncHandler when it
 * translates an errors.HttpError into a typed AppSync error. The explicit
 * default keeps any unmapped status (for example a 418 or a 5xx) reported as
 * the generic 'Error' errorType rather than leaking the raw status code.
 */
function httpStatusToErrorType(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BadRequest';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'NotFound';
    default:
      return 'Error';
  }
}

/**
 * Creates an AppSync resolver handler from the given AppSyncHandler.
 * Returns a function that can be used as an AppSync resolver.
 *
 * @param handler The AppSyncHandler to use as the resolver.
 */
export const createAppSyncHandler =
  <T, R>(handler: AppSyncHandler<T, R>): AWSLambda.AppSyncResolverHandler<T, R> => {
    return async (event, context) => {
      const ctx: AppSyncHandlerContext<T> = {
        event,
        lambdaContext: context,
        logger: logger as unknown as logger.LambdaLog,
        cognitoAuth: new AppSyncCognitoAuthorizer(event),
      };

      // set the meta information in logger
      ctx.logger.options.meta.requestId = context.awsRequestId;
      // set the debug flag for logger
      ctx.logger.options.debug = process.env.DEBUG === 'true';

      // log the received event
      ctx.logger.debug(JSON.stringify(event));

      try {
        // authenticate the incoming request
        await ctx.cognitoAuth.authenticate();
        // invoke the handler function with the context
        return await handler(ctx);
      } catch (error: any) {
        // Normalise the two recognised typed-error shapes to a common
        // { errorType, message, errorInfo } so the gate, envelope and rethrow
        // below are a single code path.
        //
        // - appsyncErrors.AppSyncError carries its own GraphQL errorType and an
        //   optional errorInfo, which flow through unchanged.
        // - errors.HttpError (the HTTP base thrown by the shared JwtAuthorizer
        //   via assertAuthenticated/assertGroup/assertAdmin, and by resolver
        //   code directly) has no GraphQL errorType, so map its statusCode with
        //   httpStatusToErrorType. HttpError carries no errorInfo, so errorInfo
        //   is undefined.
        //
        // The two instanceof checks are disjoint: HttpError and AppSyncError
        // share no ancestry, so an appsync.ForbiddenError takes the AppSyncError
        // branch and an errors.ForbiddenError the HttpError branch. Anything that
        // is neither (plain Error, Boom) leaves typed undefined and rethrows.
        let typed: { errorType: string; message: string; errorInfo?: Record<string, any> } | undefined;
        if (error instanceof appsyncErrors.AppSyncError) {
          typed = { errorType: error.errorType, message: error.message, errorInfo: error.errorInfo };
        } else if (error instanceof errors.HttpError) {
          typed = { errorType: httpStatusToErrorType(error.statusCode), message: error.message, errorInfo: undefined };
        }

        if (typed && process.env.APPSYNC_TYPED_ERRORS === 'true') {
          // The envelope-return is gated on APPSYNC_TYPED_ERRORS === 'true'.
          // GraphQlApi.addLambdaResolver injects that env var only on its
          // typedErrors: true path, whose APPSYNC_JS resolver has a response
          // handler that reads this envelope and calls
          // util.error(errorMessage, errorType, null, errorInfo), turning it into
          // a GraphQL error on a successful invocation. Returning (not throwing)
          // keeps the invocation off the Lambda Errors metric.
          //
          // When the env var is absent (the default UNIT resolver path, or a
          // hand-wired handler used without GraphQlApi) the typed error falls
          // through to the rethrow below, so the invocation fails loudly instead
          // of surfacing the envelope as field data. Any value other than the
          // exact string 'true' means rethrow. This is why a default UNIT
          // resolver whose handler hits an auth assertion (an HttpError) still
          // fails loudly unless typedErrors is active.
          //
          // __appSyncError is a reserved sentinel key the resolver response
          // handler keys on to recognise this envelope. Branching on the sentinel
          // (rather than on a bare errorMessage) means a legitimate resolver result
          // that merely contains an errorMessage field is not misclassified as a
          // typed error.
          ctx.logger.warn(typed.message, { errorType: typed.errorType, errorInfo: typed.errorInfo });
          return {
            __appSyncError: true,
            data: null,
            errorType: typed.errorType,
            errorMessage: typed.message,
            errorInfo: typed.errorInfo,
          } as unknown as R;
        }
        // log the error and throw it again
        ctx.logger.error(error);
        throw error;
      }
    };
  };

