import * as iam from 'aws-cdk-lib/aws-iam';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as constructs from 'constructs';


export interface WorkflowProps {
  readonly stateMachineType?: sfn.StateMachineType;
  readonly loggingConfiguration?: sfn.CfnStateMachine.LoggingConfigurationProperty;
  readonly tracingConfiguration?: sfn.CfnStateMachine.TracingConfigurationProperty;

  readonly definitionFileName: string;
  readonly definitionSubstitutions?: {
    [key: string]: (string);
  };
}

/**
 * The Workflow construct sets up an AWS Step Functions state machine with a specified definition file and IAM role.
 * This construct facilitates the creation of a Step Functions workflow, including the definition from an S3 location and
 * various configurations for logging and tracing. It implements the IGrantable interface for granting permissions.
 *
 * @example
 * const workflow = new Workflow(this, 'MyWorkflow', {
 *   definitionFileName: 'path/to/definition.asl.json',
 *   stateMachineType: sfn.StateMachineType.STANDARD,
 *   loggingConfiguration: {
 *     level: sfn.LogLevel.ALL,
 *     includeExecutionData: true,
 *     destinations: [new logs.LogGroup(this, 'LogGroup')],
 *   },
 *   tracingConfiguration: {
 *     enabled: true,
 *   },
 *   definitionSubstitutions: {
 *     '${MyVariable}': 'MyValue',
 *   },
 * });
 *
 * const lambdaFunction = new lambda.Function(this, 'MyFunction', {
 *   runtime: lambda.Runtime.NODEJS_20_X,
 *   handler: 'index.handler',
 *   code: lambda.Code.fromAsset('lambda'),
 * });
 *
 * workflow.grantPrincipal.grantInvoke(lambdaFunction);
 */
export class Workflow extends constructs.Construct implements iam.IGrantable {

  /**
   * The IAM role assumed by the state machine.
   */
  public readonly role: iam.IRole;

  /**
   * The ARN of the created state machine.
   */
  public readonly workflowArn: string;

  /**
   * The principal to which permissions can be granted.
   */
  public readonly grantPrincipal: iam.IPrincipal;

  /**
   * Creates an instance of Workflow.
   *
   * @param scope - The scope in which this construct is defined.
   * @param id - The scoped construct ID.
   * @param props - The properties of the Workflow construct.
   */
  constructor(scope: constructs.Construct, id: string, props: WorkflowProps) {
    super(scope, id);

    this.role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });
    this.grantPrincipal = this.role;

    const definitionAsset = new Asset(this, 'DefinitionAsset', {
      path: props.definitionFileName,
    });

    const resource = new sfn.CfnStateMachine(this, 'Resource', {
      stateMachineType: props.stateMachineType ?? sfn.StateMachineType.STANDARD,
      roleArn: this.role.roleArn,
      definitionS3Location: {
        bucket: definitionAsset.s3BucketName,
        key: definitionAsset.s3ObjectKey,
      },
      definitionSubstitutions: props.definitionSubstitutions,
      loggingConfiguration: props.loggingConfiguration,
      tracingConfiguration: props.tracingConfiguration,
    });
    resource.node.addDependency(this.role);
    this.workflowArn = resource.attrArn;
  }
}
