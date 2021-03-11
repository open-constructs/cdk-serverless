import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as kms from '@aws-cdk/aws-kms';
import * as cdk from '@aws-cdk/core';
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
export declare class SingleTableDatastore extends cdk.Construct {
    readonly table: dynamodb.Table;
    constructor(scope: cdk.Construct, id: string, props: SingleTableDatastoreProps);
    /**
     * addGlobalSecondaryIndex
     */
    addGlobalSecondaryIndex(name: string, partitionKey: string, sortKey?: string): void;
}
