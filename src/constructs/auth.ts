import * as cognito from '@aws-cdk/aws-cognito';
import * as cdk from '@aws-cdk/core';
import { WatchableNodejsFunction } from 'cdk-watch';

export interface AuthenticationProps {
  triggers?: {
    /**
     * Attaches a lambda function to the custom message trigger
     * 
     * Code has to reside in './src/lambda/cognito.custom-message.ts' with a method 'handler'
     * 
     * @default false
     */
    customMessages?: boolean;
  };
  userPoolProps?: cognito.UserPoolProps;
  sesEmailSender?: {
    region: string;
    name: string;
    email: string;
  };
  groups?: {
    [name: string]: string;
  };
}

export class Authentication extends cdk.Construct {

  public readonly userpool: cognito.UserPool;
  public readonly customMessageFunction?: WatchableNodejsFunction;

  constructor(scope: cdk.Construct, id: string, props: AuthenticationProps) {
    super(scope, id);

    this.userpool = new cognito.UserPool(this, 'UserPool', {
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireDigits: false,
        requireLowercase: false,
        requireSymbols: false,
        requireUppercase: false,
      },
      standardAttributes: {
        fullname: {
          mutable: true,
          required: true,
        },
        email: {
          mutable: false,
          required: true,
        },
      },
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      signInCaseSensitive: false,
      ...props.userPoolProps,
    });

    if (props.triggers?.customMessages) {
      this.customMessageFunction = new WatchableNodejsFunction(this, 'CustomMessageFunction', {
        entry: './src/lambda/cognito.custom-message.ts',
        bundling: {
          loader: {
            '.html': 'text',
          },
        },
        handler: 'handler',
        timeout: cdk.Duration.seconds(5),
      });
      this.userpool.addTrigger(cognito.UserPoolOperation.CUSTOM_MESSAGE, this.customMessageFunction);
    }

    if (props.sesEmailSender) {
      (this.userpool.node.defaultChild as cognito.CfnUserPool).emailConfiguration = {
        emailSendingAccount: 'DEVELOPER',
        from: `${props.sesEmailSender.name} <${props.sesEmailSender.email}>`,
        sourceArn: `arn:aws:ses:${props.sesEmailSender.region}:${cdk.Stack.of(this).account}:identity/${props.sesEmailSender.email}`,
      };
    }

    for (const groupName in props.groups) {
      if (Object.prototype.hasOwnProperty.call(props.groups, groupName)) {
        const groupDescription = props.groups[groupName];
        new cognito.CfnUserPoolGroup(this, `Group${groupName}`, {
          userPoolId: this.userpool.userPoolId,
          groupName,
          description: groupDescription,
        });
      }
    }

    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userpool.userPoolId });
  }
}