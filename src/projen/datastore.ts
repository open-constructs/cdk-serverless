import * as fs from 'fs';
import { join } from 'path';
import { OneSchema } from 'dynamodb-onetable';
import * as pj from 'projen';
import { PACKAGE_NAME } from './core';
import { LazyTextFile } from './lazy-textfile';

export interface DatastoreOptions {
  readonly modelName: string;
  readonly definitionFile: string;
}

export class Datastore extends pj.Component {

  constructor(app: pj.awscdk.AwsCdkTypeScriptApp, protected options: DatastoreOptions) {
    super(app);

    app.addDeps(
      'dynamodb-onetable',
      '@aws-sdk/client-dynamodb',
      '@aws-sdk/lib-dynamodb',
      'uuid',
    );
    app.addDevDeps(
      '@types/uuid',
    );

    new pj.SampleFile(this.project, this.options.definitionFile, {
      contents: JSON.stringify({
        format: 'onetable:1.0.0',
        version: '0.1.0',
        indexes: {
          primary: {
            hash: 'PK',
            sort: 'SK',
          },
        },
        models: {
          User: {
            PK: {
              type: 'string',
              required: true,
              value: 'User#${name}',
            },
            SK: {
              type: 'string',
              required: true,
              value: 'User#${name}',
            },
            name: {
              type: 'string',
              required: true,
            },
          },
        },
      }),
    });

    new LazyTextFile(this.project, `src/generated/datastore.${this.options.modelName.toLowerCase()}-model.generated.ts`, { content: this.createModelFile.bind(this) });
    new LazyTextFile(this.project, `src/generated/datastore.${this.options.modelName.toLowerCase()}-construct.generated.ts`, { content: this.createConstructFile.bind(this) });
  }

  protected createModelFile(file: pj.FileBase): string {
    const model = JSON.parse(fs.readFileSync(join(this.project.outdir, this.options.definitionFile)).toString()) as OneSchema;

    return `// ${file.marker}
/* eslint-disable */
import { Model, Table, Entity } from 'dynamodb-onetable';
import { env } from 'process';
import { Dynamo } from 'dynamodb-onetable/Dynamo';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export const dynamoClient = new Dynamo({ client: new DynamoDBClient({}) })
export const TABLE_NAME: string = env.TABLE!;

${Object.entries(model.indexes).map(([idx, data]) => `export const Index_${idx}_Name = '${idx}';
export const Index_${idx}_HashKey = '${data.hash}';
export const Index_${idx}_SortKey = '${data.sort}';
`).join('\n')}

export const Schema = ${this.stringifyModel(model)};

export const table = new Table({
  client: dynamoClient,
  name: TABLE_NAME,
  schema: Schema,
  isoDates: true,
  // logger: true,
  hidden: false,
});

${Object.entries(model.models).map(([typeName, _]) => `export type ${typeName}Type = Entity<typeof Schema.models.${typeName}>;
export const ${typeName}: Model<${typeName}Type> = table.getModel<${typeName}Type>('${typeName}');
`).join('\n')}

`;
  }

  private stringifyModel(model: OneSchema) {
    // array, binary, boolean,         date, number, object, set, string
    // Array, Binary, Boolean, Buffer, Date, Number, Object, Set, String

    return JSON.stringify(model, null, 2)
      .replace(/"type": "array"/g, '"type": Array')
      .replace(/"type": "binary"/g, '"type": Binary')
      .replace(/"type": "boolean"/g, '"type": Boolean')
      .replace(/"type": "date"/g, '"type": Date')
      .replace(/"type": "number"/g, '"type": Number')
      .replace(/"type": "object"/g, '"type": Object')
      .replace(/"type": "set"/g, '"type": Set')
      .replace(/"type": "string"/g, '"type": String');
  }

  protected createConstructFile(file: pj.FileBase): string {
    const model = JSON.parse(fs.readFileSync(join(this.project.outdir, this.options.definitionFile)).toString()) as OneSchema;

    return `// ${file.marker}
/* eslint-disable */
import { AttributeType, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { SingleTableDatastore, SingleTableDatastoreProps } from '${PACKAGE_NAME}/lib/constructs';

export interface ${this.options.modelName}DatastoreProps extends Omit<SingleTableDatastoreProps, 'design'> {
  //
}

export class ${this.options.modelName}Datastore extends SingleTableDatastore {

  constructor(scope: Construct, id: string, props: ${this.options.modelName}DatastoreProps = {}) {
    super(scope, id, {
      ...props,
      design: {
        primaryKey: {
          partitionKey: '${model.indexes.primary.hash}',
          ${model.indexes.primary.sort ? `sortKey: '${model.indexes.primary.sort}',` : ''}
        },
        // timeToLiveAttribute: 'TODO',
        globalIndexes: [
          ${Object.entries(model.indexes).filter(([idx, data]) => idx !== 'primary' && data.type !== 'local').map(([idx, data]) => `{
            indexName: '${idx}',
            partitionKey: {
              name: '${data.hash}',
              type: AttributeType.STRING,
            },
            ${data.sort ? `sortKey: {
              name: '${data.sort}',
              type: AttributeType.STRING,
            },` : ''}
            projectionType: ProjectionType.${typeof data.project === 'string' ? data.project.toUpperCase() : 'INCLUDE'},
            ${Array.isArray(data.project) ? `nonKeyAttributes: [${data.project.map(e => `'${e}'`).join(',')}],` : ''}
          }`).join(',\n')}
        ],
        localIndexes: [
          ${Object.entries(model.indexes).filter(([_, data]) => data.type === 'local').map(([idx, data]) => `{
            indexName: '${idx}',
            sortKey: {
              name: '${data.sort}',
              type: AttributeType.STRING,
            },
            projectionType: ProjectionType.${typeof data.project === 'string' ? data.project : 'INCLUDE'},
            ${Array.isArray(data.project) ? `nonKeyAttributes: [${data.project.map(e => `'${e}'`).join(',')}],` : ''}
          }`).join(',\n')}
        ],
      }
    });
  }

}`;
  }

}