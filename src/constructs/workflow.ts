import * as fs from 'fs';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as constructs from 'constructs';

export interface LambdaStateConfig {
  readonly handler: IFunction;
}
export interface DynamoDBStateConfig {
  readonly table: ITable;
  readonly writable?: boolean;
}

export interface WorkflowProps {
  readonly stateMachineType?: sfn.StateMachineType;
  readonly loggingConfiguration?: sfn.CfnStateMachine.LoggingConfigurationProperty;
  readonly tracingConfiguration?: sfn.CfnStateMachine.TracingConfigurationProperty;

  readonly definitionFileName: string;
  readonly definitionSubstitutions?: {
    [key: string]: (string);
  };
}

export class Workflow extends constructs.Construct implements iam.IGrantable {

  public readonly role: iam.IRole;
  public readonly workflowArn: string;
  public readonly grantPrincipal: iam.IPrincipal;

  constructor(scope: constructs.Construct, id: string, props: WorkflowProps) {
    super(scope, id);

    const definition = fs.readFileSync(props.definitionFileName).toString();

    this.role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });
    this.grantPrincipal = this.role;

    const resource = new sfn.CfnStateMachine(this, 'Resource', {
      stateMachineType: props.stateMachineType ?? sfn.StateMachineType.STANDARD,
      roleArn: this.role.roleArn,
      definitionString: definition,
      definitionSubstitutions: props.definitionSubstitutions,
      loggingConfiguration: props.loggingConfiguration,
      tracingConfiguration: props.tracingConfiguration,
    });
    resource.node.addDependency(this.role);
    this.workflowArn = resource.attrArn;
  }

}