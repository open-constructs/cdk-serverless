
## Projen

This project provides aspects that enable easier usage of serverless technologies in your CDK app.

### HttpApiAspect

This aspect is meant to be used for HTTP Apis using the AWS API Gateway. It provides the following features:

* Configure best-practice features flags for CDK
* Install all needed CDK packages for serverless development
* Install type definitions for lambda
* Add the Taimos [Lambda Toolbox library](https://github.com/taimos/lambda-toolbox)
* Add support for Lambda live updates
* Add diff and deploy scripts for stacks in your CDK app
* Add a script to generate type definitions from your `openapi.yaml`

The usage look like the following snippet:

```ts
// Import cdk-serverless projen aspects
const { HttpApiAspect } = require('cdk-serverless/lib/projen');
const { AwsCdkTypeScriptApp } = require('projen');

const project = new AwsCdkTypeScriptApp({...});

// Add HTTP API Support
new HttpApiAspect(project, {
  cdkWatch: {
    // Add live update scripts using CDK Watch
    dev: 'my-http-stack-dev/**',
  },
  deployScripts: {
    // Add diff:dev and deploy:dev for all stacks starting with 'dev-'
    dev: 'dev-*',
  }
});

project.synth();
```

### GraphQlApiAspect

This aspect is meant to be used for GraphQL Apis using AWS AppSync. It provides the following features:

* Configure best-practice features flags for CDK
* Install all needed CDK packages for serverless development
* Install type definitions for lambda and graphql
* Add the Taimos [Lambda Toolbox library](https://github.com/taimos/lambda-toolbox)
* Add support for Lambda live updates
* Add diff and deploy scripts for stacks in your CDK app
* Add a script to generate type definitions from your `schema.graphql`
* Create and manage the code generator config for graphql

The usage look like the following snippet:

```ts
// Import cdk-serverless projen aspects
const { GraphQlApiAspect } = require('cdk-serverless/lib/projen');
const { AwsCdkTypeScriptApp } = require('projen');

const project = new AwsCdkTypeScriptApp({...});

// Add GraphQL / AppSync Support
new GraphQlApiAspect(project, {
  cdkWatch: {
    // Add live update scripts using CDK Watch
    dev: 'my-http-stack-dev/**',
  },
  deployScripts: {
    // Add diff:dev and deploy:dev for all stacks starting with 'dev-'
    dev: 'dev-*',
  }
});

project.synth();
```
