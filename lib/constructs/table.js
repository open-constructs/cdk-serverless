"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleTableDatastore = void 0;
const dynamodb = __importStar(require("@aws-cdk/aws-dynamodb"));
const cdk = __importStar(require("@aws-cdk/core"));
const tb = __importStar(require("@taimos/lambda-toolbox/lib/dynamodb"));
const tableTypes = __importStar(require("../types/table"));
class SingleTableDatastore extends cdk.Construct {
    constructor(scope, id, props) {
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
    addGlobalSecondaryIndex(name, partitionKey, sortKey) {
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
exports.SingleTableDatastore = SingleTableDatastore;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFibGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29uc3RydWN0cy90YWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsZ0VBQWtEO0FBRWxELG1EQUFxQztBQUNyQyx3RUFBMEQ7QUFDMUQsMkRBQTZDO0FBNEI3QyxNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxTQUFTO0lBSXJELFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDNUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ2hELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsb0JBQW9CLEVBQUUsQ0FBQyxLQUFLLENBQUMsVUFBVTtZQUN2QyxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTtnQkFDbkMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxVQUFVO2FBQ3BCO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07Z0JBQ25DLElBQUksRUFBRSxFQUFFLENBQUMsVUFBVTthQUNwQjtZQUNELG1CQUFtQixFQUFFLElBQUk7WUFDekIsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVO1lBQzVCLGFBQWEsRUFBRSxLQUFLLENBQUMsYUFBYTtZQUNsQyxtQkFBbUIsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLG1CQUFtQjtTQUN0RCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFNUYsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRTtZQUMzQixJQUFJLENBQUMsdUJBQXVCLENBQUMsVUFBVSxDQUFDLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1NBQ25IO1FBRUQsS0FBSyxNQUFNLFNBQVMsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLHVCQUF1QixFQUFFO1lBQzVELElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsdUJBQXVCLEVBQUUsU0FBUyxDQUFDLEVBQUU7Z0JBQ3pGLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsdUJBQXVCLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ2hFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLFlBQVksRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7YUFDaEY7U0FDRjtRQUVELEtBQUssTUFBTSxTQUFTLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUU7WUFDakQsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyx1QkFBdUIsRUFBRSxTQUFTLENBQUMsRUFBRTtnQkFDekYsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ3JELElBQUksQ0FBQyxLQUFLLENBQUMsc0JBQXNCLENBQUM7b0JBQ2hDLFNBQVM7b0JBQ1QsT0FBTyxFQUFFO3dCQUNQLElBQUksRUFBRSxPQUFPLENBQUMsT0FBTzt3QkFDckIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTtxQkFDcEM7b0JBQ0QsY0FBYyxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRztpQkFDNUMsQ0FBQyxDQUFDO2FBQ0o7U0FDRjtJQUNILENBQUM7SUFFRDs7T0FFRztJQUNJLHVCQUF1QixDQUFDLElBQVksRUFBRSxZQUFvQixFQUFFLE9BQWdCO1FBQ2pGLElBQUksQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUM7WUFDakMsU0FBUyxFQUFFLElBQUk7WUFDZixjQUFjLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHO1lBQzNDLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2dCQUNuQyxJQUFJLEVBQUUsWUFBWTthQUNuQjtZQUNELEdBQUcsT0FBTyxJQUFJO2dCQUNaLE9BQU8sRUFBRTtvQkFDUCxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO29CQUNuQyxJQUFJLEVBQUUsT0FBTztpQkFDZDthQUNGO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdkVELG9EQXVFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ0Bhd3MtY2RrL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnQGF3cy1jZGsvYXdzLWttcyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyB0YiBmcm9tICdAdGFpbW9zL2xhbWJkYS10b29sYm94L2xpYi9keW5hbW9kYic7XG5pbXBvcnQgKiBhcyB0YWJsZVR5cGVzIGZyb20gJy4uL3R5cGVzL3RhYmxlJztcblxuZXhwb3J0IGludGVyZmFjZSBTaW5nbGVUYWJsZURhdGFzdG9yZVByb3BzIHtcbiAgLyoqXG4gICAqIFRhYmxlIGRlc2lnblxuICAgKi9cbiAgcmVhZG9ubHkgZGVzaWduOiB0YWJsZVR5cGVzLlNpbmdsZVRhYmxlRGVzaWduO1xuICAvKipcbiAgICogV2hldGhlciBzZXJ2ZXItc2lkZSBlbmNyeXB0aW9uIHdpdGggYW4gQVdTIG1hbmFnZWQgY3VzdG9tZXIgbWFzdGVyIGtleSBpcyBlbmFibGVkLlxuICAgKlxuICAgKiBUaGlzIHByb3BlcnR5IGNhbm5vdCBiZSBzZXQgaWYgYHNlcnZlclNpZGVFbmNyeXB0aW9uYCBpcyBzZXQuXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gc2VydmVyLXNpZGUgZW5jcnlwdGlvbiBpcyBlbmFibGVkIHdpdGggYW4gQVdTIG93bmVkIGN1c3RvbWVyIG1hc3RlciBrZXlcbiAgICogQHN0YWJpbGl0eSBzdGFibGVcbiAgICovXG4gIHJlYWRvbmx5IGVuY3J5cHRpb24/OiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb247XG4gIC8qKlxuICAgKiBFeHRlcm5hbCBLTVMga2V5IHRvIHVzZSBmb3IgdGFibGUgZW5jcnlwdGlvbi5cbiAgICpcbiAgICogVGhpcyBwcm9wZXJ0eSBjYW4gb25seSBiZSBzZXQgaWYgYGVuY3J5cHRpb25gIGlzIHNldCB0byBgVGFibGVFbmNyeXB0aW9uLkNVU1RPTUVSX01BTkFHRURgLlxuICAgKlxuICAgKiBAZGVmYXVsdCAtIElmIGBlbmNyeXB0aW9uYCBpcyBzZXQgdG8gYFRhYmxlRW5jcnlwdGlvbi5DVVNUT01FUl9NQU5BR0VEYCBhbmQgdGhpc1xuICAgKiBwcm9wZXJ0eSBpcyB1bmRlZmluZWQsIGEgbmV3IEtNUyBrZXkgd2lsbCBiZSBjcmVhdGVkIGFuZCBhc3NvY2lhdGVkIHdpdGggdGhpcyB0YWJsZS5cbiAgICogQHN0YWJpbGl0eSBzdGFibGVcbiAgICovXG4gIHJlYWRvbmx5IGVuY3J5cHRpb25LZXk/OiBrbXMuSUtleTtcbn1cblxuZXhwb3J0IGNsYXNzIFNpbmdsZVRhYmxlRGF0YXN0b3JlIGV4dGVuZHMgY2RrLkNvbnN0cnVjdCB7XG5cbiAgcHVibGljIHJlYWRvbmx5IHRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFNpbmdsZVRhYmxlRGF0YXN0b3JlUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgdGhpcy50YWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUmVzb3VyY2UnLCB7XG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgc2VydmVyU2lkZUVuY3J5cHRpb246ICFwcm9wcy5lbmNyeXB0aW9uLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgICBuYW1lOiB0Yi5QcmltYXJ5X1BLLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICAgIG5hbWU6IHRiLlByaW1hcnlfU0ssXG4gICAgICB9LFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb246IHByb3BzLmVuY3J5cHRpb24sXG4gICAgICBlbmNyeXB0aW9uS2V5OiBwcm9wcy5lbmNyeXB0aW9uS2V5LFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogcHJvcHMuZGVzaWduLnRpbWVUb0xpdmVBdHRyaWJ1dGUsXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHRiLkluZGV4TmFtZV9HU0kxLCB0Yi5JbmRleE5hbWVfR1NJMV9QSywgdGIuSW5kZXhOYW1lX0dTSTFfU0spO1xuXG4gICAgaWYgKHByb3BzLmRlc2lnbi5yZXZlcnNlR1NJKSB7XG4gICAgICB0aGlzLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHRhYmxlVHlwZXMuUmV2ZXJzZUluZGV4TmFtZSwgdGFibGVUeXBlcy5SZXZlcnNlSW5kZXhfUEssIHRhYmxlVHlwZXMuUmV2ZXJzZUluZGV4X1NLKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGluZGV4TmFtZSBpbiBwcm9wcy5kZXNpZ24uYWRkaXRpb25hbEdsb2JhbEluZGV4ZXMpIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocHJvcHMuZGVzaWduLmFkZGl0aW9uYWxHbG9iYWxJbmRleGVzLCBpbmRleE5hbWUpKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSBwcm9wcy5kZXNpZ24uYWRkaXRpb25hbEdsb2JhbEluZGV4ZXNbaW5kZXhOYW1lXTtcbiAgICAgICAgdGhpcy5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleChpbmRleE5hbWUsIGVsZW1lbnQucGFydGl0aW9uS2V5LCBlbGVtZW50LnNvcnRLZXkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgaW5kZXhOYW1lIGluIHByb3BzLmRlc2lnbi5sb2NhbEluZGV4ZXMpIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocHJvcHMuZGVzaWduLmFkZGl0aW9uYWxHbG9iYWxJbmRleGVzLCBpbmRleE5hbWUpKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSBwcm9wcy5kZXNpZ24ubG9jYWxJbmRleGVzW2luZGV4TmFtZV07XG4gICAgICAgIHRoaXMudGFibGUuYWRkTG9jYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICAgICAgaW5kZXhOYW1lLFxuICAgICAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgICAgIG5hbWU6IGVsZW1lbnQuc29ydEtleSxcbiAgICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIGFkZEdsb2JhbFNlY29uZGFyeUluZGV4XG4gICAqL1xuICBwdWJsaWMgYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgobmFtZTogc3RyaW5nLCBwYXJ0aXRpb25LZXk6IHN0cmluZywgc29ydEtleT86IHN0cmluZykge1xuICAgIHRoaXMudGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiBuYW1lLFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgICAgbmFtZTogcGFydGl0aW9uS2V5LFxuICAgICAgfSxcbiAgICAgIC4uLnNvcnRLZXkgJiYge1xuICAgICAgICBzb3J0S2V5OiB7XG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICAgICAgbmFtZTogc29ydEtleSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbn0iXX0=