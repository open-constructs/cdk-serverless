import * as fs from 'fs';
import { OneSchema } from 'dynamodb-onetable';
import * as pj from 'projen';

export interface DatastoreOptions {
  readonly modelName: string;
  readonly definitionFile: string;
}

export class Datastore extends pj.Component {

  constructor(app: pj.awscdk.AwsCdkTypeScriptApp, protected options: DatastoreOptions) {
    super(app);

    app.addDeps('dynamodb-onetable');

    const model = JSON.parse(fs.readFileSync(options.definitionFile).toString()) as OneSchema;

    this.createModelFile(`./src/generated/datastore.${options.modelName.toLowerCase()}-model.generated.ts`, model);
    this.createConstructFile(`./src/generated/datastore.${options.modelName.toLowerCase()}-construct.generated.ts`, model);
  }

  protected createModelFile(fileName: string, model: OneSchema) {

    fs.writeFileSync(fileName, `import { dynamodb } from '@taimos/lambda-toolbox';
import { Model, Table, Entity } from 'dynamodb-onetable';

${Object.entries(model.indexes).map(([idx, data]) => `export const Index_${idx}_Name = '${idx}';
export const Index_${idx}_HashKey = '${data.hash}';
export const Index_${idx}_SortKey = '${data.sort}';
`).join('\n')}

export const Schema = ${this.stringifyModel(model)};

export const table = new Table({
  client: dynamodb.dynamoClient,
  name: dynamodb.TABLE_NAME,
  schema: Schema,
  isoDates: true,
  // logger: true,
  hidden: false,
});

${Object.entries(model.models).map(([typeName, _]) => `export type ${typeName}Type = Entity<typeof Schema.models.${typeName}>
export const ${typeName}: Model<${typeName}Type> = table.getModel<${typeName}Type>('${typeName}');
`)}

`, {
      encoding: 'utf-8',
    });
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

  protected createConstructFile(fileName: string, model: OneSchema) {

    fs.writeFileSync(fileName, `import { AttributeType, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { SingleTableDatastore, SingleTableDatastoreProps } from '../sls/constructs';

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
            projectionType: ProjectionType.${typeof data.project === 'string' ? data.project : 'INCLUDE'},
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

}`, {
      encoding: 'utf-8',
    });
  }

}