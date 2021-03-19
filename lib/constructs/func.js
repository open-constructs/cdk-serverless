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
exports.LambdaFunction = void 0;
const iam = __importStar(require("@aws-cdk/aws-iam"));
const cdk = __importStar(require("@aws-cdk/core"));
const cdk_watch_1 = require("cdk-watch");
class LambdaFunction extends cdk_watch_1.WatchableNodejsFunction {
    constructor(scope, id, props) {
        var _a, _b;
        super(scope, id, {
            entry: props.entry,
            bundling: {
                externalModules: props.includeSDK ? [] : undefined,
                loader: {
                    '.yaml': 'text',
                },
            },
            environment: {
                STAGE: props.stageName,
                ...props.table && {
                    TABLE: props.table.tableName,
                },
                ...props.userPool && {
                    USER_POOL_ID: props.userPool.userPoolId,
                },
                ...props.assetBucket && {
                    ASSET_BUCKET: props.assetBucket.bucketName,
                },
                ...props.assetDomainName && {
                    ASSET_DOMAIN_NAME: props.assetDomainName,
                },
                ...props.additionalEnv,
            },
            handler: (_a = props.handler) !== null && _a !== void 0 ? _a : 'handler',
            timeout: cdk.Duration.seconds(5),
            // logRetention: 3,
            description: props.description,
        });
        this.props = props;
        if (props.table) {
            if ((_b = props.tableWrites) !== null && _b !== void 0 ? _b : true) {
                props.table.grantReadWriteData(this);
            }
            else {
                props.table.grantReadData(this);
            }
        }
    }
    grantSendEmails() {
        this.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: [
                'ses:SendTemplatedEmail',
                'ses:SendBulkTemplatedEmail',
            ],
            resources: ['*'],
        }));
        return this;
    }
    grantUploadAssets() {
        if (!this.props.assetBucket) {
            throw new Error('No asset bucket configured');
        }
        this.props.assetBucket.grantPut(this);
        return this;
    }
    grantDeleteAsset() {
        if (!this.props.assetBucket) {
            throw new Error('No asset bucket configured');
        }
        this.props.assetBucket.grantDelete(this);
        return this;
    }
    grantUserpoolRead() {
        if (!this.props.userPool) {
            throw new Error('No user pool configured');
        }
        this.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: [
                'cognito-idp:ListUsers',
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminListGroupsForUser',
            ],
            resources: [this.props.userPool.userPoolArn],
        }));
        return this;
    }
    grantUserpoolReadWrite() {
        if (!this.props.userPool) {
            throw new Error('No user pool configured');
        }
        this.grantUserpoolRead();
        this.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: [
                'cognito-idp:AdminUpdateUserAttributes',
                'cognito-idp:AdminAddUserToGroup',
                'cognito-idp:AdminRemoveUserFromGroup',
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminDeleteUser',
            ],
            resources: [this.props.userPool.userPoolArn],
        }));
        return this;
    }
}
exports.LambdaFunction = LambdaFunction;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnVuYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb25zdHJ1Y3RzL2Z1bmMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVBLHNEQUF3QztBQUV4QyxtREFBcUM7QUFDckMseUNBQW9EO0FBc0VwRCxNQUFhLGNBQWUsU0FBUSxtQ0FBdUI7SUFFekQsWUFBWSxLQUFvQixFQUFFLEVBQVUsRUFBVSxLQUEwQjs7UUFDOUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUU7WUFDZixLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7WUFDbEIsUUFBUSxFQUFFO2dCQUNSLGVBQWUsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVM7Z0JBQ2xELE1BQU0sRUFBRTtvQkFDTixPQUFPLEVBQUUsTUFBTTtpQkFDaEI7YUFDRjtZQUNELFdBQVcsRUFBRTtnQkFDWCxLQUFLLEVBQUUsS0FBSyxDQUFDLFNBQVM7Z0JBQ3RCLEdBQUcsS0FBSyxDQUFDLEtBQUssSUFBSTtvQkFDaEIsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUztpQkFDN0I7Z0JBQ0QsR0FBRyxLQUFLLENBQUMsUUFBUSxJQUFJO29CQUNuQixZQUFZLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVO2lCQUN4QztnQkFDRCxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUk7b0JBQ3RCLFlBQVksRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLFVBQVU7aUJBQzNDO2dCQUNELEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSTtvQkFDMUIsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLGVBQWU7aUJBQ3pDO2dCQUNELEdBQUcsS0FBSyxDQUFDLGFBQWE7YUFDdkI7WUFDRCxPQUFPLEVBQUUsTUFBQSxLQUFLLENBQUMsT0FBTyxtQ0FBSSxTQUFTO1lBQ25DLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDaEMsbUJBQW1CO1lBQ25CLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVztTQUMvQixDQUFDLENBQUM7UUE3QmlELFVBQUssR0FBTCxLQUFLLENBQXFCO1FBK0I5RSxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUU7WUFDZixJQUFJLE1BQUEsS0FBSyxDQUFDLFdBQVcsbUNBQUksSUFBSSxFQUFFO2dCQUM3QixLQUFLLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3RDO2lCQUFNO2dCQUNMLEtBQUssQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2pDO1NBQ0Y7SUFDSCxDQUFDO0lBRU0sZUFBZTtRQUNwQixJQUFJLENBQUMsY0FBYyxDQUFDLG9CQUFvQixDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUMvRCxPQUFPLEVBQUU7Z0JBQ1Asd0JBQXdCO2dCQUN4Qiw0QkFBNEI7YUFDN0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUFDLENBQUM7UUFDSixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTSxpQkFBaUI7UUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFO1lBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztTQUMvQztRQUNELElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTSxnQkFBZ0I7UUFDckIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFO1lBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztTQUMvQztRQUNELElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6QyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTSxpQkFBaUI7UUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFO1lBQ3hCLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztTQUM1QztRQUNELElBQUksQ0FBQyxjQUFjLENBQUMsb0JBQW9CLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQy9ELE9BQU8sRUFBRTtnQkFDUCx1QkFBdUI7Z0JBQ3ZCLDBCQUEwQjtnQkFDMUIsb0NBQW9DO2FBQ3JDO1lBQ0QsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO1NBQzdDLENBQUMsQ0FBQyxDQUFDO1FBQ0osT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRU0sc0JBQXNCO1FBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRTtZQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7U0FDNUM7UUFDRCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsY0FBYyxDQUFDLG9CQUFvQixDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUMvRCxPQUFPLEVBQUU7Z0JBQ1AsdUNBQXVDO2dCQUN2QyxpQ0FBaUM7Z0JBQ2pDLHNDQUFzQztnQkFDdEMsNkJBQTZCO2dCQUM3Qiw2QkFBNkI7YUFDOUI7WUFDRCxTQUFTLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUM7U0FDN0MsQ0FBQyxDQUFDLENBQUM7UUFDSixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRjtBQXJHRCx3Q0FxR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ0Bhd3MtY2RrL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdAYXdzLWNkay9hd3MtczMnO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IHsgV2F0Y2hhYmxlTm9kZWpzRnVuY3Rpb24gfSBmcm9tICdjZGstd2F0Y2gnO1xuXG5leHBvcnQgaW50ZXJmYWNlIExhbWJkYUZ1bmN0aW9uUHJvcHMge1xuICAvKipcbiAgICogRGVwbG95bWVudCBzdGFnZSAoZS5nLiBkZXYpXG4gICAqL1xuICBzdGFnZU5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogZW50cnkgZmlsZSBuYW1lXG4gICAqL1xuICBlbnRyeTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBuYW1lIG9mIHRoZSBleHBvcnRlZCBoYW5kbGVyIGZ1bmN0aW9uXG4gICAqXG4gICAqIEBkZWZhdWx0IGhhbmRsZXJcbiAgICovXG4gIGhhbmRsZXI/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIGRlc2NyaXB0aW9uIG9mIHRoZSBMYW1iZGEgZnVuY3Rpb25cbiAgICovXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBEeW5hbW9EQiB0aGF0IGlzIHVzZWQgYXMgZGF0YXN0b3JlXG4gICAqIFRoZSBMYW1iZGEgZnVuY3Rpb24gd2lsbCBoYXZlIHJlYWQgYWNjZXNzIHRvIHRoaXMgdGFibGUgYXV0b21hdGljYWxseVxuICAgKiBUaGUgbmFtZSBvZiB0aGUgdGFibGUgaXMgYXZhaWxhYmxlIGFzIHByb2Nlc3MuZW52LlRBQkxFXG4gICAqL1xuICB0YWJsZT86IGR5bmFtb2RiLklUYWJsZTtcblxuICAvKipcbiAgICogQWN0aXZhdGUgd3JpdGUgcGVybWlzc2lvbnMgdG8gdGhlIER5bmFtb0RCIHRhYmxlXG4gICAqL1xuICB0YWJsZVdyaXRlcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIENvZ25pdG8gdXNlciBwb29sXG4gICAqIFRoZSBuYW1lIG9mIHRoZSBwb29sIGlzIGF2YWlsYWJsZSBhcyBwcm9jZXNzLmVudi5VU0VSX1BPT0xfSURcbiAgICovXG4gIHVzZXJQb29sPzogY29nbml0by5JVXNlclBvb2w7XG5cbiAgLyoqXG4gICAqIEJ1Y2tldCB0aGF0IGlzIHVzZWQgZm9yIGFzc2V0cyBhbmQgcHVibGlzaGVkIHVzaW5nIHRoZSBhc3NldCBDRE5cbiAgICogVGhlIG5hbWUgb2YgdGhlIGJ1Y2tldCBpcyBhdmFpbGFibGUgYXMgcHJvY2Vzcy5lbnYuQVNTRVRfQlVDS0VUXG4gICAqL1xuICBhc3NldEJ1Y2tldD86IHMzLkJ1Y2tldDtcblxuICAvKipcbiAgICogRnVsbHkgcXVhbGlmaWVkIGRvbWFpbiBuYW1lIG9mIHRoZSBhc3NldCBDRE5cbiAgICogSXQgaXMgYXZhaWxhYmxlIGFzIHByb2Nlc3MuZW52LkFTU0VUX0RPQU1JTl9OQU1FXG4gICAqL1xuICBhc3NldERvbWFpbk5hbWU/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFNob3VsZCB0aGUgQVdTLVNESyBiZSBwYWNrYWdlZCB3aXRoIHRoZSBMYW1iZGEgY29kZSBvciBleGNsdWRlZFxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZSAoZXhjbHVkZSBTREsgYW5kIHVzZSBydW50aW1lIHByb3ZpZGVkIG9uZSlcbiAgICovXG4gIGluY2x1ZGVTREs/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBhZGRpdGlvbmFsIGVudmlyb25tZW50IHZhcmlhYmxlcyBvZiB0aGUgTGFtYmRhIGZ1bmN0aW9uXG4gICAqL1xuICBhZGRpdGlvbmFsRW52Pzoge1xuICAgIFtrZXk6IHN0cmluZ106IHN0cmluZztcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIExhbWJkYUZ1bmN0aW9uIGV4dGVuZHMgV2F0Y2hhYmxlTm9kZWpzRnVuY3Rpb24ge1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcml2YXRlIHByb3BzOiBMYW1iZGFGdW5jdGlvblByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCB7XG4gICAgICBlbnRyeTogcHJvcHMuZW50cnksXG4gICAgICBidW5kbGluZzoge1xuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IHByb3BzLmluY2x1ZGVTREsgPyBbXSA6IHVuZGVmaW5lZCxcbiAgICAgICAgbG9hZGVyOiB7XG4gICAgICAgICAgJy55YW1sJzogJ3RleHQnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFNUQUdFOiBwcm9wcy5zdGFnZU5hbWUsXG4gICAgICAgIC4uLnByb3BzLnRhYmxlICYmIHtcbiAgICAgICAgICBUQUJMRTogcHJvcHMudGFibGUudGFibGVOYW1lLFxuICAgICAgICB9LFxuICAgICAgICAuLi5wcm9wcy51c2VyUG9vbCAmJiB7XG4gICAgICAgICAgVVNFUl9QT09MX0lEOiBwcm9wcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICB9LFxuICAgICAgICAuLi5wcm9wcy5hc3NldEJ1Y2tldCAmJiB7XG4gICAgICAgICAgQVNTRVRfQlVDS0VUOiBwcm9wcy5hc3NldEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICB9LFxuICAgICAgICAuLi5wcm9wcy5hc3NldERvbWFpbk5hbWUgJiYge1xuICAgICAgICAgIEFTU0VUX0RPTUFJTl9OQU1FOiBwcm9wcy5hc3NldERvbWFpbk5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIC4uLnByb3BzLmFkZGl0aW9uYWxFbnYsXG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogcHJvcHMuaGFuZGxlciA/PyAnaGFuZGxlcicsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcbiAgICAgIC8vIGxvZ1JldGVudGlvbjogMyxcbiAgICAgIGRlc2NyaXB0aW9uOiBwcm9wcy5kZXNjcmlwdGlvbixcbiAgICB9KTtcblxuICAgIGlmIChwcm9wcy50YWJsZSkge1xuICAgICAgaWYgKHByb3BzLnRhYmxlV3JpdGVzID8/IHRydWUpIHtcbiAgICAgICAgcHJvcHMudGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJvcHMudGFibGUuZ3JhbnRSZWFkRGF0YSh0aGlzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgZ3JhbnRTZW5kRW1haWxzKCk6IExhbWJkYUZ1bmN0aW9uIHtcbiAgICB0aGlzLmdyYW50UHJpbmNpcGFsLmFkZFRvUHJpbmNpcGFsUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NlczpTZW5kVGVtcGxhdGVkRW1haWwnLFxuICAgICAgICAnc2VzOlNlbmRCdWxrVGVtcGxhdGVkRW1haWwnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVibGljIGdyYW50VXBsb2FkQXNzZXRzKCk6IExhbWJkYUZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMucHJvcHMuYXNzZXRCdWNrZXQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gYXNzZXQgYnVja2V0IGNvbmZpZ3VyZWQnKTtcbiAgICB9XG4gICAgdGhpcy5wcm9wcy5hc3NldEJ1Y2tldC5ncmFudFB1dCh0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1YmxpYyBncmFudERlbGV0ZUFzc2V0KCk6IExhbWJkYUZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMucHJvcHMuYXNzZXRCdWNrZXQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gYXNzZXQgYnVja2V0IGNvbmZpZ3VyZWQnKTtcbiAgICB9XG4gICAgdGhpcy5wcm9wcy5hc3NldEJ1Y2tldC5ncmFudERlbGV0ZSh0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1YmxpYyBncmFudFVzZXJwb29sUmVhZCgpOiBMYW1iZGFGdW5jdGlvbiB7XG4gICAgaWYgKCF0aGlzLnByb3BzLnVzZXJQb29sKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHVzZXIgcG9vbCBjb25maWd1cmVkJyk7XG4gICAgfVxuICAgIHRoaXMuZ3JhbnRQcmluY2lwYWwuYWRkVG9QcmluY2lwYWxQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnY29nbml0by1pZHA6TGlzdFVzZXJzJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluR2V0VXNlcicsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkxpc3RHcm91cHNGb3JVc2VyJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFt0aGlzLnByb3BzLnVzZXJQb29sLnVzZXJQb29sQXJuXSxcbiAgICB9KSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWJsaWMgZ3JhbnRVc2VycG9vbFJlYWRXcml0ZSgpOiBMYW1iZGFGdW5jdGlvbiB7XG4gICAgaWYgKCF0aGlzLnByb3BzLnVzZXJQb29sKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHVzZXIgcG9vbCBjb25maWd1cmVkJyk7XG4gICAgfVxuICAgIHRoaXMuZ3JhbnRVc2VycG9vbFJlYWQoKTtcbiAgICB0aGlzLmdyYW50UHJpbmNpcGFsLmFkZFRvUHJpbmNpcGFsUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluVXBkYXRlVXNlckF0dHJpYnV0ZXMnLFxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5BZGRVc2VyVG9Hcm91cCcsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pblJlbW92ZVVzZXJGcm9tR3JvdXAnLFxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluRGVsZXRlVXNlcicsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbdGhpcy5wcm9wcy51c2VyUG9vbC51c2VyUG9vbEFybl0sXG4gICAgfSkpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG59Il19