import * as tb from '@taimos/lambda-toolbox/lib/dynamodb';

export const ReverseIndexName = 'ReverseIndex';
export const ReverseIndex_PK = tb.Primary_SK;
export const ReverseIndex_SK = tb.Primary_PK;

export interface SingleTableDesign {
  /**
   * Create reverse GSI named 'ReverseIndex' and SK as partition key and PK as sort key
   * 
   * @default false
   */
  reverseGSI?: boolean;

  /**
   * The name of TTL attribute.
   *
   * @default - TTL is disabled
   */
  timeToLiveAttribute?: string;

  /**
   * additional global secondary indexes
   */
  additionalGlobalIndexes?: {
    [name: string]: {
      partitionKey: string;
      sortKey?: string;
    }
  };

  /**
   * local secondary indexes
   */
  localIndexes?: {
    [name: string]: {
      sortKey: string;
    }
  };
}
