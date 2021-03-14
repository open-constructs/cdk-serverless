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
        const entryFile = `./src/lambda/${operationId}.ts`;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgtYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnN0cnVjdHMvZ3JhcGgtYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw4REFBZ0Q7QUFDaEQsb0VBQXNEO0FBRXRELG1EQUFxQztBQUNyQywyQ0FBc0Q7QUFDdEQsaUNBQTZEO0FBQzdELGlDQUF3QztBQUN4Qyw2Q0FBMEM7QUFDMUMsbUNBQTBFO0FBaUIxRSxNQUFhLFFBQVMsU0FBUSxHQUFHLENBQUMsU0FBUztJQVl6QyxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFVLEtBQW9COztRQUN4RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRG1DLFVBQUssR0FBTCxLQUFLLENBQWU7UUFGbEUsZUFBVSxHQUE4QyxFQUFFLENBQUM7UUFLakUsSUFBSSxLQUFLLENBQUMsb0JBQW9CLEVBQUU7WUFDOUIsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksNEJBQW9CLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUN6RztRQUNELElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRTtZQUN4QixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUkscUJBQWMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQ3hGO1FBQ0QsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO1lBQ2xCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxvQkFBUSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ2hFO1FBRUQsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNsRCxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsT0FB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RUFBRSxXQUFXLFdBQVcsRUFBRSxFQUFFO1lBQzlFLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRztZQUNiLGNBQWMsRUFBRSxFQUFFO1NBQ25CLENBQUMsQ0FBQztRQUVILElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsV0FBVyxXQUFXLEVBQUUsRUFBRTtZQUNuRCxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUc7WUFDYixRQUFRO1lBQ1IsU0FBUyxFQUFFLFNBQW1CO1lBQzlCLFVBQVU7U0FDWCxDQUFDLENBQUM7UUFDSCxPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUM7SUFFTSxzQkFBc0IsQ0FBb0MsUUFBNEIsRUFBRSxTQUF5QztRQUN0SSxNQUFNLFdBQVcsR0FBRyxHQUFHLFFBQVEsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUUvQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFdBQVcsV0FBVyxFQUFFLEVBQUU7WUFDbkQsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHO1lBQ2IsUUFBUTtZQUNSLFNBQVMsRUFBRSxTQUFtQjtZQUM5QixVQUFVLEVBQUUsSUFBSSxDQUFDLGVBQWU7WUFDaEMsc0JBQXNCLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsYUFBYSxXQUFXLFNBQVMsQ0FBQztZQUMzRix1QkFBdUIsRUFBRSxPQUFPLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxhQUFhLFdBQVcsU0FBUyxDQUFDO1NBQzdGLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQS9LRCw0QkErS0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhcHBzeW5jIGZyb20gJ0Bhd3MtY2RrL2F3cy1hcHBzeW5jJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnQGF3cy1jZGsvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgbGFtYmRhTm9kZWpzIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEtbm9kZWpzJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCB7IEFzc2V0Q2RuLCBBc3NldENkblByb3BzIH0gZnJvbSAnLi9hc3NldC1jZG4nO1xuaW1wb3J0IHsgQXV0aGVudGljYXRpb24sIEF1dGhlbnRpY2F0aW9uUHJvcHMgfSBmcm9tICcuL2F1dGgnO1xuaW1wb3J0IHsgTGFtYmRhRnVuY3Rpb24gfSBmcm9tICcuL2Z1bmMnO1xuaW1wb3J0IHsgTW9uaXRvcmluZyB9IGZyb20gJy4vbW9uaXRvcmluZyc7XG5pbXBvcnQgeyBTaW5nbGVUYWJsZURhdGFzdG9yZSwgU2luZ2xlVGFibGVEYXRhc3RvcmVQcm9wcyB9IGZyb20gJy4vdGFibGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdyYXBoQXBpUHJvcHMge1xuICBhcGlOYW1lOiBzdHJpbmc7XG4gIHN0YWdlTmFtZTogc3RyaW5nO1xuXG4gIG1vbml0b3Jpbmc/OiBib29sZWFuO1xuICBzaW5nbGVUYWJsZURhdGFzdG9yZT86IFNpbmdsZVRhYmxlRGF0YXN0b3JlUHJvcHM7XG4gIGF1dGhlbnRpY2F0aW9uPzogQXV0aGVudGljYXRpb25Qcm9wcztcbiAgYXNzZXRDZG4/OiBBc3NldENkblByb3BzO1xuXG4gIGFkZGl0aW9uYWxFbnY/OiB7XG4gICAgW2tleTogc3RyaW5nXTogc3RyaW5nO1xuICB9O1xuXG59XG5cbmV4cG9ydCBjbGFzcyBHcmFwaEFwaSBleHRlbmRzIGNkay5Db25zdHJ1Y3Qge1xuXG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwcHN5bmMuR3JhcGhxbEFwaTtcblxuICBwdWJsaWMgcmVhZG9ubHkgc2luZ2xlVGFibGVEYXRhc3RvcmU/OiBTaW5nbGVUYWJsZURhdGFzdG9yZTtcbiAgcHVibGljIHJlYWRvbmx5IGF1dGhlbnRpY2F0aW9uPzogQXV0aGVudGljYXRpb247XG4gIHB1YmxpYyByZWFkb25seSBhc3NldENkbj86IEFzc2V0Q2RuO1xuICBwdWJsaWMgcmVhZG9ubHkgdGFibGVEYXRhU291cmNlPzogYXBwc3luYy5EeW5hbW9EYkRhdGFTb3VyY2U7XG4gIHB1YmxpYyByZWFkb25seSBtb25pdG9yaW5nPzogTW9uaXRvcmluZztcblxuICBwcml2YXRlIF9mdW5jdGlvbnM6IHsgW29wZXJhdGlvbklkOiBzdHJpbmddOiBMYW1iZGFGdW5jdGlvbiB9ID0ge307XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByaXZhdGUgcHJvcHM6IEdyYXBoQXBpUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgaWYgKHByb3BzLnNpbmdsZVRhYmxlRGF0YXN0b3JlKSB7XG4gICAgICB0aGlzLnNpbmdsZVRhYmxlRGF0YXN0b3JlID0gbmV3IFNpbmdsZVRhYmxlRGF0YXN0b3JlKHRoaXMsICdTaW5nbGVUYWJsZURTJywgcHJvcHMuc2luZ2xlVGFibGVEYXRhc3RvcmUpO1xuICAgIH1cbiAgICBpZiAocHJvcHMuYXV0aGVudGljYXRpb24pIHtcbiAgICAgIHRoaXMuYXV0aGVudGljYXRpb24gPSBuZXcgQXV0aGVudGljYXRpb24odGhpcywgJ0F1dGhlbnRpY2F0aW9uJywgcHJvcHMuYXV0aGVudGljYXRpb24pO1xuICAgIH1cbiAgICBpZiAocHJvcHMuYXNzZXRDZG4pIHtcbiAgICAgIHRoaXMuYXNzZXRDZG4gPSBuZXcgQXNzZXRDZG4odGhpcywgJ0Fzc2V0Q2RuJywgcHJvcHMuYXNzZXRDZG4pO1xuICAgIH1cblxuICAgIHRoaXMuYXBpID0gbmV3IGFwcHN5bmMuR3JhcGhxbEFwaSh0aGlzLCAnUmVzb3VyY2UnLCB7XG4gICAgICBuYW1lOiBgJHtwcm9wcy5hcGlOYW1lfSBbJHtwcm9wcy5zdGFnZU5hbWV9XWAsXG4gICAgICBsb2dDb25maWc6IHtcbiAgICAgICAgZmllbGRMb2dMZXZlbDogYXBwc3luYy5GaWVsZExvZ0xldmVsLkFMTCxcbiAgICAgIH0sXG4gICAgICBzY2hlbWE6IGFwcHN5bmMuU2NoZW1hLmZyb21Bc3NldCgnc2NoZW1hLmdyYXBocWwnKSxcbiAgICAgIC4uLnRoaXMuYXV0aGVudGljYXRpb24gJiYge1xuICAgICAgICBhdXRob3JpemF0aW9uQ29uZmlnOiB7XG4gICAgICAgICAgYWRkaXRpb25hbEF1dGhvcml6YXRpb25Nb2RlczogW3tcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcHBzeW5jLkF1dGhvcml6YXRpb25UeXBlLlVTRVJfUE9PTCxcbiAgICAgICAgICAgIHVzZXJQb29sQ29uZmlnOiB7XG4gICAgICAgICAgICAgIHVzZXJQb29sOiB0aGlzLmF1dGhlbnRpY2F0aW9uLnVzZXJwb29sLFxuICAgICAgICAgICAgICBkZWZhdWx0QWN0aW9uOiBhcHBzeW5jLlVzZXJQb29sRGVmYXVsdEFjdGlvbi5ERU5ZLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9XSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAocHJvcHMubW9uaXRvcmluZyA/PyB0cnVlKSB7XG4gICAgICB0aGlzLm1vbml0b3JpbmcgPSBuZXcgTW9uaXRvcmluZyh0aGlzLCAnTW9uaXRvcmluZycsIHtcbiAgICAgICAgYXBpTmFtZTogdGhpcy5wcm9wcy5hcGlOYW1lLFxuICAgICAgICBzdGFnZU5hbWU6IHRoaXMucHJvcHMuc3RhZ2VOYW1lLFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlFcnJvcnNXaWRnZXQuYWRkTGVmdE1ldHJpYyhuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQXBwU3luYycsXG4gICAgICAgIG1ldHJpY05hbWU6ICc1WFhFcnJvcicsXG4gICAgICAgIGRpbWVuc2lvbnM6IHtcbiAgICAgICAgICBHcmFwaFFMQVBJSWQ6IHRoaXMuYXBpLmFwaUlkLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdzdW0nLFxuICAgICAgfSkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUVycm9yc1dpZGdldC5hZGRMZWZ0TWV0cmljKG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJzRYWEVycm9yJyxcbiAgICAgICAgZGltZW5zaW9uczoge1xuICAgICAgICAgIEdyYXBoUUxBUElJZDogdGhpcy5hcGkuYXBpSWQsXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ3N1bScsXG4gICAgICB9KSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpTGF0ZW5jeVdpZGdldC5hZGRMZWZ0TWV0cmljKG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgR3JhcGhRTEFQSUlkOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICB9KSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpTGF0ZW5jeVdpZGdldC5hZGRMZWZ0TWV0cmljKG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgR3JhcGhRTEFQSUlkOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAncDkwJyxcbiAgICAgIH0pKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlMYXRlbmN5VGFpbFdpZGdldC5hZGRMZWZ0TWV0cmljKG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgR3JhcGhRTEFQSUlkOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAncDk1JyxcbiAgICAgIH0pKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlMYXRlbmN5VGFpbFdpZGdldC5hZGRMZWZ0TWV0cmljKG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcHBTeW5jJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICBkaW1lbnNpb25zOiB7XG4gICAgICAgICAgR3JhcGhRTEFQSUlkOiB0aGlzLmFwaS5hcGlJZCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAncDk5JyxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZSkge1xuICAgICAgdGhpcy50YWJsZURhdGFTb3VyY2UgPSBuZXcgYXBwc3luYy5EeW5hbW9EYkRhdGFTb3VyY2UodGhpcywgJ1NpbmdsZVRhYmxlU291cmNlJywge1xuICAgICAgICBhcGk6IHRoaXMuYXBpLFxuICAgICAgICB0YWJsZTogdGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZT8udGFibGUsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogZ2V0RnVuY3Rpb25Gb3JPcGVyYXRpb25cbiAgICovXG4gIHB1YmxpYyBnZXRGdW5jdGlvbkZvck9wZXJhdGlvbjxUWVBFIGV4dGVuZHMgeyBfX3R5cGVuYW1lPzogYW55IH0+KHR5cGVOYW1lOiBUWVBFWydfX3R5cGVuYW1lJ10sIGZpZWxkTmFtZToga2V5b2YgT21pdDxUWVBFLCAnX190eXBlbmFtZSc+KTogTGFtYmRhRnVuY3Rpb24ge1xuICAgIHJldHVybiB0aGlzLl9mdW5jdGlvbnNbYCR7dHlwZU5hbWV9LiR7ZmllbGROYW1lfWBdO1xuICB9XG5cbiAgcHVibGljIGFkZExhbWJkYVJlc29sdmVyPFRZUEUgZXh0ZW5kcyB7IF9fdHlwZW5hbWU/OiBhbnkgfT4odHlwZU5hbWU6IFRZUEVbJ19fdHlwZW5hbWUnXSwgZmllbGROYW1lOiBrZXlvZiBPbWl0PFRZUEUsICdfX3R5cGVuYW1lJz4pOiBsYW1iZGFOb2RlanMuTm9kZWpzRnVuY3Rpb24ge1xuICAgIGNvbnN0IG9wZXJhdGlvbklkID0gYCR7dHlwZU5hbWV9LiR7ZmllbGROYW1lfWA7XG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBgVHlwZSAke3R5cGVOYW1lfSBGaWVsZCAke2ZpZWxkTmFtZX0gUmVzb2x2ZXJgO1xuXG4gICAgY29uc3QgZW50cnlGaWxlID0gYC4vc3JjL2xhbWJkYS8ke29wZXJhdGlvbklkfS50c2A7XG4gICAgLy8gVE9ETyBnZW5lcmF0ZSBlbnRyeSBmaWxlIGlmIG5lZWRlZFxuXG4gICAgY29uc3QgZm4gPSBuZXcgTGFtYmRhRnVuY3Rpb24odGhpcywgYEZuJHtvcGVyYXRpb25JZH1gLCB7XG4gICAgICBzdGFnZU5hbWU6IHRoaXMucHJvcHMuc3RhZ2VOYW1lLFxuICAgICAgYWRkaXRpb25hbEVudjogdGhpcy5wcm9wcy5hZGRpdGlvbmFsRW52LFxuICAgICAgZW50cnk6IGVudHJ5RmlsZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgWyR7dGhpcy5wcm9wcy5zdGFnZU5hbWV9XSAke2Rlc2NyaXB0aW9ufWAsXG4gICAgICAuLi50aGlzLmF1dGhlbnRpY2F0aW9uICYmIHtcbiAgICAgICAgdXNlclBvb2w6IHRoaXMuYXV0aGVudGljYXRpb24/LnVzZXJwb29sLFxuICAgICAgfSxcbiAgICAgIC4uLnRoaXMuc2luZ2xlVGFibGVEYXRhc3RvcmUgJiYge1xuICAgICAgICB0YWJsZTogdGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZS50YWJsZSxcbiAgICAgICAgdGFibGVXcml0ZXM6IHR5cGVOYW1lID09PSAnTXV0YXRpb24nLFxuICAgICAgfSxcbiAgICAgIC4uLnRoaXMuYXNzZXRDZG4gJiYge1xuICAgICAgICBhc3NldERvbWFpbk5hbWU6IHRoaXMuYXNzZXRDZG4uYXNzZXREb21haW5OYW1lLFxuICAgICAgICBhc3NldEJ1Y2tldDogdGhpcy5hc3NldENkbi5hc3NldEJ1Y2tldCxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5fZnVuY3Rpb25zW29wZXJhdGlvbklkXSA9IGZuO1xuICAgIGNkay5UYWdzLm9mKGZuKS5hZGQoJ09wZW5BUEknLCBkZXNjcmlwdGlvbik7XG5cbiAgICBpZiAodGhpcy5tb25pdG9yaW5nKSB7XG4gICAgICB0aGlzLm1vbml0b3JpbmcubGFtYmRhRHVyYXRpb25zV2lkZ2V0LmFkZExlZnRNZXRyaWMoZm4ubWV0cmljRHVyYXRpb24oKSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcubGFtYmRhSW52b2tlc1dpZGdldC5hZGRMZWZ0TWV0cmljKGZuLm1ldHJpY0ludm9jYXRpb25zKCkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmxhbWJkYUVycm9yc1dpZGdldC5hZGRMZWZ0TWV0cmljKGZuLm1ldHJpY0Vycm9ycygpKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5sYW1iZGFFcnJvcnNXaWRnZXQuYWRkTGVmdE1ldHJpYyhmbi5tZXRyaWNUaHJvdHRsZXMoKSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YVNvdXJjZSA9IG5ldyBhcHBzeW5jLkxhbWJkYURhdGFTb3VyY2UodGhpcywgYExhbWJkYURTJHtvcGVyYXRpb25JZH1gLCB7XG4gICAgICBhcGk6IHRoaXMuYXBpLFxuICAgICAgbGFtYmRhRnVuY3Rpb246IGZuLFxuICAgIH0pO1xuXG4gICAgbmV3IGFwcHN5bmMuUmVzb2x2ZXIodGhpcywgYFJlc29sdmVyJHtvcGVyYXRpb25JZH1gLCB7XG4gICAgICBhcGk6IHRoaXMuYXBpLFxuICAgICAgdHlwZU5hbWUsXG4gICAgICBmaWVsZE5hbWU6IGZpZWxkTmFtZSBhcyBzdHJpbmcsXG4gICAgICBkYXRhU291cmNlLFxuICAgIH0pO1xuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIHB1YmxpYyBhZGREeW5hbW9EYlZ0bFJlc29sdmVyPFRZUEUgZXh0ZW5kcyB7IF9fdHlwZW5hbWU/OiBhbnkgfT4odHlwZU5hbWU6IFRZUEVbJ19fdHlwZW5hbWUnXSwgZmllbGROYW1lOiBrZXlvZiBPbWl0PFRZUEUsICdfX3R5cGVuYW1lJz4pOiB2b2lkIHtcbiAgICBjb25zdCBvcGVyYXRpb25JZCA9IGAke3R5cGVOYW1lfS4ke2ZpZWxkTmFtZX1gO1xuXG4gICAgbmV3IGFwcHN5bmMuUmVzb2x2ZXIodGhpcywgYFJlc29sdmVyJHtvcGVyYXRpb25JZH1gLCB7XG4gICAgICBhcGk6IHRoaXMuYXBpLFxuICAgICAgdHlwZU5hbWUsXG4gICAgICBmaWVsZE5hbWU6IGZpZWxkTmFtZSBhcyBzdHJpbmcsXG4gICAgICBkYXRhU291cmNlOiB0aGlzLnRhYmxlRGF0YVNvdXJjZSxcbiAgICAgIHJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6IGFwcHN5bmMuTWFwcGluZ1RlbXBsYXRlLmZyb21GaWxlKGAuL3NyYy92dGwvJHtvcGVyYXRpb25JZH0ucmVxLnZtYCksXG4gICAgICByZXNwb25zZU1hcHBpbmdUZW1wbGF0ZTogYXBwc3luYy5NYXBwaW5nVGVtcGxhdGUuZnJvbUZpbGUoYC4vc3JjL3Z0bC8ke29wZXJhdGlvbklkfS5yZXMudm1gKSxcbiAgICB9KTtcbiAgfVxufSJdfQ==