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
exports.GraphApi = void 0;
const appsync = __importStar(require("@aws-cdk/aws-appsync"));
const cloudwatch = __importStar(require("@aws-cdk/aws-cloudwatch"));
const cdk = __importStar(require("@aws-cdk/core"));
const asset_cdn_1 = require("./asset-cdn");
const auth_1 = require("./auth");
const func_1 = require("./func");
const monitoring_1 = require("./monitoring");
const table_1 = require("./table");
class GraphApi extends cdk.Construct {
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
        const fn = new func_1.LambdaFunction(this, `Fn${operationId}`, {
            stageName: this.props.stageName,
            additionalEnv: this.props.additionalEnv,
            file: operationId,
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
        new appsync.Resolver(this, `Resolver${operationId}`, {
            api: this.api,
            typeName,
            fieldName: fieldName,
            dataSource: this.tableDataSource,
            requestMappingTemplate: appsync.MappingTemplate.fromFile(`./src/vtl/${operationId}.req.vm`),
            responseMappingTemplate: appsync.MappingTemplate.fromFile(`./src/vtl/${operationId}.res.vm`),
        });
    }
}
exports.GraphApi = GraphApi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgtYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnN0cnVjdHMvZ3JhcGgtYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw4REFBZ0Q7QUFDaEQsb0VBQXNEO0FBRXRELG1EQUFxQztBQUNyQywyQ0FBc0Q7QUFDdEQsaUNBQTZEO0FBQzdELGlDQUF3QztBQUN4Qyw2Q0FBMEM7QUFDMUMsbUNBQTBFO0FBaUIxRSxNQUFhLFFBQVMsU0FBUSxHQUFHLENBQUMsU0FBUztJQVl6QyxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFVLEtBQW9COztRQUN4RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRG1DLFVBQUssR0FBTCxLQUFLLENBQWU7UUFGbEUsZUFBVSxHQUE4QyxFQUFFLENBQUM7UUFLakUsSUFBSSxLQUFLLENBQUMsb0JBQW9CLEVBQUU7WUFDOUIsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksNEJBQW9CLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUN6RztRQUNELElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRTtZQUN4QixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUkscUJBQWMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQ3hGO1FBQ0QsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO1lBQ2xCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxvQkFBUSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ2hFO1FBRUQsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNsRCxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsT0FB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WUFDYixjQUFjLEVBQUUsRUFBRTtTQUNuQixDQUFDLENBQUM7UUFFSCxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFdBQVcsV0FBVyxFQUFFLEVBQUU7WUFDbkQsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHO1lBQ2IsUUFBUTtZQUNSLFNBQVMsRUFBRSxTQUFtQjtZQUM5QixVQUFVO1NBQ1gsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxFQUFFLENBQUM7SUFDWixDQUFDO0lBRVMsc0JBQXNCLENBQW9DLFFBQTRCLEVBQUUsU0FBeUM7UUFDekksTUFBTSxXQUFXLEdBQUcsR0FBRyxRQUFRLElBQUksU0FBUyxFQUFFLENBQUM7UUFFL0MsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxXQUFXLFdBQVcsRUFBRSxFQUFFO1lBQ25ELEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRztZQUNiLFFBQVE7WUFDUixTQUFTLEVBQUUsU0FBbUI7WUFDOUIsVUFBVSxFQUFFLElBQUksQ0FBQyxlQUFlO1lBQ2hDLHNCQUFzQixFQUFFLE9BQU8sQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLGFBQWEsV0FBVyxTQUFTLENBQUM7WUFDM0YsdUJBQXVCLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsYUFBYSxXQUFXLFNBQVMsQ0FBQztTQUM3RixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE1S0QsNEJBNEtDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXBwc3luYyBmcm9tICdAYXdzLWNkay9hd3MtYXBwc3luYyc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ0Bhd3MtY2RrL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGxhbWJkYU5vZGVqcyBmcm9tICdAYXdzLWNkay9hd3MtbGFtYmRhLW5vZGVqcyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgeyBBc3NldENkbiwgQXNzZXRDZG5Qcm9wcyB9IGZyb20gJy4vYXNzZXQtY2RuJztcbmltcG9ydCB7IEF1dGhlbnRpY2F0aW9uLCBBdXRoZW50aWNhdGlvblByb3BzIH0gZnJvbSAnLi9hdXRoJztcbmltcG9ydCB7IExhbWJkYUZ1bmN0aW9uIH0gZnJvbSAnLi9mdW5jJztcbmltcG9ydCB7IE1vbml0b3JpbmcgfSBmcm9tICcuL21vbml0b3JpbmcnO1xuaW1wb3J0IHsgU2luZ2xlVGFibGVEYXRhc3RvcmUsIFNpbmdsZVRhYmxlRGF0YXN0b3JlUHJvcHMgfSBmcm9tICcuL3RhYmxlJztcblxuZXhwb3J0IGludGVyZmFjZSBHcmFwaEFwaVByb3BzIHtcbiAgYXBpTmFtZTogc3RyaW5nO1xuICBzdGFnZU5hbWU6IHN0cmluZztcblxuICBtb25pdG9yaW5nPzogYm9vbGVhbjtcbiAgc2luZ2xlVGFibGVEYXRhc3RvcmU/OiBTaW5nbGVUYWJsZURhdGFzdG9yZVByb3BzO1xuICBhdXRoZW50aWNhdGlvbj86IEF1dGhlbnRpY2F0aW9uUHJvcHM7XG4gIGFzc2V0Q2RuPzogQXNzZXRDZG5Qcm9wcztcblxuICBhZGRpdGlvbmFsRW52Pzoge1xuICAgIFtrZXk6IHN0cmluZ106IHN0cmluZztcbiAgfTtcblxufVxuXG5leHBvcnQgY2xhc3MgR3JhcGhBcGkgZXh0ZW5kcyBjZGsuQ29uc3RydWN0IHtcblxuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcHBzeW5jLkdyYXBocWxBcGk7XG5cbiAgcHVibGljIHJlYWRvbmx5IHNpbmdsZVRhYmxlRGF0YXN0b3JlPzogU2luZ2xlVGFibGVEYXRhc3RvcmU7XG4gIHB1YmxpYyByZWFkb25seSBhdXRoZW50aWNhdGlvbj86IEF1dGhlbnRpY2F0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYXNzZXRDZG4/OiBBc3NldENkbjtcbiAgcHVibGljIHJlYWRvbmx5IHRhYmxlRGF0YVNvdXJjZT86IGFwcHN5bmMuRHluYW1vRGJEYXRhU291cmNlO1xuICBwdWJsaWMgcmVhZG9ubHkgbW9uaXRvcmluZz86IE1vbml0b3Jpbmc7XG5cbiAgcHJpdmF0ZSBfZnVuY3Rpb25zOiB7IFtvcGVyYXRpb25JZDogc3RyaW5nXTogTGFtYmRhRnVuY3Rpb24gfSA9IHt9O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcml2YXRlIHByb3BzOiBHcmFwaEFwaVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGlmIChwcm9wcy5zaW5nbGVUYWJsZURhdGFzdG9yZSkge1xuICAgICAgdGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZSA9IG5ldyBTaW5nbGVUYWJsZURhdGFzdG9yZSh0aGlzLCAnU2luZ2xlVGFibGVEUycsIHByb3BzLnNpbmdsZVRhYmxlRGF0YXN0b3JlKTtcbiAgICB9XG4gICAgaWYgKHByb3BzLmF1dGhlbnRpY2F0aW9uKSB7XG4gICAgICB0aGlzLmF1dGhlbnRpY2F0aW9uID0gbmV3IEF1dGhlbnRpY2F0aW9uKHRoaXMsICdBdXRoZW50aWNhdGlvbicsIHByb3BzLmF1dGhlbnRpY2F0aW9uKTtcbiAgICB9XG4gICAgaWYgKHByb3BzLmFzc2V0Q2RuKSB7XG4gICAgICB0aGlzLmFzc2V0Q2RuID0gbmV3IEFzc2V0Q2RuKHRoaXMsICdBc3NldENkbicsIHByb3BzLmFzc2V0Q2RuKTtcbiAgICB9XG5cbiAgICB0aGlzLmFwaSA9IG5ldyBhcHBzeW5jLkdyYXBocWxBcGkodGhpcywgJ1Jlc291cmNlJywge1xuICAgICAgbmFtZTogYCR7cHJvcHMuYXBpTmFtZX0gWyR7cHJvcHMuc3RhZ2VOYW1lfV1gLFxuICAgICAgbG9nQ29uZmlnOiB7XG4gICAgICAgIGZpZWxkTG9nTGV2ZWw6IGFwcHN5bmMuRmllbGRMb2dMZXZlbC5BTEwsXG4gICAgICB9LFxuICAgICAgc2NoZW1hOiBhcHBzeW5jLlNjaGVtYS5mcm9tQXNzZXQoJ3NjaGVtYS5ncmFwaHFsJyksXG4gICAgICAuLi50aGlzLmF1dGhlbnRpY2F0aW9uICYmIHtcbiAgICAgICAgYXV0aG9yaXphdGlvbkNvbmZpZzoge1xuICAgICAgICAgIGFkZGl0aW9uYWxBdXRob3JpemF0aW9uTW9kZXM6IFt7XG4gICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBwc3luYy5BdXRob3JpemF0aW9uVHlwZS5VU0VSX1BPT0wsXG4gICAgICAgICAgICB1c2VyUG9vbENvbmZpZzoge1xuICAgICAgICAgICAgICB1c2VyUG9vbDogdGhpcy5hdXRoZW50aWNhdGlvbi51c2VycG9vbCxcbiAgICAgICAgICAgICAgZGVmYXVsdEFjdGlvbjogYXBwc3luYy5Vc2VyUG9vbERlZmF1bHRBY3Rpb24uREVOWSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfV0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHByb3BzLm1vbml0b3JpbmcgPz8gdHJ1ZSkge1xuICAgICAgdGhpcy5tb25pdG9yaW5nID0gbmV3IE1vbml0b3JpbmcodGhpcywgJ01vbml0b3JpbmcnLCB7XG4gICAgICAgIGFwaU5hbWU6IHRoaXMucHJvcHMuYXBpTmFtZSxcbiAgICAgICAgc3RhZ2VOYW1lOiB0aGlzLnByb3BzLnN0YWdlTmFtZSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpRXJyb3JzV2lkZ2V0LmFkZExlZnRNZXRyaWMobmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0FwcFN5bmMnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnNVhYRXJyb3InLFxuICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgR3JhcGhRTEFQSUlkOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnc3VtJyxcbiAgICAgIH0pKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlFcnJvcnNXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICc0WFhFcnJvcicsXG4gICAgICAgIGRpbWVuc2lvbnM6IHtcbiAgICAgICAgICBHcmFwaFFMQVBJSWQ6IHRoaXMuYXBpLmFwaUlkLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdzdW0nLFxuICAgICAgfSkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUxhdGVuY3lXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgICAgZGltZW5zaW9uczoge1xuICAgICAgICAgIEdyYXBoUUxBUElJZDogdGhpcy5hcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgfSkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUxhdGVuY3lXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgICAgZGltZW5zaW9uczoge1xuICAgICAgICAgIEdyYXBoUUxBUElJZDogdGhpcy5hcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ3A5MCcsXG4gICAgICB9KSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpTGF0ZW5jeVRhaWxXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgICAgZGltZW5zaW9uczoge1xuICAgICAgICAgIEdyYXBoUUxBUElJZDogdGhpcy5hcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ3A5NScsXG4gICAgICB9KSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpTGF0ZW5jeVRhaWxXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgICAgZGltZW5zaW9uczoge1xuICAgICAgICAgIEdyYXBoUUxBUElJZDogdGhpcy5hcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ3A5OScsXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc2luZ2xlVGFibGVEYXRhc3RvcmUpIHtcbiAgICAgIHRoaXMudGFibGVEYXRhU291cmNlID0gbmV3IGFwcHN5bmMuRHluYW1vRGJEYXRhU291cmNlKHRoaXMsICdTaW5nbGVUYWJsZVNvdXJjZScsIHtcbiAgICAgICAgYXBpOiB0aGlzLmFwaSxcbiAgICAgICAgdGFibGU6IHRoaXMuc2luZ2xlVGFibGVEYXRhc3RvcmU/LnRhYmxlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIGdldEZ1bmN0aW9uRm9yT3BlcmF0aW9uXG4gICAqL1xuICBwdWJsaWMgZ2V0RnVuY3Rpb25Gb3JPcGVyYXRpb248VFlQRSBleHRlbmRzIHsgX190eXBlbmFtZT86IGFueSB9Pih0eXBlTmFtZTogVFlQRVsnX190eXBlbmFtZSddLCBmaWVsZE5hbWU6IGtleW9mIE9taXQ8VFlQRSwgJ19fdHlwZW5hbWUnPik6IExhbWJkYUZ1bmN0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5fZnVuY3Rpb25zW2Ake3R5cGVOYW1lfS4ke2ZpZWxkTmFtZX1gXTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhZGRMYW1iZGFSZXNvbHZlcjxUWVBFIGV4dGVuZHMgeyBfX3R5cGVuYW1lPzogYW55IH0+KHR5cGVOYW1lOiBUWVBFWydfX3R5cGVuYW1lJ10sIGZpZWxkTmFtZToga2V5b2YgT21pdDxUWVBFLCAnX190eXBlbmFtZSc+KTogbGFtYmRhTm9kZWpzLk5vZGVqc0Z1bmN0aW9uIHtcbiAgICBjb25zdCBvcGVyYXRpb25JZCA9IGAke3R5cGVOYW1lfS4ke2ZpZWxkTmFtZX1gO1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gYFR5cGUgJHt0eXBlTmFtZX0gRmllbGQgJHtmaWVsZE5hbWV9IFJlc29sdmVyYDtcblxuICAgIGNvbnN0IGZuID0gbmV3IExhbWJkYUZ1bmN0aW9uKHRoaXMsIGBGbiR7b3BlcmF0aW9uSWR9YCwge1xuICAgICAgc3RhZ2VOYW1lOiB0aGlzLnByb3BzLnN0YWdlTmFtZSxcbiAgICAgIGFkZGl0aW9uYWxFbnY6IHRoaXMucHJvcHMuYWRkaXRpb25hbEVudixcbiAgICAgIGZpbGU6IG9wZXJhdGlvbklkLFxuICAgICAgZGVzY3JpcHRpb246IGBbJHt0aGlzLnByb3BzLnN0YWdlTmFtZX1dICR7ZGVzY3JpcHRpb259YCxcbiAgICAgIC4uLnRoaXMuYXV0aGVudGljYXRpb24gJiYge1xuICAgICAgICB1c2VyUG9vbDogdGhpcy5hdXRoZW50aWNhdGlvbj8udXNlcnBvb2wsXG4gICAgICB9LFxuICAgICAgLi4udGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZSAmJiB7XG4gICAgICAgIHRhYmxlOiB0aGlzLnNpbmdsZVRhYmxlRGF0YXN0b3JlLnRhYmxlLFxuICAgICAgICB0YWJsZVdyaXRlczogdHlwZU5hbWUgPT09ICdNdXRhdGlvbicsXG4gICAgICB9LFxuICAgICAgLi4udGhpcy5hc3NldENkbiAmJiB7XG4gICAgICAgIGFzc2V0RG9tYWluTmFtZTogdGhpcy5hc3NldENkbi5hc3NldERvbWFpbk5hbWUsXG4gICAgICAgIGFzc2V0QnVja2V0OiB0aGlzLmFzc2V0Q2RuLmFzc2V0QnVja2V0LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICB0aGlzLl9mdW5jdGlvbnNbb3BlcmF0aW9uSWRdID0gZm47XG4gICAgY2RrLlRhZ3Mub2YoZm4pLmFkZCgnT3BlbkFQSScsIGRlc2NyaXB0aW9uKTtcblxuICAgIGlmICh0aGlzLm1vbml0b3JpbmcpIHtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5sYW1iZGFEdXJhdGlvbnNXaWRnZXQuYWRkTGVmdE1ldHJpYyhmbi5tZXRyaWNEdXJhdGlvbigpKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5sYW1iZGFJbnZva2VzV2lkZ2V0LmFkZExlZnRNZXRyaWMoZm4ubWV0cmljSW52b2NhdGlvbnMoKSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcubGFtYmRhRXJyb3JzV2lkZ2V0LmFkZExlZnRNZXRyaWMoZm4ubWV0cmljRXJyb3JzKCkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmxhbWJkYUVycm9yc1dpZGdldC5hZGRMZWZ0TWV0cmljKGZuLm1ldHJpY1Rocm90dGxlcygpKTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXRhU291cmNlID0gbmV3IGFwcHN5bmMuTGFtYmRhRGF0YVNvdXJjZSh0aGlzLCBgTGFtYmRhRFMke29wZXJhdGlvbklkfWAsIHtcbiAgICAgIGFwaTogdGhpcy5hcGksXG4gICAgICBsYW1iZGFGdW5jdGlvbjogZm4sXG4gICAgfSk7XG5cbiAgICBuZXcgYXBwc3luYy5SZXNvbHZlcih0aGlzLCBgUmVzb2x2ZXIke29wZXJhdGlvbklkfWAsIHtcbiAgICAgIGFwaTogdGhpcy5hcGksXG4gICAgICB0eXBlTmFtZSxcbiAgICAgIGZpZWxkTmFtZTogZmllbGROYW1lIGFzIHN0cmluZyxcbiAgICAgIGRhdGFTb3VyY2UsXG4gICAgfSk7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFkZER5bmFtb0RiVnRsUmVzb2x2ZXI8VFlQRSBleHRlbmRzIHsgX190eXBlbmFtZT86IGFueSB9Pih0eXBlTmFtZTogVFlQRVsnX190eXBlbmFtZSddLCBmaWVsZE5hbWU6IGtleW9mIE9taXQ8VFlQRSwgJ19fdHlwZW5hbWUnPik6IHZvaWQge1xuICAgIGNvbnN0IG9wZXJhdGlvbklkID0gYCR7dHlwZU5hbWV9LiR7ZmllbGROYW1lfWA7XG5cbiAgICBuZXcgYXBwc3luYy5SZXNvbHZlcih0aGlzLCBgUmVzb2x2ZXIke29wZXJhdGlvbklkfWAsIHtcbiAgICAgIGFwaTogdGhpcy5hcGksXG4gICAgICB0eXBlTmFtZSxcbiAgICAgIGZpZWxkTmFtZTogZmllbGROYW1lIGFzIHN0cmluZyxcbiAgICAgIGRhdGFTb3VyY2U6IHRoaXMudGFibGVEYXRhU291cmNlLFxuICAgICAgcmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogYXBwc3luYy5NYXBwaW5nVGVtcGxhdGUuZnJvbUZpbGUoYC4vc3JjL3Z0bC8ke29wZXJhdGlvbklkfS5yZXEudm1gKSxcbiAgICAgIHJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiBhcHBzeW5jLk1hcHBpbmdUZW1wbGF0ZS5mcm9tRmlsZShgLi9zcmMvdnRsLyR7b3BlcmF0aW9uSWR9LnJlcy52bWApLFxuICAgIH0pO1xuICB9XG59Il19