import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as kms from '@aws-cdk/aws-kms';
import * as cdk from '@aws-cdk/core';
import * as tb from '@taimos/lambda-toolbox/lib/dynamodb';
import * as tableTypes from '../types/table';

export interface SingleTableDatastoreProps {
  /**
   * Table design
   */
  readonly design: tableTypes.SingleTableDesign;
  /**
   * Whether server-side encryption with an AWS managed customer master key is enabled.
   *
   * This property cannot be set if `serverSideEncryption` is set.
   *
   * @default - server-side encryption is enabled with an AWS owned customer master key
   * @stability stable
   */
  readonly encryption?: dynamodb.TableEncryption;
  /**
   * External KMS key to use for table encryption.
   *
   * This property can only be set if `encryption` is set to `TableEncryption.CUSTOMER_MANAGED`.
   *
   * @default - If `encryption` is set to `TableEncryption.CUSTOMER_MANAGED` and this
   * property is undefined, a new KMS key will be created and associated with this table.
   * @stability stable
   */
  readonly encryptionKey?: kms.IKey;
}

export class SingleTableDatastore extends cdk.Construct {

  public readonly table: dynamodb.Table;

  constructor(scope: cdk.Construct, id: string, props: SingleTableDatastoreProps) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'Resource', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      serverSideEncryption: !props.encryption,
      partitionKey: {
        type: dynamodb.AttributeType.STRING,
        name: tb.Primary_PK,
      },
      sortKey: {
        type: dynamodb.AttributeType.STRING,
        name: tb.Primary_SK,
      },
      pointInTimeRecovery: true,
      encryption: props.encryption,
      encryptionKey: props.encryptionKey,
      timeToLiveAttribute: props.design.timeToLiveAttribute,
    });

    this.addGlobalSecondaryIndex(tb.IndexName_GSI1, tb.IndexName_GSI1_PK, tb.IndexName_GSI1_SK);

    if (props.design.reverseGSI) {
      this.addGlobalSecondaryIndex(tableTypes.ReverseIndexName, tableTypes.ReverseIndex_PK, tableTypes.ReverseIndex_SK);
    }

    for (const indexName in props.design.additionalGlobalIndexes) {
      if (Object.prototype.hasOwnProperty.call(props.design.additionalGlobalIndexes, indexName)) {
        const element = props.design.additionalGlobalIndexes[indexName];
        this.addGlobalSecondaryIndex(indexName, element.partitionKey, element.sortKey);
      }
    }

    for (const indexName in props.design.localIndexes) {
      if (Object.prototype.hasOwnProperty.call(props.design.additionalGlobalIndexes, indexName)) {
        const element = props.design.localIndexes[indexName];
        this.table.addLocalSecondaryIndex({
          indexName,
          sortKey: {
            name: element.sortKey,
            type: dynamodb.AttributeType.STRING,
          },
          projectionType: dynamodb.ProjectionType.ALL,
        });
      }
    }
  }

  /**
   * addGlobalSecondaryIndex
   */
  public addGlobalSecondaryIndex(name: string, partitionKey: string, sortKey?: string) {
    this.table.addGlobalSecondaryIndex({
      indexName: name,
      projectionType: dynamodb.ProjectionType.ALL,
      partitionKey: {
        type: dynamodb.AttributeType.STRING,
        name: partitionKey,
      },
      ...sortKey && {
        sortKey: {
          type: dynamodb.AttributeType.STRING,
          name: sortKey,
        },
      },
    });
  }
}