# Experiment: does a UNIT direct-Lambda resolver surface typed errors on a single Invoke?

## Hand this to an agent that has a real AWS account

This is a self-contained experiment spec. Run it in a session with AWS credentials
and permission to deploy and delete a small CloudFormation stack. It does not depend on
the `cdk-serverless` library, on this repo, or on any prior session. Everything needed is
below.

## Why this experiment exists

`cdk-serverless` issue #385 adds typed AppSync errors to `createAppSyncHandler`. An
*expected* resolver failure (forbidden, not-found, validation, conflict) should come back to
the client as a GraphQL error while the Lambda invocation itself **succeeds**, so the failure
stays off the Lambda `Errors` metric and out of error-level logs.

The implementation on branch `feat/appsync-typed-errors` (PR #386) does this with an
**APPSYNC_JS pipeline resolver** whose `response` handler calls
`util.error(message, errorType, null, errorInfo)`. That works, but it changes every Lambda
resolver from a UNIT direct-Lambda resolver to a PIPELINE resolver, which is a topology change
consumers must `cdk diff` before deploying.

AWS documents a simpler path for the **batched** Lambda invoke: the function returns
`{ data, errorMessage, errorType }` and AppSync maps a non-null `errorType` to a GraphQL error
with no resolver code. The open question is whether the **same envelope works for a single
(non-batch) `Invoke` through a plain UNIT direct-Lambda resolver**. If it does, the library
can drop the pipeline resolver and keep resolvers as UNIT, removing the topology change.

The docs are ambiguous on the single-invoke case. This experiment settles it empirically.

## The exact question to answer

> With a **UNIT** AppSync resolver bound directly to a Lambda data source (no VTL, no
> APPSYNC_JS code, no pipeline), if the Lambda returns `{ errorType, errorMessage }` on a
> single `Invoke`, does AppSync:
> 1. return a GraphQL `errors[]` entry carrying that `errorType` and `errorMessage`, AND
> 2. leave the Lambda invocation counted as a success (no increment on the Lambda `Errors`
>    CloudWatch metric)?

A clean **YES** to both means the library can switch to option 3 (UNIT resolver, no pipeline).
A **NO** to either means the current pipeline approach stays.

## Constraints and conventions

- Region: `eu-central-1` unless you are told otherwise.
- Deploy into a throwaway/test account. Use an admin-capable role.
- Name the stack `appsync-unit-error-probe` so cleanup is unambiguous.
- Tear the stack down at the end. Report the stack name and region so a human can verify
  deletion.
- Do not reuse any existing API or Lambda. This must be an isolated probe.

## Step 1 — the Lambda handler

A Node.js 20 Lambda. On input `{ arguments: { mode } }` (AppSync passes the whole context as
the payload for a direct-Lambda resolver), it returns:

- `mode === "ok"`    -> a normal object: `{ id: "1", title: "hello" }`
- `mode === "fail"`  -> the native error envelope: `{ errorType: "Forbidden", errorMessage: "not allowed" }`
- anything else      -> throws a plain `Error` (control case: this SHOULD fail the invocation)

```js
// index.mjs
export const handler = async (event) => {
  const mode = event?.arguments?.mode ?? event?.payload?.arguments?.mode;
  if (mode === 'ok') {
    return { id: '1', title: 'hello' };
  }
  if (mode === 'fail') {
    // Native direct-Lambda error envelope. The probe measures whether AppSync
    // turns this into a GraphQL error on a SINGLE invoke without any resolver code.
    return { errorType: 'Forbidden', errorMessage: 'not allowed' };
  }
  // Control: an uncaught throw must fail the invocation and hit the Errors metric.
  throw new Error('unexpected');
};
```

## Step 2 — the CDK stack

TypeScript CDK (`aws-cdk-lib` v2). The resolver MUST be a UNIT direct-Lambda resolver with no
request/response mapping templates and no code. In L2 terms, use a `LambdaDataSource` and call
`createResolver` with only `typeName` and `fieldName` set, no `requestMappingTemplate`,
no `responseMappingTemplate`, no `runtime`, no `code`, no `pipelineConfig`. That produces
`Kind: UNIT` with the templates disabled, which is the direct-Lambda path.

Schema (two queries so you can hit success and expected-failure paths):

```graphql
type Item { id: ID!, title: String! }
type Query {
  getItem(mode: String!): Item
}
```

Stack requirements:
- An `appsync.GraphqlApi` named `appsync-unit-error-probe` with `API_KEY` auth (simplest for
  the probe; the auth mode is irrelevant to the question).
- The Lambda from Step 1 as a `LambdaDataSource`.
- A **UNIT** resolver on `Query.getItem` bound to that data source, templates disabled.
- Stack outputs: the GraphQL URL, the API key, and the Lambda function name.

After deploy, confirm in the synthesized template or via `aws appsync get-resolver` that the
resolver is `kind=UNIT` and has no `pipelineConfig`. If CDK synthesized anything other than a
plain UNIT direct-Lambda resolver, the probe is invalid — fix the stack before measuring.

## Step 3 — baseline the metric

Record the Lambda `Errors` metric before the test so you can detect any increment caused by
the expected-failure call. Note the function name from the stack output.

```bash
# Sum of Errors over a wide window, before firing any queries.
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=<FUNCTION_NAME> \
  --start-time "$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time   "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 900 --statistics Sum --region eu-central-1
```

## Step 4 — fire the three queries

Use the API URL and key from the outputs. `curl` is fine.

**A. Success path** — expect `data.getItem` populated, no `errors`.

```bash
curl -s "$URL" -H "x-api-key: $KEY" -H 'Content-Type: application/json' \
  -d '{"query":"query{ getItem(mode:\"ok\"){ id title } }"}'
```

**B. Expected-failure path (the actual probe)** — the Lambda returns the error envelope.

```bash
curl -s "$URL" -H "x-api-key: $KEY" -H 'Content-Type: application/json' \
  -d '{"query":"query{ getItem(mode:\"fail\"){ id title } }"}'
```

**C. Control — uncaught throw** — expect a GraphQL error AND a Lambda `Errors` increment.

```bash
curl -s "$URL" -H "x-api-key: $KEY" -H 'Content-Type: application/json' \
  -d '{"query":"query{ getItem(mode:\"boom\"){ id title } }"}'
```

Fire query B at least 3 times so any metric increment is unambiguous.

## Step 5 — re-read the metric

Wait about 2 minutes for CloudWatch to populate, then run the same
`get-metric-statistics` call from Step 3 again. Compare the `Sum` before and after.

Attribution: query C (the control) is expected to increment `Errors`. To isolate query B's
effect, either run B and C in separate time windows and read the metric between them, or run
only B several times first, read the metric, then run C. The question is specifically whether
**B** moves the metric.

## Step 6 — record the result

Fill in this table and return it verbatim:

| Query | GraphQL `data.getItem` | GraphQL `errors[].errorType` | GraphQL `errors[].message` | Lambda `Errors` incremented by this call |
| --- | --- | --- | --- | --- |
| A (`ok`)   | | | | |
| B (`fail`) | | | | |
| C (`boom`) | | | | |

Also capture the raw JSON body of query B's response, and the before/after `Sum` values of
the `Errors` metric.

## Decision rule

- **YES to both** (B returns `errors[].errorType == "Forbidden"` with the message, and B does
  NOT increment `Errors`, while C DOES increment it): a UNIT direct-Lambda resolver is
  sufficient. Recommend switching `cdk-serverless` `addLambdaResolver` to a UNIT resolver and
  dropping the APPSYNC_JS pipeline, which removes the deploy topology change.
- **NO to either** (B returns the envelope as field `data` instead of a GraphQL error, OR B
  increments `Errors`): the single-invoke UNIT path does not do the translation. Keep the
  current APPSYNC_JS pipeline response-handler approach on branch `feat/appsync-typed-errors`.

Report which branch of the rule fired and why, quoting query B's JSON as evidence.

## Cleanup

```bash
# via the CDK app used to deploy
cdk destroy appsync-unit-error-probe --force
# or
aws cloudformation delete-stack --stack-name appsync-unit-error-probe --region eu-central-1
```

Confirm the stack is `DELETE_COMPLETE` (or gone) and report the stack name and region.

## What to hand back

1. The filled-in result table from Step 6.
2. Query B's raw JSON response body.
3. Before/after `Errors` metric `Sum`.
4. Which decision-rule branch fired, and the one-line recommendation (UNIT vs keep pipeline).
5. Confirmation the probe stack was deleted (name + region).
