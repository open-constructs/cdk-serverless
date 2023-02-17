import logger from 'lambda-log';
import { ApiGatewayv1CognitoAuthorizer, AppSyncCognitoAuthorizer, CognitoAuthorizer } from './auth';
import * as errors from './errors';


/////////////////////////////////
/// HTTP Api
/////////////////////////////////

export interface HttpResponseContext {
  statusCode?: number;
  headers: { [name: string]: string };
  json: boolean;
}

export interface HttpHandlerContext {
  event: AWSLambda.APIGatewayProxyWithCognitoAuthorizerEvent;
  lambdaContext: AWSLambda.Context;
  logger: logger.LambdaLog;
  response: HttpResponseContext;
  cognitoAuth: CognitoAuthorizer;
}

export type HttpHandler<T, R> = (
  context: HttpHandlerContext,
  body: T,
) => Promise<R>;

export interface Operation {
  responses: {
    [statusCode: number]: {
      content: {
        'application/json': any;
      };
    } | any;
  };
}

export type APIGatewayv1Handler =
  AWSLambda.Handler<AWSLambda.APIGatewayProxyWithCognitoAuthorizerEvent, AWSLambda.APIGatewayProxyResult | undefined>;

export interface OperationWithRequestBody extends Operation {
  requestBody: { content: { 'application/json': any } };
}

export const createOpenApiHandlerWithRequestBody = <OP extends OperationWithRequestBody, SC extends number = 200>(handler: HttpHandler<OP['requestBody']['content']['application/json'], OP['responses'][SC]['content']['application/json']>): APIGatewayv1Handler => {
  return createHttpHandler(handler);
};

export const createOpenApiHandlerWithRequestBodyNoResponse = <OP extends OperationWithRequestBody>(handler: HttpHandler<OP['requestBody']['content']['application/json'], void>): APIGatewayv1Handler => {
  return createHttpHandler(handler);
};

export const createOpenApiHandler = <OP extends Operation, SC extends number = 200>(handler: HttpHandler<any, OP['responses'][SC]['content']['application/json']>): APIGatewayv1Handler => {
  return createHttpHandler(handler);
};

export const createHttpHandler =
  <T, R>(handler: HttpHandler<T, R>): APIGatewayv1Handler => {
    return async (event, context) => {
      const ctx: HttpHandlerContext = {
        event,
        lambdaContext: context,
        logger: logger as unknown as logger.LambdaLog,
        response: { headers: {}, json: true },
        cognitoAuth: new ApiGatewayv1CognitoAuthorizer(event, logger as unknown as logger.LambdaLog),
      };
      ctx.logger.options.meta.requestId = context.awsRequestId;
      ctx.logger.options.debug = process.env.DEBUG === 'true';

      ctx.logger.debug(JSON.stringify(event));

      try {
        await ctx.cognitoAuth.authenticate();

        const res = await handler(ctx, parseBody(event));
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

function parseBody<T>(event: AWSLambda.APIGatewayProxyWithCognitoAuthorizerEvent): T {
  let body = event.body;
  if (event.body && event.isBase64Encoded) {
    const buff = Buffer.from(event.body!, 'base64');
    body = buff.toString('utf8');
  }
  if (event.headers && event.headers['content-type']?.includes('application/json')) {
    return JSON.parse(body ?? '{}');
  }
  return body as any;
}

function corsHeader(event: AWSLambda.APIGatewayProxyWithCognitoAuthorizerEvent): { [name: string]: string } {
  return {
    'Access-Control-Allow-Origin': event?.headers?.origin ?? '*',
    'Access-Control-Allow-Credentials': event?.headers?.origin ? 'true' : 'false',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': 'Authorization, *',
  };
}

/////////////////////////////////
/// AppSync
/////////////////////////////////

export interface AppSyncHandlerContext<T> {
  event: AWSLambda.AppSyncResolverEvent<T>;
  lambdaContext: AWSLambda.Context;
  logger: logger.LambdaLog;
  cognitoAuth: CognitoAuthorizer;
}

export type AppSyncHandler<T, R> = (
  context: AppSyncHandlerContext<T>,
) => Promise<R>;

export const createAppSyncHandler =
  <T, R>(handler: AppSyncHandler<T, R>): AWSLambda.AppSyncResolverHandler<T, R> => {
    return async (event, context) => {
      const ctx: AppSyncHandlerContext<T> = {
        event,
        lambdaContext: context,
        logger: logger as unknown as logger.LambdaLog,
        cognitoAuth: new AppSyncCognitoAuthorizer(event),
      };
      ctx.logger.options.meta.requestId = context.awsRequestId;
      ctx.logger.options.debug = process.env.DEBUG === 'true';

      ctx.logger.debug(JSON.stringify(event));

      try {
        await ctx.cognitoAuth.authenticate();
        return await handler(ctx);
      } catch (error: any) {
        ctx.logger.error(error);
        throw error;
      }
    };
  };

