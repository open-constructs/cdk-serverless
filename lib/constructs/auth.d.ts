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
export declare class Authentication extends cdk.Construct {
    readonly userpool: cognito.UserPool;
    readonly customMessageFunction?: WatchableNodejsFunction;
    constructor(scope: cdk.Construct, id: string, props: AuthenticationProps);
}
