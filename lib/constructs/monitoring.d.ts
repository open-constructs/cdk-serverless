import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as cdk from '@aws-cdk/core';
export interface MonitoringProps {
    /**
     * Name of the HTTP API
     */
    apiName: string;
    /**
     * Deployment stage (e.g. dev)
     */
    stageName: string;
}
export declare class Monitoring extends cdk.Construct {
    readonly dashboard: cloudwatch.Dashboard;
    readonly apiErrorsWidget: cloudwatch.GraphWidget;
    readonly apiLatencyWidget: cloudwatch.GraphWidget;
    readonly apiLatencyTailWidget: cloudwatch.GraphWidget;
    readonly lambdaErrorsWidget: cloudwatch.GraphWidget;
    readonly lambdaInvokesWidget: cloudwatch.GraphWidget;
    readonly lambdaDurationsWidget: cloudwatch.GraphWidget;
    constructor(scope: cdk.Construct, id: string, props: MonitoringProps);
    getTextWidget(fileName: string): cloudwatch.TextWidget;
}
