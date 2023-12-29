import * as fs from 'fs';
import { join } from 'path';
import * as pj from 'projen';
import { PACKAGE_NAME } from './core';
import { LazyTextFile } from './lazy-textfile';

export interface WorkflowOptions {
  readonly workflowName: string;
  readonly definitionFile: string;
}

interface VariableDefinition {
  readonly fullName: string;
  readonly name: string;
  readonly type: string;
}

export class Workflow extends pj.Component {

  constructor(app: pj.awscdk.AwsCdkTypeScriptApp, protected options: WorkflowOptions) {
    super(app);

    new pj.SampleFile(this.project, this.options.definitionFile, {
      contents: JSON.stringify({
        StartAt: 'Hello World',
        States: {
          'Hello World': {
            Type: 'Pass',
            Result: {
              Hello: '${world}',
            },
            End: true,
          },
        },
      }, undefined, 2),
    });

    new LazyTextFile(this.project, `src/generated/workflow.${this.options.workflowName.toLowerCase()}.generated.ts`, { content: this.createConstructFile.bind(this) });
  }

  protected createConstructFile(file: pj.FileBase): string {
    const workflowDefinition = fs.readFileSync(join(this.project.outdir, this.options.definitionFile)).toString();
    const matches = workflowDefinition.match(/\$\{[a-zA-Z0-9#]*\}/g)?.map(match => match.substring(2, match.length - 1));
    const matchedVariables: VariableDefinition[] = (matches ?? []).map(varName => {
      if (varName.indexOf('#') < 0) {
        return { name: varName, fullName: varName, type: 'string' };
      }
      const [name, type] = varName.split('#');
      return { name, type, fullName: varName };
    });

    return `// ${file.marker}
/* eslint-disable */
import * as constructs from 'constructs';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import * as sls from '${PACKAGE_NAME}/lib/constructs';

export interface ${this.options.workflowName}WorkflowProps extends Omit<sls.WorkflowProps, 'definitionFileName' | 'definitionSubstitutions'> {
  readonly stateConfig: {
    ${matchedVariables.map(v => this.renderStateConfigDefinition(v)).join('\n')}
  };
}

export class ${this.options.workflowName}Workflow extends sls.Workflow {

  constructor(scope: constructs.Construct, id: string, props: ${this.options.workflowName}WorkflowProps) {
    super(scope, id, {
      ...props,
      definitionFileName: '${this.options.definitionFile}',
      definitionSubstitutions: {
        ${matchedVariables.map(v => this.renderDefinitionSubstitution(v)).join('\n')}
      }
    });
  }

}`;
  }

  protected renderStateConfigDefinition(def: VariableDefinition): string {
    switch (def.type) {
      case 'DynamoDBTable':
        return `readonly ${def.name}: ITable;`;
      case 'LambdaFunction':
        return `readonly ${def.name}: IFunction;`;
      case 'string':
      default:
        return `readonly ${def.name}: string;`;
    }
  }

  protected renderDefinitionSubstitution(def: VariableDefinition): string {
    switch (def.type) {
      case 'DynamoDBTable':
        return `'${def.fullName}': props.stateConfig.${def.name}.tableName,`;
      case 'LambdaFunction':
        return `'${def.fullName}': props.stateConfig.${def.name}.functionArn,`;
      case 'string':
      default:
        return `'${def.fullName}': props.stateConfig.${def.name},`;
    }
  }

}