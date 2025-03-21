import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';

export interface ISingleTableDatastore {
  readonly table: dynamodb.ITable;
}
