import { existsSync, readFileSync } from 'fs';
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

export class Monitoring extends cdk.Construct {

  public readonly dashboard: cloudwatch.Dashboard;

  public readonly apiErrorsWidget: cloudwatch.GraphWidget;
  public readonly apiLatencyWidget: cloudwatch.GraphWidget;
  public readonly apiLatencyTailWidget: cloudwatch.GraphWidget;

  public readonly lambdaErrorsWidget: cloudwatch.GraphWidget;
  public readonly lambdaInvokesWidget: cloudwatch.GraphWidget;
  public readonly lambdaDurationsWidget: cloudwatch.GraphWidget;

  constructor(scope: cdk.Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${props.apiName}-${props.stageName}`,
    });

    this.apiErrorsWidget = new cloudwatch.GraphWidget({
      title: 'API Errors',
    });
    this.apiLatencyWidget = new cloudwatch.GraphWidget({
      title: 'API Latency',
    });
    this.apiLatencyTailWidget = new cloudwatch.GraphWidget({
      title: 'API Latency Longtail',
    });

    this.dashboard.addWidgets(
      this.getTextWidget('api'),
      this.apiErrorsWidget,
      this.apiLatencyWidget,
      this.apiLatencyTailWidget,
    );

    this.lambdaErrorsWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Errors/Throttles',
    });
    this.lambdaInvokesWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Invocations',
    });
    this.lambdaDurationsWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Duration',
    });

    this.dashboard.addWidgets(
      this.getTextWidget('functions'),
      this.lambdaErrorsWidget,
      this.lambdaInvokesWidget,
      this.lambdaDurationsWidget,
    );
  }

  getTextWidget(fileName: string): cloudwatch.TextWidget {
    const file = `./dashboard/${fileName}.md`;
    let markdown = `Create a file called './dashboard/${fileName}.md' to describe this widget`;
    if (existsSync(file)) {
      markdown = readFileSync(file).toString('utf-8');
    }
    return new cloudwatch.TextWidget({
      markdown,
      height: 6,
    });
  }
}