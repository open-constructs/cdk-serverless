import * as errors from '../../src/lambda/errors';
import { createAppSyncHandler } from '../../src/lambda/handler';

// Build a minimal AppSyncResolverEvent. AppSyncCognitoAuthorizer.authenticate()
// only reads event.identity (optional), so an undefined identity is enough to
// let authentication pass before the resolver runs.
function buildEvent<T>(args: T): AWSLambda.AppSyncResolverEvent<T> {
  return {
    arguments: args,
    source: null,
    request: {
      headers: {},
      domainName: null,
    },
    info: {
      fieldName: 'testField',
      parentTypeName: 'Query',
      variables: {},
      selectionSetList: [],
      selectionSetGraphQL: '',
    },
    prev: null,
    stash: {},
  } as unknown as AWSLambda.AppSyncResolverEvent<T>;
}

// Minimal Lambda context; the handler reads awsRequestId for logging metadata.
const context: AWSLambda.Context = {
  awsRequestId: 'test-request-id',
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-fn',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:eu-central-1:123456789012:function:test-fn',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/test-fn',
  logStreamName: 'test-stream',
  getRemainingTimeInMillis: () => 1000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// The AppSyncResolverHandler signature passes a node-style callback as the
// third argument; the implementation uses the returned promise, so undefined is fine.
const noopCallback = undefined as unknown as AWSLambda.Callback<any>;

describe('createAppSyncHandler typed-error behavior', () => {
  test('happy path: resolver return value is passed through unchanged', async () => {
    const handler = createAppSyncHandler<{ id: string }, { id: string; name: string }>(
      async (ctx) => ({ id: ctx.event.arguments.id, name: 'Widget' }),
    );

    const result: any = await handler(buildEvent({ id: '42' }), context, noopCallback);

    expect(result).toEqual({ id: '42', name: 'Widget' });
    // A legitimate result does not carry the sentinel, so the resolver response
    // handler returns it unchanged rather than converting it into a GraphQL error.
    expect(result.__appSyncError).toBeUndefined();
  });

  test('a legitimate result containing an errorMessage field is not stamped with the sentinel', async () => {
    const handler = createAppSyncHandler<Record<string, never>, { errorMessage: string }>(
      async () => ({ errorMessage: 'this is a real field value, not a typed error' }),
    );

    const result: any = await handler(buildEvent({}), context, noopCallback);

    // The sentinel is what the resolver response handler keys on, so a result
    // that merely has an errorMessage field is passed through unchanged.
    expect(result).toEqual({ errorMessage: 'this is a real field value, not a typed error' });
    expect(result.__appSyncError).toBeUndefined();
  });

  test('NotFoundError resolves to an error envelope instead of rejecting', async () => {
    const handler = createAppSyncHandler<{ id: string }, { id: string }>(
      async () => {
        throw new errors.appsync.NotFoundError('Item not found');
      },
    );

    // Must resolve, not reject. This would fail if the FEAT-002 catch block
    // reverted to rethrowing AppSync errors.
    const result: any = await handler(buildEvent({ id: 'missing' }), context, noopCallback);

    expect(result).toEqual({
      __appSyncError: true,
      data: null,
      errorType: 'NotFound',
      errorMessage: 'Item not found',
      errorInfo: undefined,
    });
  });

  test('ValidationError propagates errorInfo and errorType in the envelope', async () => {
    const errorInfo = { field: 'email', reason: 'invalid format' };
    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        throw new errors.appsync.ValidationError('Validation failed', errorInfo);
      },
    );

    const result: any = await handler(buildEvent({}), context, noopCallback);

    expect(result.__appSyncError).toBe(true);
    expect(result.data).toBeNull();
    expect(result.errorType).toBe('ValidationError');
    expect(result.errorMessage).toBe('Validation failed');
    expect(result.errorInfo).toEqual(errorInfo);
  });

  test('plain Error rejects (untyped errors still fail the invocation)', async () => {
    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        throw new Error('boom');
      },
    );

    await expect(handler(buildEvent({}), context, noopCallback)).rejects.toThrow('boom');
  });
});
