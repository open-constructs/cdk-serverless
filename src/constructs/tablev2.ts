import { aws_dynamodb as dynamodb, aws_kms as kms } from 'aws-cdk-lib';
import { GlobalSecondaryIndexPropsV2, LocalSecondaryIndexProps } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { ISingleTableDatastore } from './base-table';
export interface SingleTableDesignV2 {

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
  globalIndexes?: GlobalSecondaryIndexPropsV2[];

  /**
   * local secondary indexes
   */
  localIndexes?: LocalSecondaryIndexProps[];
}

export interface SingleTableDatastoreV2Props {

  /**
   * Table design
   */
  readonly design: SingleTableDesignV2;

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

/**
 * The SingleTableDatastore construct sets up an AWS DynamoDB table with a single-table design.
 * This construct facilitates the creation of a DynamoDB table with various configurations, including primary key, sort key, global secondary indexes, local secondary indexes, and encryption.
 * It also supports point-in-time recovery and time-to-live attributes.
 *
 * @example
 * const datastore = new SingleTableDatastore(this, 'MyDatastore', {
 *   design: {
 *     primaryKey: {
 *       partitionKey: 'PK',
 *       sortKey: 'SK',
 *     },
 *     globalIndexes: [
 *       {
 *         indexName: 'GSI1',
 *         partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
 *         sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
 *       },
 *     ],
 *     localIndexes: [
 *       {
 *         indexName: 'LSI1',
 *         sortKey: { name: 'LSI1SK', type: dynamodb.AttributeType.STRING },
 *       },
 *     ],
 *     timeToLiveAttribute: 'TTL',
 *   },
 *   encryptionKey: kms.Key.fromKeyArn(this, 'EncryptionKey', 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012'),
 * });
 */
export class SingleTableDatastoreV2 extends Construct implements ISingleTableDatastore {

  /**
   * The DynamoDB table instance.
   */
  public readonly table: dynamodb.ITable;

  /**
   * Creates an instance of SingleTableDatastore.
   *
   * @param scope - The scope in which this construct is defined.
   * @param id - The scoped construct ID.
   * @param props - The properties of the SingleTableDatastore construct.
   */
  constructor(scope: Construct, id: string, props: SingleTableDatastoreV2Props) {
    super(scope, id);

    const table = new dynamodb.TableV2(this, 'Resource', {
      billing: dynamodb.Billing.onDemand(),
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
      encryption: props.encryptionKey ?
        dynamodb.TableEncryptionV2.customerManagedKey(props.encryptionKey) :
        dynamodb.TableEncryptionV2.dynamoOwnedKey(),
      timeToLiveAttribute: props.design.timeToLiveAttribute,
    });

    for (const index of props.design.globalIndexes ?? []) {
      table.addGlobalSecondaryIndex(index);
    }
    for (const index of props.design.localIndexes ?? []) {
      table.addLocalSecondaryIndex(index);
    }

    this.table = table;
  }

}
