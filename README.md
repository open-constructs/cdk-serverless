# CDK Serverless

[![npm version](https://badge.fury.io/js/cdk-serverless.svg)](https://badge.fury.io/js/cdk-serverless)

CDK Serverless is a tool suite to facilitate the use of the AWS Cloud Development Kit (CDK) in serverless architectures. It provides project management features to configure your TypeScript CDK app and also higher-level (L3) constructs for different APIs and resources needed for serverless applications. Additionally, it leverages utility libraries to write Lambda functions and do live updates to Lambda function code during development.

### Features

- Projen helper classes to configure certain use cases easily
- AWS CDK L3-construct for RestApi and GraphQlApi
- Zero-config for Lambda functions and VTL templates
- Live update to Lambda function code using cdk-watch
- Automatic DynamoDB SingleTable infrastructure
- Automatic monitoring added for Lambda functions and APIs
- Full features of CDK usable to implement your special use cases
- Fully typed auto-completion for routes, resolvers, etc.

Video about the idea behind it: https://www.youtube.com/watch?v=k5L8U39_16k

## Quick Start

To start a new project we recommend using projen. To use CDK Serverless you can create any projen CDK Typescript app and then add the appropriate aspect provided by this toolkit.

```bash
$ npx projen new awscdk-app-ts
```

Adding CDK Serverless is a two step process:

1. Add 'cdk-serverless' as a dependency to your project
2. Run `npx projen` to install it

## Contribute

### How to contribute to CDK Serverless

#### **Did you find a bug?**

* **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/taimos/cdk-serverless/issues).

* If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/taimos/cdk-serverless/issues/new). Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

#### **Did you write a patch that fixes a bug?**

* Open a new GitHub pull request with the patch.

* Ensure the PR description clearly describes the problem and solution. Include the relevant issue number if applicable.

#### **Did you fix whitespace, format code, or make a purely cosmetic patch?**

Changes that are cosmetic in nature and do not add anything substantial to the stability, functionality, or testability will normally not be accepted.

#### **Do you intend to add a new feature or change an existing one?**

* Suggest your change under [Issues](https://github.com/taimos/cdk-serverless/issues).

* Do not open a pull request on GitHub until you have collected positive feedback about the change.

#### **Do you want to contribute to the CDK Serverless documentation?**

* Just file a PR with your recommended changes

## Authors

Brought to you by [Taimos](https://taimos.de)