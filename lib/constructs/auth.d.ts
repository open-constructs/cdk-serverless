import * as cognito from '@aws-cdk/aws-cognito';
import * as cdk from '@aws-cdk/core';
import { WatchableNodejsFunction } from 'cdk-watch';
export interface AuthenticationProps {
    /**
     * Configure Cognito Lambda triggers
     */
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
    /**
     * Properties of the Cognito user pool
     */
    userPoolProps?: cognito.UserPoolProps;
    /**
     * Configure SES mail sending
     */
    sesEmailSender?: {
        /**
         * AWS region to use for SES
         */
        region: string;
        /**
         * Sender name
         */
        name: string;
        /**
         * Sender email. Needs to be verified in SES
         */
        email: string;
    };
    /**
     * Groups to create in Cognito user pool
     * Key: group name
     * Value: group description
     */
    groups?: {
        [name: string]: string;
    };
}
export declare class Authentication extends cdk.Construct {
    readonly userpool: cognito.UserPool;
    readonly customMessageFunction?: WatchableNodejsFunction;
    constructor(scope: cdk.Construct, id: string, props: AuthenticationProps);
}
