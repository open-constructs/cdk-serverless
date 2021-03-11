export declare const ReverseIndexName = "ReverseIndex";
export declare const ReverseIndex_PK = "SK";
export declare const ReverseIndex_SK = "PK";
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
        };
    };
    /**
     * local secondary indexes
     */
    localIndexes?: {
        [name: string]: {
            sortKey: string;
        };
    };
}
