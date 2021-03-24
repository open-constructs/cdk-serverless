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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhxbC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29uc3RydWN0cy9ncmFwaHFsLWFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsdUNBQXlCO0FBQ3pCLDhEQUFnRDtBQUNoRCxvRUFBc0Q7QUFFdEQsbURBQXFDO0FBQ3JDLDJDQUFzRDtBQUN0RCxpQ0FBNkQ7QUFDN0QsaUNBQXdDO0FBQ3hDLDZDQUEwQztBQUMxQyxtQ0FBMEU7QUFpQjFFLE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxTQUFTO0lBWTNDLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQVUsS0FBc0I7O1FBQzFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFEbUMsVUFBSyxHQUFMLEtBQUssQ0FBaUI7UUFGcEUsZUFBVSxHQUE4QyxFQUFFLENBQUM7UUFLakUsSUFBSSxLQUFLLENBQUMsb0JBQW9CLEVBQUU7WUFDOUIsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksNEJBQW9CLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUN6RztRQUNELElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRTtZQUN4QixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUkscUJBQWMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQ3hGO1FBQ0QsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO1lBQ2xCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxvQkFBUSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ2hFO1FBRUQsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNsRCxJQUFJLEVBQUUs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QVcsRUFBRSxFQUFFO1lBQ25ELEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRztZQUNiLFFBQVE7WUFDUixTQUFTLEVBQUUsU0FBbUI7WUFDOUIsVUFBVSxFQUFFLElBQUksQ0FBQyxlQUFlO1lBQ2hDLHNCQUFzQixFQUFFLE9BQU8sQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQztZQUN4RSx1QkFBdUIsRUFBRSxPQUFPLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUM7U0FDMUUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLGVBQWUsQ0FBQyxTQUFpQixFQUFFLFFBQWdCLEVBQUUsU0FBaUI7UUFDNUUsRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUU7OzhEQUU4QixRQUFRLElBQUksU0FBUztnRUFDbkIsUUFBUSxJQUFJLFNBQVM7Ozs7O0lBS2pGLEVBQUU7WUFDQSxRQUFRLEVBQUUsT0FBTztTQUNsQixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF6TUQsZ0NBeU1DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgYXBwc3luYyBmcm9tICdAYXdzLWNkay9hd3MtYXBwc3luYyc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ0Bhd3MtY2RrL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGxhbWJkYU5vZGVqcyBmcm9tICdAYXdzLWNkay9hd3MtbGFtYmRhLW5vZGVqcyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgeyBBc3NldENkbiwgQXNzZXRDZG5Qcm9wcyB9IGZyb20gJy4vYXNzZXQtY2RuJztcbmltcG9ydCB7IEF1dGhlbnRpY2F0aW9uLCBBdXRoZW50aWNhdGlvblByb3BzIH0gZnJvbSAnLi9hdXRoJztcbmltcG9ydCB7IExhbWJkYUZ1bmN0aW9uIH0gZnJvbSAnLi9mdW5jJztcbmltcG9ydCB7IE1vbml0b3JpbmcgfSBmcm9tICcuL21vbml0b3JpbmcnO1xuaW1wb3J0IHsgU2luZ2xlVGFibGVEYXRhc3RvcmUsIFNpbmdsZVRhYmxlRGF0YXN0b3JlUHJvcHMgfSBmcm9tICcuL3RhYmxlJztcblxuZXhwb3J0IGludGVyZmFjZSBHcmFwaFFsQXBpUHJvcHMge1xuICBhcGlOYW1lOiBzdHJpbmc7XG4gIHN0YWdlTmFtZTogc3RyaW5nO1xuXG4gIG1vbml0b3Jpbmc/OiBib29sZWFuO1xuICBzaW5nbGVUYWJsZURhdGFzdG9yZT86IFNpbmdsZVRhYmxlRGF0YXN0b3JlUHJvcHM7XG4gIGF1dGhlbnRpY2F0aW9uPzogQXV0aGVudGljYXRpb25Qcm9wcztcbiAgYXNzZXRDZG4/OiBBc3NldENkblByb3BzO1xuXG4gIGFkZGl0aW9uYWxFbnY/OiB7XG4gICAgW2tleTogc3RyaW5nXTogc3RyaW5nO1xuICB9O1xuXG59XG5cbmV4cG9ydCBjbGFzcyBHcmFwaFFsQXBpIGV4dGVuZHMgY2RrLkNvbnN0cnVjdCB7XG5cbiAgcHVibGljIHJlYWRvbmx5IGFwaTogYXBwc3luYy5HcmFwaHFsQXBpO1xuXG4gIHB1YmxpYyByZWFkb25seSBzaW5nbGVUYWJsZURhdGFzdG9yZT86IFNpbmdsZVRhYmxlRGF0YXN0b3JlO1xuICBwdWJsaWMgcmVhZG9ubHkgYXV0aGVudGljYXRpb24/OiBBdXRoZW50aWNhdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFzc2V0Q2RuPzogQXNzZXRDZG47XG4gIHB1YmxpYyByZWFkb25seSB0YWJsZURhdGFTb3VyY2U/OiBhcHBzeW5jLkR5bmFtb0RiRGF0YVNvdXJjZTtcbiAgcHVibGljIHJlYWRvbmx5IG1vbml0b3Jpbmc/OiBNb25pdG9yaW5nO1xuXG4gIHByaXZhdGUgX2Z1bmN0aW9uczogeyBbb3BlcmF0aW9uSWQ6IHN0cmluZ106IExhbWJkYUZ1bmN0aW9uIH0gPSB7fTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJpdmF0ZSBwcm9wczogR3JhcGhRbEFwaVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGlmIChwcm9wcy5zaW5nbGVUYWJsZURhdGFzdG9yZSkge1xuICAgICAgdGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZSA9IG5ldyBTaW5nbGVUYWJsZURhdGFzdG9yZSh0aGlzLCAnU2luZ2xlVGFibGVEUycsIHByb3BzLnNpbmdsZVRhYmxlRGF0YXN0b3JlKTtcbiAgICB9XG4gICAgaWYgKHByb3BzLmF1dGhlbnRpY2F0aW9uKSB7XG4gICAgICB0aGlzLmF1dGhlbnRpY2F0aW9uID0gbmV3IEF1dGhlbnRpY2F0aW9uKHRoaXMsICdBdXRoZW50aWNhdGlvbicsIHByb3BzLmF1dGhlbnRpY2F0aW9uKTtcbiAgICB9XG4gICAgaWYgKHByb3BzLmFzc2V0Q2RuKSB7XG4gICAgICB0aGlzLmFzc2V0Q2RuID0gbmV3IEFzc2V0Q2RuKHRoaXMsICdBc3NldENkbicsIHByb3BzLmFzc2V0Q2RuKTtcbiAgICB9XG5cbiAgICB0aGlzLmFwaSA9IG5ldyBhcHBzeW5jLkdyYXBocWxBcGkodGhpcywgJ1Jlc291cmNlJywge1xuICAgICAgbmFtZTogYCR7cHJvcHMuYXBpTmFtZX0gWyR7cHJvcHMuc3RhZ2VOYW1lfV1gLFxuICAgICAgbG9nQ29uZmlnOiB7XG4gICAgICAgIGZpZWxkTG9nTGV2ZWw6IGFwcHN5bmMuRmllbGRMb2dMZXZlbC5BTEwsXG4gICAgICB9LFxuICAgICAgc2NoZW1hOiBhcHBzeW5jLlNjaGVtYS5mcm9tQXNzZXQoJ3NjaGVtYS5ncmFwaHFsJyksXG4gICAgICAuLi50aGlzLmF1dGhlbnRpY2F0aW9uICYmIHtcbiAgICAgICAgYXV0aG9yaXphdGlvbkNvbmZpZzoge1xuICAgICAgICAgIGFkZGl0aW9uYWxBdXRob3JpemF0aW9uTW9kZXM6IFt7XG4gICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBwc3luYy5BdXRob3JpemF0aW9uVHlwZS5VU0VSX1BPT0wsXG4gICAgICAgICAgICB1c2VyUG9vbENvbmZpZzoge1xuICAgICAgICAgICAgICB1c2VyUG9vbDogdGhpcy5hdXRoZW50aWNhdGlvbi51c2VycG9vbCxcbiAgICAgICAgICAgICAgZGVmYXVsdEFjdGlvbjogYXBwc3luYy5Vc2VyUG9vbERlZmF1bHRBY3Rpb24uREVOWSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfV0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHByb3BzLm1vbml0b3JpbmcgPz8gdHJ1ZSkge1xuICAgICAgdGhpcy5tb25pdG9yaW5nID0gbmV3IE1vbml0b3JpbmcodGhpcywgJ01vbml0b3JpbmcnLCB7XG4gICAgICAgIGFwaU5hbWU6IHRoaXMucHJvcHMuYXBpTmFtZSxcbiAgICAgICAgc3RhZ2VOYW1lOiB0aGlzLnByb3BzLnN0YWdlTmFtZSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpRXJyb3JzV2lkZ2V0LmFkZExlZnRNZXRyaWMobmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwcFN5bmMnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnNVhYRXJyb3InLFxuICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgR3JhcGhRTEFQSUlkOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnc3VtJyxcbiAgICAgIH0pKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlFcnJvcnNXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICc0WFhFcnJvcicsXG4gICAgICAgIGRpbWVuc2lvbnM6IHtcbiAgICAgICAgICBHcmFwaFFMQVBJSWQ6IHRoaXMuYXBpLmFwaUlkLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdzdW0nLFxuICAgICAgfSkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUxhdGVuY3lXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgICAgZGltZW5zaW9uczoge1xuICAgICAgICAgIEdyYXBoUUxBUElJZDogdGhpcy5hcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgfSkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUxhdGVuY3lXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgICAgZGltZW5zaW9uczoge1xuICAgICAgICAgIEdyYXBoUUxBUElJZDogdGhpcy5hcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ3A5MCcsXG4gICAgICB9KSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpTGF0ZW5jeVRhaWxXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgICAgZGltZW5zaW9uczoge1xuICAgICAgICAgIEdyYXBoUUxBUElJZDogdGhpcy5hcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ3A5NScsXG4gICAgICB9KSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpTGF0ZW5jeVRhaWxXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgICAgZGltZW5zaW9uczoge1xuICAgICAgICAgIEdyYXBoUUxBUElJZDogdGhpcy5hcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ3A5OScsXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc2luZ2xlVGFibGVEYXRhc3RvcmUpIHtcbiAgICAgIHRoaXMudGFibGVEYXRhU291cmNlID0gbmV3IGFwcHN5bmMuRHluYW1vRGJEYXRhU291cmNlKHRoaXMsICdTaW5nbGVUYWJsZVNvdXJjZScsIHtcbiAgICAgICAgYXBpOiB0aGlzLmFwaSxcbiAgICAgICAgdGFibGU6IHRoaXMuc2luZ2xlVGFibGVEYXRhc3RvcmU/LnRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIGdldEZ1bmN0aW9uRm9yT3BlcmF0aW9uXG4gICAqL1xuICBwdWJsaWMgZ2V0RnVuY3Rpb25Gb3JPcGVyYXRpb248VFlQRSBleHRlbmRzIHsgX190eXBlbmFtZT86IGFueSB9Pih0eXBlTmFtZTogVFlQRVsnX190eXBlbmFtZSddLCBmaWVsZE5hbWU6IGtleW9mIE9taXQ8VFlQRSwgJ19fdHlwZW5hbWUnPik6IExhbWJkYUZ1bmN0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5fZnVuY3Rpb25zW2Ake3R5cGVOYW1lfS4ke2ZpZWxkTmFtZX1gXTtcbiAgfVxuXG4gIHB1YmxpYyBhZGRMYW1iZGFSZXNvbHZlcjxUWVBFIGV4dGVuZHMgeyBfX3R5cGVuYW1lPzogYW55IH0+KHR5cGVOYW1lOiBUWVBFWydfX3R5cGVuYW1lJ10sIGZpZWxkTmFtZToga2V5b2YgT21pdDxUWVBFLCAnX190eXBlbmFtZSc+KTogbGFtYmRhTm9kZWpzLk5vZGVqc0Z1bmN0aW9uIHtcbiAgICBjb25zdCBvcGVyYXRpb25JZCA9IGAke3R5cGVOYW1lfS4ke2ZpZWxkTmFtZX1gO1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gYFR5cGUgJHt0eXBlTmFtZX0gRmllbGQgJHtmaWVsZE5hbWV9IFJlc29sdmVyYDtcblxuICAgIGNvbnN0IGVudHJ5RmlsZSA9IGAuL3NyYy9sYW1iZGEvJHtvcGVyYXRpb25JZH0udHNgO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhlbnRyeUZpbGUpKSB7XG4gICAgICB0aGlzLmNyZWF0ZUVudHJ5RmlsZShlbnRyeUZpbGUsIHR5cGVOYW1lLCBmaWVsZE5hbWUgYXMgc3RyaW5nKTtcbiAgICB9XG4gICAgLy8gVE9ETyBnZW5lcmF0ZSBlbnRyeSBmaWxlIGlmIG5lZWRlZFxuXG4gICAgY29uc3QgZm4gPSBuZXcgTGFtYmRhRnVuY3Rpb24odGhpcywgYEZuJHtvcGVyYXRpb25JZH1gLCB7XG4gICAgICBzdGFnZU5hbWU6IHRoaXMucHJvcHMuc3RhZ2VOYW1lLFxuICAgICAgYWRkaXRpb25hbEVudjogdGhpcy5wcm9wcy5hZGRpdGlvbmFsRW52LFxuICAgICAgZW50cnk6IGVudHJ5RmlsZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgWyR7dGhpcy5wcm9wcy5zdGFnZU5hbWV9XSAke2Rlc2NyaXB0aW9ufWAsXG4gICAgICAuLi50aGlzLmF1dGhlbnRpY2F0aW9uICYmIHtcbiAgICAgICAgdXNlclBvb2w6IHRoaXMuYXV0aGVudGljYXRpb24/LnVzZXJwb29sLFxuICAgICAgfSxcbiAgICAgIC4uLnRoaXMuc2luZ2xlVGFibGVEYXRhc3RvcmUgJiYge1xuICAgICAgICB0YWJsZTogdGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZS50YWJsZSxcbiAgICAgICAgdGFibGVXcml0ZXM6IHR5cGVOYW1lID09PSAnTXV0YXRpb24nLFxuICAgICAgfSxcbiAgICAgIC4uLnRoaXMuYXNzZXRDZG4gJiYge1xuICAgICAgICBhc3NldERvbWFpbk5hbWU6IHRoaXMuYXNzZXRDZG4uYXNzZXREb21haW5OYW1lLFxuICAgICAgICBhc3NldEJ1Y2tldDogdGhpcy5hc3NldENkbi5hc3NldEJ1Y2tldCxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5fZnVuY3Rpb25zW29wZXJhdGlvbklkXSA9IGZuO1xuICAgIGNkay5UYWdzLm9mKGZuKS5hZGQoJ09wZW5BUEknLCBkZXNjcmlwdGlvbik7XG5cbiAgICBpZiAodGhpcy5tb25pdG9yaW5nKSB7XG4gICAgICB0aGlzLm1vbml0b3JpbmcubGFtYmRhRHVyYXRpb25zV2lkZ2V0LmFkZExlZnRNZXRyaWMoZm4ubWV0cmljRHVyYXRpb24oKSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcubGFtYmRhSW52b2tlc1dpZGdldC5hZGRMZWZ0TWV0cmljKGZuLm1ldHJpY0ludm9jYXRpb25zKCkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmxhbWJkYUVycm9yc1dpZGdldC5hZGRMZWZ0TWV0cmljKGZuLm1ldHJpY0Vycm9ycygpKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5sYW1iZGFFcnJvcnNXaWRnZXQuYWRkTGVmdE1ldHJpYyhmbi5tZXRyaWNUaHJvdHRsZXMoKSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YVNvdXJjZSA9IG5ldyBhcHBzeW5jLkxhbWJkYURhdGFTb3VyY2UodGhpcywgYExhbWJkYURTJHtvcGVyYXRpb25JZH1gLCB7XG4gICAgICBhcGk6IHRoaXMuYXBpLFxuICAgICAgbGFtYmRhRnVuY3Rpb246IGZuLFxuICAgIH0pO1xuXG4gICAgbmV3IGFwcHN5bmMuUmVzb2x2ZXIodGhpcywgYFJlc29sdmVyJHtvcGVyYXRpb25JZH1gLCB7XG4gICAgICBhcGk6IHRoaXMuYXBpLFxuICAgICAgdHlwZU5hbWUsXG4gICAgICBmaWVsZE5hbWU6IGZpZWxkTmFtZSBhcyBzdHJpbmcsXG4gICAgICBkYXRhU291cmNlLFxuICAgIH0pO1xuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIHB1YmxpYyBhZGREeW5hbW9EYlZ0bFJlc29sdmVyPFRZUEUgZXh0ZW5kcyB7IF9fdHlwZW5hbWU/OiBhbnkgfT4odHlwZU5hbWU6IFRZUEVbJ19fdHlwZW5hbWUnXSwgZmllbGROYW1lOiBrZXlvZiBPbWl0PFRZUEUsICdfX3R5cGVuYW1lJz4pOiB2b2lkIHtcbiAgICBjb25zdCBvcGVyYXRpb25JZCA9IGAke3R5cGVOYW1lfS4ke2ZpZWxkTmFtZX1gO1xuXG4gICAgY29uc3QgbWFwcGluZ1JlcUZpbGUgPSBgLi9zcmMvdnRsLyR7b3BlcmF0aW9uSWR9LnJlcS52bWA7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKG1hcHBpbmdSZXFGaWxlKSkge1xuICAgICAgZnMud3JpdGVGaWxlU3luYyhtYXBwaW5nUmVxRmlsZSwgJyMjIFJlcXVlc3QgbWFwcGluZycsIHsgZW5jb2Rpbmc6ICd1dGYtOCcgfSk7XG4gICAgfVxuICAgIGNvbnN0IG1hcHBpbmdSZXNGaWxlID0gYC4vc3JjL3Z0bC8ke29wZXJhdGlvbklkfS5yZXMudm1gO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhtYXBwaW5nUmVzRmlsZSkpIHtcbiAgICAgIGZzLndyaXRlRmlsZVN5bmMobWFwcGluZ1Jlc0ZpbGUsICckdXRpbC50b0pzb24oJGN0eC5yZXN1bHQpJywgeyBlbmNvZGluZzogJ3V0Zi04JyB9KTtcbiAgICB9XG5cbiAgICBuZXcgYXBwc3luYy5SZXNvbHZlcih0aGlzLCBgUmVzb2x2ZXIke29wZXJhdGlvbklkfWAsIHtcbiAgICAgIGFwaTogdGhpcy5hcGksXG4gICAgICB0eXBlTmFtZSxcbiAgICAgIGZpZWxkTmFtZTogZmllbGROYW1lIGFzIHN0cmluZyxcbiAgICAgIGRhdGFTb3VyY2U6IHRoaXMudGFibGVEYXRhU291cmNlLFxuICAgICAgcmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogYXBwc3luYy5NYXBwaW5nVGVtcGxhdGUuZnJvbUZpbGUobWFwcGluZ1JlcUZpbGUpLFxuICAgICAgcmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6IGFwcHN5bmMuTWFwcGluZ1RlbXBsYXRlLmZyb21GaWxlKG1hcHBpbmdSZXNGaWxlKSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRW50cnlGaWxlKGVudHJ5RmlsZTogc3RyaW5nLCB0eXBlTmFtZTogc3RyaW5nLCBmaWVsZE5hbWU6IHN0cmluZykge1xuICAgIGZzLndyaXRlRmlsZVN5bmMoZW50cnlGaWxlLCBgaW1wb3J0IHsgaHR0cCB9IGZyb20gJ0B0YWltb3MvbGFtYmRhLXRvb2xib3gnO1xuXG4vLyBUT0RPOiBSZXBsYWNlIFFVRVJZVFlQRSB3aXRoIHRoZSBpbnB1dCB0eXBlIG9mIHRoZSBmaWVsZCAke3R5cGVOYW1lfS4ke2ZpZWxkTmFtZX1cbi8vIFRPRE86IFJlcGxhY2UgUkVUVVJOVFlQRSB3aXRoIHRoZSByZXR1cm4gdHlwZSBvZiB0aGUgZmllbGQgJHt0eXBlTmFtZX0uJHtmaWVsZE5hbWV9XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gaHR0cC5jcmVhdGVBcHBTeW5jSGFuZGxlcjxRVUVSWVRZUEUsIFJFVFVSTlRZUEU+KGFzeW5jIChjdHgpID0+IHtcbiAgY29uc29sZS5sb2coY3R4LmV2ZW50KTtcbiAgdGhyb3cgbmV3IEVycm9yKCdOb3QgeWV0IGltcGxlbWVudGVkJyk7XG59KTtgLCB7XG4gICAgICBlbmNvZGluZzogJ3V0Zi04JyxcbiAgICB9KTtcbiAgfVxufSJdfQ==