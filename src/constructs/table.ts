import { aws_dynamodb as dynamodb, aws_kms as kms } from 'aws-cdk-lib';
import { GlobalSecondaryIndexProps, LocalSecondaryIndexProps } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface SingleTableDesign {

  /**
   * structure of the primary key
   */
  primaryKey: {
    partitionKey: string;
    sortKey?: string;
  };

  /**
   * The name of TTL attribute.
   *
   * @default - TTL is disabled
   */
  timeToLiveAttribute?: string;

  /**
   * global secondary indexes
   */
  globalIndexes?: GlobalSecondaryIndexProps[];

  /**
   * local secondary indexes
   */
  localIndexes?: LocalSecondaryIndexProps[];
}

export interface SingleTableDatastoreProps {

  /**
   * Table design
   */
  readonly design: SingleTableDesign;

  /**
   * Whether server-side encryption with an AWS managed customer master key is enabled.
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

export class SingleTableDatastore extends Construct {

  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: SingleTableDatastoreProps) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'Resource', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        type: dynamodb.AttributeType.STRING,
        name: props.design.primaryKey.partitionKey,
      },
      ...props.design.primaryKey.sortKey && {
        sortKey: {
          type: dynamodb.AttributeType.STRING,
          name: props.design.primaryKey.sortKey,
        },
      },
      pointInTimeRecovery: true,
      encryption: props.encryption,
      encryptionKey: props.encryptionKey,
      timeToLiveAttribute: props.design.timeToLiveAttribute,
    });

    for (const index of props.design.globalIndexes ?? []) {
      this.table.addGlobalSecondaryIndex(index);
    }
    for (const index of props.design.localIndexes ?? []) {
      this.table.addLocalSecondaryIndex(index);
    }
  }

}