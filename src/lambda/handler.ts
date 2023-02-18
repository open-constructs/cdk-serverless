import logger from 'lambda-log';
import { ApiGatewayv1CognitoAuthorizer, AppSyncCognitoAuthorizer, CognitoAuthorizer } from './auth';
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
  cognitoAuth: CognitoAuthorizer;
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
 * A factory function that creates an HTTP request handler.
 */
export const createHttpHandler =
  <T, R>(handler: HttpHandler<T, R>): APIGatewayv1Handler => {
    return async (event, context) => {
      // Create an object to hold the context for this HTTP request
      const ctx: HttpHandlerContext = {
        event,
        lambdaContext: context,
        logger: logger as unknown as logger.LambdaLog,
        response: { headers: {}, json: true },
        cognitoAuth: new ApiGatewayv1CognitoAuthorizer(event, logger as unknown as logger.LambdaLog),
      };
      // Add the request ID to the logging metadata, and enable debug logging if the DEBUG environment variable is set to "true"
      ctx.logger.options.meta.requestId = context.awsRequestId;
      ctx.logger.options.debug = process.env.DEBUG === 'true';

      // Log the event object for debugging purposes
      ctx.logger.debug(JSON.stringify(event));

      try {
        // Authenticate the user using the Cognito authorizer
        await ctx.cognitoAuth.authenticate();

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
  if (event.headers && event.headers['content-type']?.includes('application/json')) {
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
  return {
    'Access-Control-Allow-Origin': event?.headers?.origin ?? '*', // Allow requests from the origin header, or allow any origin if not present
    'Access-Control-Allow-Credentials': event?.headers?.origin ? 'true' : 'false', // Include cookies in cross-origin requests if the origin header is present
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
        // log the error and throw it again
        ctx.logger.error(error);
        throw error;
      }
    };
  };

