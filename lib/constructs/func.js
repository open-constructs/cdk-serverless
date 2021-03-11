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
            entry: `./src/lambda/${props.file}.ts`,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnVuYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb25zdHJ1Y3RzL2Z1bmMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVBLHNEQUF3QztBQUV4QyxtREFBcUM7QUFDckMseUNBQW9EO0FBa0JwRCxNQUFhLGNBQWUsU0FBUSxtQ0FBdUI7SUFDekQsWUFBWSxLQUFvQixFQUFFLEVBQVUsRUFBVSxLQUEwQjs7UUFDOUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUU7WUFDZixLQUFLLEVBQUUsZ0JBQWdCLEtBQUssQ0FBQyxJQUFJLEtBQUs7WUFDdEMsUUFBUSxFQUFFO2dCQUNSLGVBQWUsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVM7Z0JBQ2xELE1BQU0sRUFBRTtvQkFDTixPQUFPLEVBQUUsTUFBTTtpQkFDaEI7YUFDRjtZQUNELFdBQVcsRUFBRTtnQkFDWCxLQUFLLEVBQUUsS0FBSyxDQUFDLFNBQVM7Z0JBQ3RCLEdBQUcsS0FBSyxDQUFDLEtBQUssSUFBSTtvQkFDaEIsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUztpQkFDN0I7Z0JBQ0QsR0FBRyxLQUFLLENBQUMsUUFBUSxJQUFJO29CQUNuQixZQUFZLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxVQUFVO2lCQUN4QztnQkFDRCxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUk7b0JBQ3RCLFlBQVksRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLFVBQVU7aUJBQzNDO2dCQUNELEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSTtvQkFDMUIsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLGVBQWU7aUJBQ3pDO2dCQUNELEdBQUcsS0FBSyxDQUFDLGFBQWE7YUFDdkI7WUFDRCxPQUFPLEVBQUUsTUFBQSxLQUFLLENBQUMsT0FBTyxtQ0FBSSxTQUFTO1lBQ25DLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDaEMsbUJBQW1CO1lBQ25CLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVztTQUMvQixDQUFDLENBQUM7UUE3QmlELFVBQUssR0FBTCxLQUFLLENBQXFCO1FBK0I5RSxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUU7WUFDZixJQUFJLE1BQUEsS0FBSyxDQUFDLFdBQVcsbUNBQUksSUFBSSxFQUFFO2dCQUM3QixLQUFLLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3RDO2lCQUFNO2dCQUNMLEtBQUssQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2pDO1NBQ0Y7SUFDSCxDQUFDO0lBRU0sZUFBZTtRQUNwQixJQUFJLENBQUMsY0FBYyxDQUFDLG9CQUFvQixDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUMvRCxPQUFPLEVBQUU7Z0JBQ1Asd0JBQXdCO2dCQUN4Qiw0QkFBNEI7YUFDN0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUFDLENBQUM7UUFDSixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTSxpQkFBaUI7UUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFO1lBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztTQUMvQztRQUNELElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTSxnQkFBZ0I7UUFDckIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFO1lBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztTQUMvQztRQUNELElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6QyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTSxpQkFBaUI7UUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFO1lBQ3hCLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztTQUM1QztRQUNELElBQUksQ0FBQyxjQUFjLENBQUMsb0JBQW9CLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQy9ELE9BQU8sRUFBRTtnQkFDUCx1QkFBdUI7Z0JBQ3ZCLDBCQUEwQjtnQkFDMUIsb0NBQW9DO2FBQ3JDO1lBQ0QsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO1NBQzdDLENBQUMsQ0FBQyxDQUFDO1FBQ0osT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRU0sc0JBQXNCO1FBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRTtZQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7U0FDNUM7UUFDRCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsY0FBYyxDQUFDLG9CQUFvQixDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUMvRCxPQUFPLEVBQUU7Z0JBQ1AsdUNBQXVDO2dCQUN2QyxpQ0FBaUM7Z0JBQ2pDLHNDQUFzQztnQkFDdEMsNkJBQTZCO2dCQUM3Qiw2QkFBNkI7YUFDOUI7WUFDRCxTQUFTLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUM7U0FDN0MsQ0FBQyxDQUFDLENBQUM7UUFDSixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRjtBQXBHRCx3Q0FvR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ0Bhd3MtY2RrL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdAYXdzLWNkay9hd3MtczMnO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IHsgV2F0Y2hhYmxlTm9kZWpzRnVuY3Rpb24gfSBmcm9tICdjZGstd2F0Y2gnO1xuXG5leHBvcnQgaW50ZXJmYWNlIExhbWJkYUZ1bmN0aW9uUHJvcHMge1xuICBzdGFnZU5hbWU6IHN0cmluZztcbiAgZmlsZTogc3RyaW5nO1xuICBoYW5kbGVyPzogc3RyaW5nO1xuICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgdGFibGU/OiBkeW5hbW9kYi5JVGFibGU7XG4gIHRhYmxlV3JpdGVzPzogYm9vbGVhbjtcbiAgdXNlclBvb2w/OiBjb2duaXRvLklVc2VyUG9vbDtcbiAgYXNzZXRCdWNrZXQ/OiBzMy5CdWNrZXQ7XG4gIGFzc2V0RG9tYWluTmFtZT86IHN0cmluZztcbiAgaW5jbHVkZVNESz86IGJvb2xlYW47XG4gIGFkZGl0aW9uYWxFbnY/OiB7XG4gICAgW2tleTogc3RyaW5nXTogc3RyaW5nO1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgTGFtYmRhRnVuY3Rpb24gZXh0ZW5kcyBXYXRjaGFibGVOb2RlanNGdW5jdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcml2YXRlIHByb3BzOiBMYW1iZGFGdW5jdGlvblByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCB7XG4gICAgICBlbnRyeTogYC4vc3JjL2xhbWJkYS8ke3Byb3BzLmZpbGV9LnRzYCxcbiAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgIGV4dGVybmFsTW9kdWxlczogcHJvcHMuaW5jbHVkZVNESyA/IFtdIDogdW5kZWZpbmVkLFxuICAgICAgICBsb2FkZXI6IHtcbiAgICAgICAgICAnLnlhbWwnOiAndGV4dCcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgU1RBR0U6IHByb3BzLnN0YWdlTmFtZSxcbiAgICAgICAgLi4ucHJvcHMudGFibGUgJiYge1xuICAgICAgICAgIFRBQkxFOiBwcm9wcy50YWJsZS50YWJsZU5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIC4uLnByb3BzLnVzZXJQb29sICYmIHtcbiAgICAgICAgICBVU0VSX1BPT0xfSUQ6IHByb3BzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIH0sXG4gICAgICAgIC4uLnByb3BzLmFzc2V0QnVja2V0ICYmIHtcbiAgICAgICAgICBBU1NFVF9CVUNLRVQ6IHByb3BzLmFzc2V0QnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIC4uLnByb3BzLmFzc2V0RG9tYWluTmFtZSAmJiB7XG4gICAgICAgICAgQVNTRVRfRE9NQUlOX05BTUU6IHByb3BzLmFzc2V0RG9tYWluTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgLi4ucHJvcHMuYWRkaXRpb25hbEVudixcbiAgICAgIH0sXG4gICAgICBoYW5kbGVyOiBwcm9wcy5oYW5kbGVyID8/ICdoYW5kbGVyJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDUpLFxuICAgICAgLy8gbG9nUmV0ZW50aW9uOiAzLFxuICAgICAgZGVzY3JpcHRpb246IHByb3BzLmRlc2NyaXB0aW9uLFxuICAgIH0pO1xuXG4gICAgaWYgKHByb3BzLnRhYmxlKSB7XG4gICAgICBpZiAocHJvcHMudGFibGVXcml0ZXMgPz8gdHJ1ZSkge1xuICAgICAgICBwcm9wcy50YWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm9wcy50YWJsZS5ncmFudFJlYWREYXRhKHRoaXMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBncmFudFNlbmRFbWFpbHMoKTogTGFtYmRhRnVuY3Rpb24ge1xuICAgIHRoaXMuZ3JhbnRQcmluY2lwYWwuYWRkVG9QcmluY2lwYWxQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnc2VzOlNlbmRUZW1wbGF0ZWRFbWFpbCcsXG4gICAgICAgICdzZXM6U2VuZEJ1bGtUZW1wbGF0ZWRFbWFpbCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWJsaWMgZ3JhbnRVcGxvYWRBc3NldHMoKTogTGFtYmRhRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5wcm9wcy5hc3NldEJ1Y2tldCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBhc3NldCBidWNrZXQgY29uZmlndXJlZCcpO1xuICAgIH1cbiAgICB0aGlzLnByb3BzLmFzc2V0QnVja2V0LmdyYW50UHV0KHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVibGljIGdyYW50RGVsZXRlQXNzZXQoKTogTGFtYmRhRnVuY3Rpb24ge1xuICAgIGlmICghdGhpcy5wcm9wcy5hc3NldEJ1Y2tldCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBhc3NldCBidWNrZXQgY29uZmlndXJlZCcpO1xuICAgIH1cbiAgICB0aGlzLnByb3BzLmFzc2V0QnVja2V0LmdyYW50RGVsZXRlKHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVibGljIGdyYW50VXNlcnBvb2xSZWFkKCk6IExhbWJkYUZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMucHJvcHMudXNlclBvb2wpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gdXNlciBwb29sIGNvbmZpZ3VyZWQnKTtcbiAgICB9XG4gICAgdGhpcy5ncmFudFByaW5jaXBhbC5hZGRUb1ByaW5jaXBhbFBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdjb2duaXRvLWlkcDpMaXN0VXNlcnMnLFxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluTGlzdEdyb3Vwc0ZvclVzZXInLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW3RoaXMucHJvcHMudXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgIH0pKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1YmxpYyBncmFudFVzZXJwb29sUmVhZFdyaXRlKCk6IExhbWJkYUZ1bmN0aW9uIHtcbiAgICBpZiAoIXRoaXMucHJvcHMudXNlclBvb2wpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gdXNlciBwb29sIGNvbmZpZ3VyZWQnKTtcbiAgICB9XG4gICAgdGhpcy5ncmFudFVzZXJwb29sUmVhZCgpO1xuICAgIHRoaXMuZ3JhbnRQcmluY2lwYWwuYWRkVG9QcmluY2lwYWxQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5VcGRhdGVVc2VyQXR0cmlidXRlcycsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkFkZFVzZXJUb0dyb3VwJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluUmVtb3ZlVXNlckZyb21Hcm91cCcsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkNyZWF0ZVVzZXInLFxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5EZWxldGVVc2VyJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFt0aGlzLnByb3BzLnVzZXJQb29sLnVzZXJQb29sQXJuXSxcbiAgICB9KSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn0iXX0=