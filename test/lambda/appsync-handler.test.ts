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
  // The envelope-return is gated on process.env.APPSYNC_TYPED_ERRORS === 'true'.
  // Save and restore the exact original value (which may be undefined) so cases
  // do not leak into one another.
  let originalFlag: string | undefined;

  beforeEach(() => {
    originalFlag = process.env.APPSYNC_TYPED_ERRORS;
    delete process.env.APPSYNC_TYPED_ERRORS;
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.APPSYNC_TYPED_ERRORS;
    } else {
      process.env.APPSYNC_TYPED_ERRORS = originalFlag;
    }
  });

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

  // (a) flag on + AppSyncError -> resolves to the sentinel envelope.
  test('APPSYNC_TYPED_ERRORS=true: NotFoundError resolves to an error envelope instead of rejecting', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const handler = createAppSyncHandler<{ id: string }, { id: string }>(
      async () => {
        throw new errors.appsync.NotFoundError('Item not found');
      },
    );

    const result: any = await handler(buildEvent({ id: 'missing' }), context, noopCallback);

    expect(result).toEqual({
      __appSyncError: true,
      data: null,
      errorType: 'NotFound',
      errorMessage: 'Item not found',
      errorInfo: undefined,
    });
  });

  // (a) flag on + AppSyncError -> envelope carries errorInfo and errorType.
  test('APPSYNC_TYPED_ERRORS=true: ValidationError propagates errorInfo and errorType in the envelope', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

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

  // (b) flag absent + AppSyncError -> rethrows (default UNIT path, loud failure).
  test('APPSYNC_TYPED_ERRORS unset: AppSyncError rethrows instead of returning an envelope', async () => {
    const handler = createAppSyncHandler<{ id: string }, { id: string }>(
      async () => {
        throw new errors.appsync.NotFoundError('Item not found');
      },
    );

    await expect(handler(buildEvent({ id: 'missing' }), context, noopCallback)).rejects.toThrow('Item not found');
  });

  // (c) flag absent + untyped Error -> rejects as before.
  test('APPSYNC_TYPED_ERRORS unset: plain Error rejects (untyped errors still fail the invocation)', async () => {
    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        throw new Error('boom');
      },
    );

    await expect(handler(buildEvent({}), context, noopCallback)).rejects.toThrow('boom');
  });

  // (d) flag on + untyped Error -> still rejects (the flag only affects AppSyncError).
  test('APPSYNC_TYPED_ERRORS=true: plain Error still rejects', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        throw new Error('boom');
      },
    );

    await expect(handler(buildEvent({}), context, noopCallback)).rejects.toThrow('boom');
  });

  // The shared JwtAuthorizer base throws errors.UnauthenticatedError/ForbiddenError
  // from assertAuthenticated/assertGroup/assertAdmin. Mirror that real failure site
  // with an object method that throws, rather than a bare throw in the handler body.
  const authLike = {
    // mirrors auth.assertAuthenticated()
    assertAuthenticated() {
      throw new errors.UnauthenticatedError('Not authenticated');
    },
    // mirrors auth.assertGroup()/assertAdmin()
    assertGroup() {
      throw new errors.ForbiddenError('Not a member of required group');
    },
  };

  // flag on + HttpError (401 from the auth path) -> envelope with errorType 'Unauthorized'.
  test('APPSYNC_TYPED_ERRORS=true: UnauthenticatedError from the auth path resolves to an Unauthorized envelope', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        authLike.assertAuthenticated();
        return {};
      },
    );

    const result: any = await handler(buildEvent({}), context, noopCallback);

    expect(result).toEqual({
      __appSyncError: true,
      data: null,
      errorType: 'Unauthorized',
      errorMessage: 'Not authenticated',
      errorInfo: undefined,
    });
  });

  // flag on + HttpError (403 from the auth path) -> envelope with errorType 'Forbidden'.
  test('APPSYNC_TYPED_ERRORS=true: ForbiddenError from the auth path resolves to a Forbidden envelope', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        authLike.assertGroup();
        return {};
      },
    );

    const result: any = await handler(buildEvent({}), context, noopCallback);

    expect(result).toEqual({
      __appSyncError: true,
      data: null,
      errorType: 'Forbidden',
      errorMessage: 'Not a member of required group',
      errorInfo: undefined,
    });
  });

  // flag on + HttpError 404 -> envelope with errorType 'NotFound'.
  test('APPSYNC_TYPED_ERRORS=true: HTTP NotFoundError resolves to a NotFound envelope', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        throw new errors.NotFoundError('Item not found');
      },
    );

    const result: any = await handler(buildEvent({}), context, noopCallback);

    expect(result).toEqual({
      __appSyncError: true,
      data: null,
      errorType: 'NotFound',
      errorMessage: 'Item not found',
      errorInfo: undefined,
    });
  });

  // flag on + HttpError 400 -> envelope with errorType 'BadRequest'.
  test('APPSYNC_TYPED_ERRORS=true: HTTP BadRequestError resolves to a BadRequest envelope', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        throw new errors.BadRequestError('Missing parameter');
      },
    );

    const result: any = await handler(buildEvent({}), context, noopCallback);

    expect(result).toEqual({
      __appSyncError: true,
      data: null,
      errorType: 'BadRequest',
      errorMessage: 'Missing parameter',
      errorInfo: undefined,
    });
  });

  // flag on + unmapped HTTP status -> envelope with the default errorType 'Error'.
  test('APPSYNC_TYPED_ERRORS=true: an unmapped HTTP status (418) maps to the default Error errorType', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        throw new errors.HttpError(418, 'teapot');
      },
    );

    const result: any = await handler(buildEvent({}), context, noopCallback);

    expect(result).toEqual({
      __appSyncError: true,
      data: null,
      errorType: 'Error',
      errorMessage: 'teapot',
      errorInfo: undefined,
    });
  });

  // flag absent + HttpError -> rethrows (default UNIT path, loud failure).
  test('APPSYNC_TYPED_ERRORS unset: HttpError rethrows instead of returning an envelope', async () => {
    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        authLike.assertAuthenticated();
        return {};
      },
    );

    await expect(handler(buildEvent({}), context, noopCallback)).rejects.toThrow('Not authenticated');
  });

  // regression: the AppSyncError branch is unchanged. errors.appsync.ForbiddenError
  // (disjoint from errors.HttpError) still maps to errorType 'Forbidden'.
  test('APPSYNC_TYPED_ERRORS=true: appsync.ForbiddenError still resolves via the AppSyncError branch', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const handler = createAppSyncHandler<Record<string, never>, unknown>(
      async () => {
        throw new errors.appsync.ForbiddenError('Access denied');
      },
    );

    const result: any = await handler(buildEvent({}), context, noopCallback);

    expect(result).toEqual({
      __appSyncError: true,
      data: null,
      errorType: 'Forbidden',
      errorMessage: 'Access denied',
      errorInfo: undefined,
    });
  });
});
