import fs from 'fs';
import { GraphWidget, IWidget, Row } from 'aws-cdk-lib/aws-cloudwatch';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import {
  BaseMonitoringProps, CountAxisFromZero, DefaultGraphWidgetHeight,
  Monitoring,
  MonitoringHeaderWidget,
  MonitoringScope,
  ThirdWidth, TimeAxisMillisFromZero,
} from 'cdk-monitoring-constructs';

export interface AggregatedFunctionMonitoringProps extends BaseMonitoringProps {
  functions: Record<string, IFunction>;
  apiName: string;
  title: string;
}

export class AggregatedFunctionMonitoring extends Monitoring {

  readonly title: string;
  readonly apiName: string;

  private readonly _functions: Record<string, IFunction>;

  constructor(scope: MonitoringScope, props: AggregatedFunctionMonitoringProps) {
    super(scope, props);

    this.title = props.title;
    this.apiName = props.apiName;
    this._functions = props.functions;
  }

  createTitleWidget() {
    const descriptionFile = `src/definitions/monitoring/${this.apiName}.description.md`;
    let description = `Create a file named '${descriptionFile}' to add a description to this API`;
    if (fs.existsSync(descriptionFile)) {
      description = fs.readFileSync(descriptionFile).toString('utf-8');
    }
    return new MonitoringHeaderWidget({
      family: this.apiName,
      title: this.title,
      description,
    });
  }

  createDurationWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: 'Lambda Duration',
      left: Object.entries(this._functions).map(([operationId, fn]) => fn.metricDuration({ label: operationId })),
      leftYAxis: TimeAxisMillisFromZero,
    });
  }

  createErrorsWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: 'Lambda Errors/Throttles',
      left: [
        ...Object.entries(this._functions).map(([operationId, fn]) => fn.metricErrors({ label: operationId })),
        ...Object.entries(this._functions).map(([operationId, fn]) => fn.metricThrottles({ label: operationId })),
      ],
      leftYAxis: CountAxisFromZero,
    });
  }

  createInvocationsWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: 'Lambda Invocations',
      left: [
        ...Object.entries(this._functions).map(([operationId, fn]) => fn.metricInvocations({ label: operationId })),
      ],
      leftYAxis: CountAxisFromZero,
    });
  }

  widgets(): IWidget[] {
    return [
      this.createTitleWidget(),
      new Row(
        this.createDurationWidget(ThirdWidth, DefaultGraphWidgetHeight),
        this.createErrorsWidget(ThirdWidth, DefaultGraphWidgetHeight),
        this.createInvocationsWidget(ThirdWidth, DefaultGraphWidgetHeight),
      ),
    ];
  }

}