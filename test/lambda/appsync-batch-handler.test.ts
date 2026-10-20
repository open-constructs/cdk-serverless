import * as errors from '../../src/lambda/errors';
import { createAppSyncBatchHandler } from '../../src/lambda/handler';

// Build a minimal AppSyncResolverEvent. AppSyncCognitoAuthorizer.authenticate()
// only reads event.identity (optional), so an undefined identity is enough to
// let authentication pass before the resolver runs. Mirrors the buildEvent helper
// in appsync-handler.test.ts.
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

// Build an ordered batch of events, one per argument object.
function buildBatch<T>(argsList: T[]): AWSLambda.AppSyncResolverEvent<T>[] {
  return argsList.map((args) => buildEvent(args));
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

// The AppSyncBatchResolverHandler signature passes a node-style callback as the
// third argument; the implementation uses the returned promise, so undefined is fine.
const noopCallback = undefined as unknown as AWSLambda.Callback<any>;

describe('createAppSyncBatchHandler', () => {
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

  test('happy path: the handler receives the batch and returns R[] in source order', async () => {
    const handler = createAppSyncBatchHandler<{ id: string }, { id: string; name: string }>(
      async (ctx) => ctx.events.map((e) => ({ id: e.arguments.id, name: `Widget-${e.arguments.id}` })),
    );

    const events = buildBatch([{ id: '1' }, { id: '2' }, { id: '3' }]);
    const result: any = await handler(events, context, noopCallback);

    // One result per event, in the same order as the input batch.
    expect(result).toHaveLength(events.length);
    expect(result).toEqual([
      { id: '1', name: 'Widget-1' },
      { id: '2', name: 'Widget-2' },
      { id: '3', name: 'Widget-3' },
    ]);
  });

  test('context is built off the first event: ctx.event === events[0], ctx.events is the full batch, logger and cognitoAuth are present', async () => {
    const events = buildBatch([{ id: 'first' }, { id: 'second' }]);

    let captured: any;
    const handler = createAppSyncBatchHandler<{ id: string }, { ok: boolean }>(
      async (ctx) => {
        captured = ctx;
        return ctx.events.map(() => ({ ok: true }));
      },
    );

    await handler(events, context, noopCallback);

    // Authentication runs once off the first event, and the context exposes both
    // the first event and the full batch.
    expect(captured.event).toBe(events[0]);
    expect(captured.events).toBe(events);
    expect(captured.events).toHaveLength(2);
    expect(captured.logger).toBeDefined();
    expect(captured.cognitoAuth).toBeDefined();
  });

  test('APPSYNC_TYPED_ERRORS=true: a thrown appsync error yields one error envelope per event, aligned to the batch', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const events = buildBatch([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const handler = createAppSyncBatchHandler<{ id: string }, { id: string }>(
      async () => {
        throw new errors.appsync.NotFoundError('Item not found');
      },
    );

    const result: any = await handler(events, context, noopCallback);

    // AppSync expects one result per event in a BatchInvoke response, so the
    // batch-level typed error is fanned out to an envelope per event.
    expect(result).toHaveLength(events.length);
    for (const item of result) {
      expect(item).toEqual({
        __appSyncError: true,
        data: null,
        errorType: 'NotFound',
        errorMessage: 'Item not found',
        errorInfo: undefined,
      });
    }
  });

  test('APPSYNC_TYPED_ERRORS=true: ValidationError propagates errorInfo and errorType in each envelope', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const errorInfo = { field: 'email', reason: 'invalid format' };
    const events = buildBatch([{ id: 'x' }, { id: 'y' }]);
    const handler = createAppSyncBatchHandler<{ id: string }, unknown>(
      async () => {
        throw new errors.appsync.ValidationError('Validation failed', errorInfo);
      },
    );

    const result: any = await handler(events, context, noopCallback);

    expect(result).toHaveLength(events.length);
    for (const item of result) {
      expect(item).toEqual({
        __appSyncError: true,
        data: null,
        errorType: 'ValidationError',
        errorMessage: 'Validation failed',
        errorInfo,
      });
    }
  });

  test('APPSYNC_TYPED_ERRORS unset: a thrown appsync error rethrows instead of returning envelopes', async () => {
    const events = buildBatch([{ id: 'a' }, { id: 'b' }]);
    const handler = createAppSyncBatchHandler<{ id: string }, { id: string }>(
      async () => {
        throw new errors.appsync.NotFoundError('Item not found');
      },
    );

    await expect(handler(events, context, noopCallback)).rejects.toThrow('Item not found');
  });

  test('APPSYNC_TYPED_ERRORS unset: a plain Error rejects', async () => {
    const events = buildBatch([{ id: 'a' }]);
    const handler = createAppSyncBatchHandler<{ id: string }, unknown>(
      async () => {
        throw new Error('boom');
      },
    );

    await expect(handler(events, context, noopCallback)).rejects.toThrow('boom');
  });

  test('APPSYNC_TYPED_ERRORS=true: a plain Error still rejects (the flag only affects typed errors)', async () => {
    process.env.APPSYNC_TYPED_ERRORS = 'true';

    const events = buildBatch([{ id: 'a' }, { id: 'b' }]);
    const handler = createAppSyncBatchHandler<{ id: string }, unknown>(
      async () => {
        throw new Error('boom');
      },
    );

    await expect(handler(events, context, noopCallback)).rejects.toThrow('boom');
  });
});
