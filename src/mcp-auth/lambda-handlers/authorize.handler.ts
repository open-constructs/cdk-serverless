import { getConfigFromEnv } from './env-config';
import { createAuthorizeHandler } from '../handlers/authorize';

const handler = createAuthorizeHandler(getConfigFromEnv());

export async function lambdaHandler(event: AWSLambda.APIGatewayProxyEvent): Promise<AWSLambda.APIGatewayProxyResult> {
  const result = await handler({
    httpMethod: event.httpMethod,
    path: event.path,
    headers: event.headers as Record<string, string | undefined>,
    queryStringParameters: event.queryStringParameters as Record<string, string | undefined> | null,
    body: event.body,
    isBase64Encoded: event.isBase64Encoded,
  });

  return {
    statusCode: result.statusCode,
    headers: result.headers,
    body: result.body ?? '',
  };
}

export { lambdaHandler as handler };
