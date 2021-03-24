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
exports.GraphQlApi = void 0;
const fs = __importStar(require("fs"));
const appsync = __importStar(require("@aws-cdk/aws-appsync"));
const cloudwatch = __importStar(require("@aws-cdk/aws-cloudwatch"));
const cdk = __importStar(require("@aws-cdk/core"));
const asset_cdn_1 = require("./asset-cdn");
const auth_1 = require("./auth");
const func_1 = require("./func");
const monitoring_1 = require("./monitoring");
const table_1 = require("./table");
class GraphQlApi extends cdk.Construct {
    constructor(scope, id, props) {
        var _a, _b;
        super(scope, id);
        this.props = props;
        this._functions = {};
        if (props.singleTableDatastore) {
            this.singleTableDatastore = new table_1.SingleTableDatastore(this, 'SingleTableDS', props.singleTableDatastore);
        }
        if (props.authentication) {
            this.authentication = new auth_1.Authentication(this, 'Authentication', props.authentication);
        }
        if (props.assetCdn) {
            this.assetCdn = new asset_cdn_1.AssetCdn(this, 'AssetCdn', props.assetCdn);
        }
        this.api = new appsync.GraphqlApi(this, 'Resource', {
            name: `${props.apiName} [${props.stageName}]`,
            logConfig: {
                fieldLogLevel: appsync.FieldLogLevel.ALL,
            },
            schema: appsync.Schema.fromAsset('schema.graphql'),
            ...this.authentication && {
                authorizationConfig: {
                    additionalAuthorizationModes: [{
                            authorizationType: appsync.AuthorizationType.USER_POOL,
                            userPoolConfig: {
                                userPool: this.authentication.userpool,
                                defaultAction: appsync.UserPoolDefaultAction.DENY,
                            },
                        }],
                },
            },
        });
        if ((_a = props.monitoring) !== null && _a !== void 0 ? _a : true) {
            this.monitoring = new monitoring_1.Monitoring(this, 'Monitoring', {
                apiName: this.props.apiName,
                stageName: this.props.stageName,
            });
            this.monitoring.apiErrorsWidget.addLeftMetric(new cloudwatch.Metric({
                namespace: 'AWS/AppSync',
                metricName: '5XXError',
                dimensions: {
                    GraphQLAPIId: this.api.apiId,
                },
                statistic: 'sum',
            }));
            this.monitoring.apiErrorsWidget.addLeftMetric(new cloudwatch.Metric({
                namespace: 'AWS/AppSync',
                metricName: '4XXError',
                dimensions: {
                    GraphQLAPIId: this.api.apiId,
                },
                statistic: 'sum',
            }));
            this.monitoring.apiLatencyWidget.addLeftMetric(new cloudwatch.Metric({
                namespace: 'AWS/AppSync',
                metricName: 'Latency',
                dimensions: {
                    GraphQLAPIId: this.api.apiId,
                },
                statistic: 'Average',
            }));
            this.monitoring.apiLatencyWidget.addLeftMetric(new cloudwatch.Metric({
                namespace: 'AWS/AppSync',
                metricName: 'Latency',
                dimensions: {
                    GraphQLAPIId: this.api.apiId,
                },
                statistic: 'p90',
            }));
            this.monitoring.apiLatencyTailWidget.addLeftMetric(new cloudwatch.Metric({
                namespace: 'AWS/AppSync',
                metricName: 'Latency',
                dimensions: {
                    GraphQLAPIId: this.api.apiId,
                },
                statistic: 'p95',
            }));
            this.monitoring.apiLatencyTailWidget.addLeftMetric(new cloudwatch.Metric({
                namespace: 'AWS/AppSync',
                metricName: 'Latency',
                dimensions: {
                    GraphQLAPIId: this.api.apiId,
                },
                statistic: 'p99',
            }));
        }
        if (this.singleTableDatastore) {
            this.tableDataSource = new appsync.DynamoDbDataSource(this, 'SingleTableSource', {
                api: this.api,
                table: (_b = this.singleTableDatastore) === null || _b === void 0 ? void 0 : _b.table,
            });
        }
    }
    /**
     * getFunctionForOperation
     */
    getFunctionForOperation(typeName, fieldName) {
        return this._functions[`${typeName}.${fieldName}`];
    }
    addLambdaResolver(typeName, fieldName) {
        var _a;
        const operationId = `${typeName}.${fieldName}`;
        const description = `Type ${typeName} Field ${fieldName} Resolver`;
        const entryFile = `./src/lambda/${operationId}.ts`;
        if (!fs.existsSync(entryFile)) {
            this.createEntryFile(entryFile, typeName, fieldName);
        }
        // TODO generate entry file if needed
        const fn = new func_1.LambdaFunction(this, `Fn${operationId}`, {
            stageName: this.props.stageName,
            additionalEnv: this.props.additionalEnv,
            entry: entryFile,
            description: `[${this.props.stageName}] ${description}`,
            ...this.authentication && {
                userPool: (_a = this.authentication) === null || _a === void 0 ? void 0 : _a.userpool,
            },
            ...this.singleTableDatastore && {
                table: this.singleTableDatastore.table,
                tableWrites: typeName === 'Mutation',
            },
            ...this.assetCdn && {
                assetDomainName: this.assetCdn.assetDomainName,
                assetBucket: this.assetCdn.assetBucket,
            },
        });
        this._functions[operationId] = fn;
        cdk.Tags.of(fn).add('OpenAPI', description);
        if (this.monitoring) {
            this.monitoring.lambdaDurationsWidget.addLeftMetric(fn.metricDuration());
            this.monitoring.lambdaInvokesWidget.addLeftMetric(fn.metricInvocations());
            this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricErrors());
            this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricThrottles());
        }
        const dataSource = new appsync.LambdaDataSource(this, `LambdaDS${operationId}`, {
            api: this.api,
            name: `Lambda_${typeName}_${fieldName}`,
            lambdaFunction: fn,
        });
        new appsync.Resolver(this, `Resolver${operationId}`, {
            api: this.api,
            typeName,
            fieldName: fieldName,
            dataSource,
        });
        return fn;
    }
    addDynamoDbVtlResolver(typeName, fieldName) {
        const operationId = `${typeName}.${fieldName}`;
        const mappingReqFile = `./src/vtl/${operationId}.req.vm`;
        if (!fs.existsSync(mappingReqFile)) {
            fs.writeFileSync(mappingReqFile, '## Request mapping', { encoding: 'utf-8' });
        }
        const mappingResFile = `./src/vtl/${operationId}.res.vm`;
        if (!fs.existsSync(mappingResFile)) {
            fs.writeFileSync(mappingResFile, '$util.toJson($ctx.result)', { encoding: 'utf-8' });
        }
        new appsync.Resolver(this, `Resolver${operationId}`, {
            api: this.api,
            typeName,
            fieldName: fieldName,
            dataSource: this.tableDataSource,
            requestMappingTemplate: appsync.MappingTemplate.fromFile(mappingReqFile),
            responseMappingTemplate: appsync.MappingTemplate.fromFile(mappingResFile),
        });
    }
    createEntryFile(entryFile, typeName, fieldName) {
        fs.writeFileSync(entryFile, `import { http } from '@taimos/lambda-toolbox';

// TODO: Replace QUERYTYPE with the input type of the field ${typeName}.${fieldName}
// TODO: Replace RETURNTYPE with the return type of the field ${typeName}.${fieldName}

export const handler = http.createAppSyncHandler<QUERYTYPE, RETURNTYPE>(async (ctx) => {
  console.log(ctx.event);
  throw new Error('Not yet implemented');
});`, {
            encoding: 'utf-8',
        });
    }
}
exports.GraphQlApi = GraphQlApi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhxbC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29uc3RydWN0cy9ncmFwaHFsLWFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsdUNBQXlCO0FBQ3pCLDhEQUFnRDtBQUNoRCxvRUFBc0Q7QUFFdEQsbURBQXFDO0FBQ3JDLDJDQUFzRDtBQUN0RCxpQ0FBNkQ7QUFDN0QsaUNBQXdDO0FBQ3hDLDZDQUEwQztBQUMxQyxtQ0FBMEU7QUFpQjFFLE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxTQUFTO0lBWTNDLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQVUsS0FBc0I7O1FBQzFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFEbUMsVUFBSyxHQUFMLEtBQUssQ0FBaUI7UUFGcEUsZUFBVSxHQUE4QyxFQUFFLENBQUM7UUFLakUsSUFBSSxLQUFLLENBQUMsb0JBQW9CLEVBQUU7WUFDOUIsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksNEJBQW9CLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUN6RztRQUNELElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRTtZQUN4QixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUkscUJBQWMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQ3hGO1FBQ0QsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO1lBQ2xCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxvQkFBUSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ2hFO1FBRUQsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNsRCxJQUFJLEVBQUUs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QUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFdBQVcsV0FBVyxFQUFFLEVBQUU7WUFDbkQsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHO1lBQ2IsUUFBUTtZQUNSLFNBQVMsRUFBRSxTQUFtQjtZQUM5QixVQUFVLEVBQUUsSUFBSSxDQUFDLGVBQWU7WUFDaEMsc0JBQXNCLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDO1lBQ3hFLHVCQUF1QixFQUFFLE9BQU8sQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQztTQUMxRSxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sZUFBZSxDQUFDLFNBQWlCLEVBQUUsUUFBZ0IsRUFBRSxTQUFpQjtRQUM1RSxFQUFFLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRTs7OERBRThCLFFBQVEsSUFBSSxTQUFTO2dFQUNuQixRQUFRLElBQUksU0FBUzs7Ozs7SUFLakYsRUFBRTtZQUNBLFFBQVEsRUFBRSxPQUFPO1NBQ2xCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTFNRCxnQ0EwTUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBhcHBzeW5jIGZyb20gJ0Bhd3MtY2RrL2F3cy1hcHBzeW5jJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnQGF3cy1jZGsvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgbGFtYmRhTm9kZWpzIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEtbm9kZWpzJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCB7IEFzc2V0Q2RuLCBBc3NldENkblByb3BzIH0gZnJvbSAnLi9hc3NldC1jZG4nO1xuaW1wb3J0IHsgQXV0aGVudGljYXRpb24sIEF1dGhlbnRpY2F0aW9uUHJvcHMgfSBmcm9tICcuL2F1dGgnO1xuaW1wb3J0IHsgTGFtYmRhRnVuY3Rpb24gfSBmcm9tICcuL2Z1bmMnO1xuaW1wb3J0IHsgTW9uaXRvcmluZyB9IGZyb20gJy4vbW9uaXRvcmluZyc7XG5pbXBvcnQgeyBTaW5nbGVUYWJsZURhdGFzdG9yZSwgU2luZ2xlVGFibGVEYXRhc3RvcmVQcm9wcyB9IGZyb20gJy4vdGFibGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdyYXBoUWxBcGlQcm9wcyB7XG4gIGFwaU5hbWU6IHN0cmluZztcbiAgc3RhZ2VOYW1lOiBzdHJpbmc7XG5cbiAgbW9uaXRvcmluZz86IGJvb2xlYW47XG4gIHNpbmdsZVRhYmxlRGF0YXN0b3JlPzogU2luZ2xlVGFibGVEYXRhc3RvcmVQcm9wcztcbiAgYXV0aGVudGljYXRpb24/OiBBdXRoZW50aWNhdGlvblByb3BzO1xuICBhc3NldENkbj86IEFzc2V0Q2RuUHJvcHM7XG5cbiAgYWRkaXRpb25hbEVudj86IHtcbiAgICBba2V5OiBzdHJpbmddOiBzdHJpbmc7XG4gIH07XG5cbn1cblxuZXhwb3J0IGNsYXNzIEdyYXBoUWxBcGkgZXh0ZW5kcyBjZGsuQ29uc3RydWN0IHtcblxuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcHBzeW5jLkdyYXBocWxBcGk7XG5cbiAgcHVibGljIHJlYWRvbmx5IHNpbmdsZVRhYmxlRGF0YXN0b3JlPzogU2luZ2xlVGFibGVEYXRhc3RvcmU7XG4gIHB1YmxpYyByZWFkb25seSBhdXRoZW50aWNhdGlvbj86IEF1dGhlbnRpY2F0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYXNzZXRDZG4/OiBBc3NldENkbjtcbiAgcHVibGljIHJlYWRvbmx5IHRhYmxlRGF0YVNvdXJjZT86IGFwcHN5bmMuRHluYW1vRGJEYXRhU291cmNlO1xuICBwdWJsaWMgcmVhZG9ubHkgbW9uaXRvcmluZz86IE1vbml0b3Jpbmc7XG5cbiAgcHJpdmF0ZSBfZnVuY3Rpb25zOiB7IFtvcGVyYXRpb25JZDogc3RyaW5nXTogTGFtYmRhRnVuY3Rpb24gfSA9IHt9O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcml2YXRlIHByb3BzOiBHcmFwaFFsQXBpUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgaWYgKHByb3BzLnNpbmdsZVRhYmxlRGF0YXN0b3JlKSB7XG4gICAgICB0aGlzLnNpbmdsZVRhYmxlRGF0YXN0b3JlID0gbmV3IFNpbmdsZVRhYmxlRGF0YXN0b3JlKHRoaXMsICdTaW5nbGVUYWJsZURTJywgcHJvcHMuc2luZ2xlVGFibGVEYXRhc3RvcmUpO1xuICAgIH1cbiAgICBpZiAocHJvcHMuYXV0aGVudGljYXRpb24pIHtcbiAgICAgIHRoaXMuYXV0aGVudGljYXRpb24gPSBuZXcgQXV0aGVudGljYXRpb24odGhpcywgJ0F1dGhlbnRpY2F0aW9uJywgcHJvcHMuYXV0aGVudGljYXRpb24pO1xuICAgIH1cbiAgICBpZiAocHJvcHMuYXNzZXRDZG4pIHtcbiAgICAgIHRoaXMuYXNzZXRDZG4gPSBuZXcgQXNzZXRDZG4odGhpcywgJ0Fzc2V0Q2RuJywgcHJvcHMuYXNzZXRDZG4pO1xuICAgIH1cblxuICAgIHRoaXMuYXBpID0gbmV3IGFwcHN5bmMuR3JhcGhxbEFwaSh0aGlzLCAnUmVzb3VyY2UnLCB7XG4gICAgICBuYW1lOiBgJHtwcm9wcy5hcGlOYW1lfSBbJHtwcm9wcy5zdGFnZU5hbWV9XWAsXG4gICAgICBsb2dDb25maWc6IHtcbiAgICAgICAgZmllbGRMb2dMZXZlbDogYXBwc3luYy5GaWVsZExvZ0xldmVsLkFMTCxcbiAgICAgIH0sXG4gICAgICBzY2hlbWE6IGFwcHN5bmMuU2NoZW1hLmZyb21Bc3NldCgnc2NoZW1hLmdyYXBocWwnKSxcbiAgICAgIC4uLnRoaXMuYXV0aGVudGljYXRpb24gJiYge1xuICAgICAgICBhdXRob3JpemF0aW9uQ29uZmlnOiB7XG4gICAgICAgICAgYWRkaXRpb25hbEF1dGhvcml6YXRpb25Nb2RlczogW3tcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcHBzeW5jLkF1dGhvcml6YXRpb25UeXBlLlVTRVJfUE9PTCxcbiAgICAgICAgICAgIHVzZXJQb29sQ29uZmlnOiB7XG4gICAgICAgICAgICAgIHVzZXJQb29sOiB0aGlzLmF1dGhlbnRpY2F0aW9uLnVzZXJwb29sLFxuICAgICAgICAgICAgICBkZWZhdWx0QWN0aW9uOiBhcHBzeW5jLlVzZXJQb29sRGVmYXVsdEFjdGlvbi5ERU5ZLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9XSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAocHJvcHMubW9uaXRvcmluZyA/PyB0cnVlKSB7XG4gICAgICB0aGlzLm1vbml0b3JpbmcgPSBuZXcgTW9uaXRvcmluZyh0aGlzLCAnTW9uaXRvcmluZycsIHtcbiAgICAgICAgYXBpTmFtZTogdGhpcy5wcm9wcy5hcGlOYW1lLFxuICAgICAgICBzdGFnZU5hbWU6IHRoaXMucHJvcHMuc3RhZ2VOYW1lLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlFcnJvcnNXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICc1WFhFcnJvcicsXG4gICAgICAgIGRpbWVuc2lvbnM6IHtcbiAgICAgICAgICBHcmFwaFFMQVBJSWQ6IHRoaXMuYXBpLmFwaUlkLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdzdW0nLFxuICAgICAgfSkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUVycm9yc1dpZGdldC5hZGRMZWZ0TWV0cmljKG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJzRYWEVycm9yJyxcbiAgICAgICAgZGltZW5zaW9uczoge1xuICAgICAgICAgIEdyYXBoUUxBUElJZDogdGhpcy5hcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ3N1bScsXG4gICAgICB9KSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpTGF0ZW5jeVdpZGdldC5hZGRMZWZ0TWV0cmljKG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgR3JhcGhRTEFQSUlkOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICB9KSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpTGF0ZW5jeVdpZGdldC5hZGRMZWZ0TWV0cmljKG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgR3JhcGhRTEFQSUlkOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAncDkwJyxcbiAgICAgIH0pKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlMYXRlbmN5VGFpbFdpZGdldC5hZGRMZWZ0TWV0cmljKG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgR3JhcGhRTEFQSUlkOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAncDk1JyxcbiAgICAgIH0pKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlMYXRlbmN5VGFpbFdpZGdldC5hZGRMZWZ0TWV0cmljKG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgR3JhcGhRTEFQSUlkOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAncDk5JyxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZSkge1xuICAgICAgdGhpcy50YWJsZURhdGFTb3VyY2UgPSBuZXcgYXBwc3luYy5EeW5hbW9EYkRhdGFTb3VyY2UodGhpcywgJ1NpbmdsZVRhYmxlU291cmNlJywge1xuICAgICAgICBhcGk6IHRoaXMuYXBpLFxuICAgICAgICB0YWJsZTogdGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZT8udGFibGUsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogZ2V0RnVuY3Rpb25Gb3JPcGVyYXRpb25cbiAgICovXG4gIHB1YmxpYyBnZXRGdW5jdGlvbkZvck9wZXJhdGlvbjxUWVBFIGV4dGVuZHMgeyBfX3R5cGVuYW1lPzogYW55IH0+KHR5cGVOYW1lOiBUWVBFWydfX3R5cGVuYW1lJ10sIGZpZWxkTmFtZToga2V5b2YgT21pdDxUWVBFLCAnX190eXBlbmFtZSc+KTogTGFtYmRhRnVuY3Rpb24ge1xuICAgIHJldHVybiB0aGlzLl9mdW5jdGlvbnNbYCR7dHlwZU5hbWV9LiR7ZmllbGROYW1lfWBdO1xuICB9XG5cbiAgcHVibGljIGFkZExhbWJkYVJlc29sdmVyPFRZUEUgZXh0ZW5kcyB7IF9fdHlwZW5hbWU/OiBhbnkgfT4odHlwZU5hbWU6IFRZUEVbJ19fdHlwZW5hbWUnXSwgZmllbGROYW1lOiBrZXlvZiBPbWl0PFRZUEUsICdfX3R5cGVuYW1lJz4pOiBsYW1iZGFOb2RlanMuTm9kZWpzRnVuY3Rpb24ge1xuICAgIGNvbnN0IG9wZXJhdGlvbklkID0gYCR7dHlwZU5hbWV9LiR7ZmllbGROYW1lfWA7XG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBgVHlwZSAke3R5cGVOYW1lfSBGaWVsZCAke2ZpZWxkTmFtZX0gUmVzb2x2ZXJgO1xuXG4gICAgY29uc3QgZW50cnlGaWxlID0gYC4vc3JjL2xhbWJkYS8ke29wZXJhdGlvbklkfS50c2A7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGVudHJ5RmlsZSkpIHtcbiAgICAgIHRoaXMuY3JlYXRlRW50cnlGaWxlKGVudHJ5RmlsZSwgdHlwZU5hbWUsIGZpZWxkTmFtZSBhcyBzdHJpbmcpO1xuICAgIH1cbiAgICAvLyBUT0RPIGdlbmVyYXRlIGVudHJ5IGZpbGUgaWYgbmVlZGVkXG5cbiAgICBjb25zdCBmbiA9IG5ldyBMYW1iZGFGdW5jdGlvbih0aGlzLCBgRm4ke29wZXJhdGlvbklkfWAsIHtcbiAgICAgIHN0YWdlTmFtZTogdGhpcy5wcm9wcy5zdGFnZU5hbWUsXG4gICAgICBhZGRpdGlvbmFsRW52OiB0aGlzLnByb3BzLmFkZGl0aW9uYWxFbnYsXG4gICAgICBlbnRyeTogZW50cnlGaWxlLFxuICAgICAgZGVzY3JpcHRpb246IGBbJHt0aGlzLnByb3BzLnN0YWdlTmFtZX1dICR7ZGVzY3JpcHRpb259YCxcbiAgICAgIC4uLnRoaXMuYXV0aGVudGljYXRpb24gJiYge1xuICAgICAgICB1c2VyUG9vbDogdGhpcy5hdXRoZW50aWNhdGlvbj8udXNlcnBvb2wsXG4gICAgICB9LFxuICAgICAgLi4udGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZSAmJiB7XG4gICAgICAgIHRhYmxlOiB0aGlzLnNpbmdsZVRhYmxlRGF0YXN0b3JlLnRhYmxlLFxuICAgICAgICB0YWJsZVdyaXRlczogdHlwZU5hbWUgPT09ICdNdXRhdGlvbicsXG4gICAgICB9LFxuICAgICAgLi4udGhpcy5hc3NldENkbiAmJiB7XG4gICAgICAgIGFzc2V0RG9tYWluTmFtZTogdGhpcy5hc3NldENkbi5hc3NldERvbWFpbk5hbWUsXG4gICAgICAgIGFzc2V0QnVja2V0OiB0aGlzLmFzc2V0Q2RuLmFzc2V0QnVja2V0LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICB0aGlzLl9mdW5jdGlvbnNbb3BlcmF0aW9uSWRdID0gZm47XG4gICAgY2RrLlRhZ3Mub2YoZm4pLmFkZCgnT3BlbkFQSScsIGRlc2NyaXB0aW9uKTtcblxuICAgIGlmICh0aGlzLm1vbml0b3JpbmcpIHtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5sYW1iZGFEdXJhdGlvbnNXaWRnZXQuYWRkTGVmdE1ldHJpYyhmbi5tZXRyaWNEdXJhdGlvbigpKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5sYW1iZGFJbnZva2VzV2lkZ2V0LmFkZExlZnRNZXRyaWMoZm4ubWV0cmljSW52b2NhdGlvbnMoKSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcubGFtYmRhRXJyb3JzV2lkZ2V0LmFkZExlZnRNZXRyaWMoZm4ubWV0cmljRXJyb3JzKCkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmxhbWJkYUVycm9yc1dpZGdldC5hZGRMZWZ0TWV0cmljKGZuLm1ldHJpY1Rocm90dGxlcygpKTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXRhU291cmNlID0gbmV3IGFwcHN5bmMuTGFtYmRhRGF0YVNvdXJjZSh0aGlzLCBgTGFtYmRhRFMke29wZXJhdGlvbklkfWAsIHtcbiAgICAgIGFwaTogdGhpcy5hcGksXG4gICAgICBuYW1lOiBgTGFtYmRhXyR7dHlwZU5hbWV9XyR7ZmllbGROYW1lfWAsXG4gICAgICBsYW1iZGFGdW5jdGlvbjogZm4sXG4gICAgfSk7XG5cbiAgICBuZXcgYXBwc3luYy5SZXNvbHZlcih0aGlzLCBgUmVzb2x2ZXIke29wZXJhdGlvbklkfWAsIHtcbiAgICAgIGFwaTogdGhpcy5hcGksXG4gICAgICB0eXBlTmFtZSxcbiAgICAgIGZpZWxkTmFtZTogZmllbGROYW1lIGFzIHN0cmluZyxcbiAgICAgIGRhdGFTb3VyY2UsXG4gICAgfSk7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgcHVibGljIGFkZER5bmFtb0RiVnRsUmVzb2x2ZXI8VFlQRSBleHRlbmRzIHsgX190eXBlbmFtZT86IGFueSB9Pih0eXBlTmFtZTogVFlQRVsnX190eXBlbmFtZSddLCBmaWVsZE5hbWU6IGtleW9mIE9taXQ8VFlQRSwgJ19fdHlwZW5hbWUnPik6IHZvaWQge1xuICAgIGNvbnN0IG9wZXJhdGlvbklkID0gYCR7dHlwZU5hbWV9LiR7ZmllbGROYW1lfWA7XG5cbiAgICBjb25zdCBtYXBwaW5nUmVxRmlsZSA9IGAuL3NyYy92dGwvJHtvcGVyYXRpb25JZH0ucmVxLnZtYDtcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMobWFwcGluZ1JlcUZpbGUpKSB7XG4gICAgICBmcy53cml0ZUZpbGVTeW5jKG1hcHBpbmdSZXFGaWxlLCAnIyMgUmVxdWVzdCBtYXBwaW5nJywgeyBlbmNvZGluZzogJ3V0Zi04JyB9KTtcbiAgICB9XG4gICAgY29uc3QgbWFwcGluZ1Jlc0ZpbGUgPSBgLi9zcmMvdnRsLyR7b3BlcmF0aW9uSWR9LnJlcy52bWA7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKG1hcHBpbmdSZXNGaWxlKSkge1xuICAgICAgZnMud3JpdGVGaWxlU3luYyhtYXBwaW5nUmVzRmlsZSwgJyR1dGlsLnRvSnNvbigkY3R4LnJlc3VsdCknLCB7IGVuY29kaW5nOiAndXRmLTgnIH0pO1xuICAgIH1cblxuICAgIG5ldyBhcHBzeW5jLlJlc29sdmVyKHRoaXMsIGBSZXNvbHZlciR7b3BlcmF0aW9uSWR9YCwge1xuICAgICAgYXBpOiB0aGlzLmFwaSxcbiAgICAgIHR5cGVOYW1lLFxuICAgICAgZmllbGROYW1lOiBmaWVsZE5hbWUgYXMgc3RyaW5nLFxuICAgICAgZGF0YVNvdXJjZTogdGhpcy50YWJsZURhdGFTb3VyY2UsXG4gICAgICByZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiBhcHBzeW5jLk1hcHBpbmdUZW1wbGF0ZS5mcm9tRmlsZShtYXBwaW5nUmVxRmlsZSksXG4gICAgICByZXNwb25zZU1hcHBpbmdUZW1wbGF0ZTogYXBwc3luYy5NYXBwaW5nVGVtcGxhdGUuZnJvbUZpbGUobWFwcGluZ1Jlc0ZpbGUpLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVFbnRyeUZpbGUoZW50cnlGaWxlOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIGZpZWxkTmFtZTogc3RyaW5nKSB7XG4gICAgZnMud3JpdGVGaWxlU3luYyhlbnRyeUZpbGUsIGBpbXBvcnQgeyBodHRwIH0gZnJvbSAnQHRhaW1vcy9sYW1iZGEtdG9vbGJveCc7XG5cbi8vIFRPRE86IFJlcGxhY2UgUVVFUllUWVBFIHdpdGggdGhlIGlucHV0IHR5cGUgb2YgdGhlIGZpZWxkICR7dHlwZU5hbWV9LiR7ZmllbGROYW1lfVxuLy8gVE9ETzogUmVwbGFjZSBSRVRVUk5UWVBFIHdpdGggdGhlIHJldHVybiB0eXBlIG9mIHRoZSBmaWVsZCAke3R5cGVOYW1lfS4ke2ZpZWxkTmFtZX1cblxuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBodHRwLmNyZWF0ZUFwcFN5bmNIYW5kbGVyPFFVRVJZVFlQRSwgUkVUVVJOVFlQRT4oYXN5bmMgKGN0eCkgPT4ge1xuICBjb25zb2xlLmxvZyhjdHguZXZlbnQpO1xuICB0aHJvdyBuZXcgRXJyb3IoJ05vdCB5ZXQgaW1wbGVtZW50ZWQnKTtcbn0pO2AsIHtcbiAgICAgIGVuY29kaW5nOiAndXRmLTgnLFxuICAgIH0pO1xuICB9XG59Il19