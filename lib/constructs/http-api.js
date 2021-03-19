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
exports.HttpApi = void 0;
const fs = __importStar(require("fs"));
const apiGW = __importStar(require("@aws-cdk/aws-apigatewayv2"));
const apiGWInteg = __importStar(require("@aws-cdk/aws-apigatewayv2-integrations"));
const acm = __importStar(require("@aws-cdk/aws-certificatemanager"));
const route53 = __importStar(require("@aws-cdk/aws-route53"));
const route53Target = __importStar(require("@aws-cdk/aws-route53-targets"));
const cdk = __importStar(require("@aws-cdk/core"));
const yaml = __importStar(require("js-yaml"));
const asset_cdn_1 = require("./asset-cdn");
const auth_1 = require("./auth");
const func_1 = require("./func");
const monitoring_1 = require("./monitoring");
const table_1 = require("./table");
class HttpApi extends cdk.Construct {
    constructor(scope, id, props) {
        var _a, _b, _c;
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
        const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
        const apiDomainName = `${(_a = props.apiHostname) !== null && _a !== void 0 ? _a : 'api'}.${props.domainName}`;
        this.apiSpec = yaml.load(fs.readFileSync('openapi.yaml').toString());
        const dn = new apiGW.DomainName(this, 'DomainName', {
            domainName: apiDomainName,
            certificate: new acm.Certificate(this, 'Cert', {
                domainName: apiDomainName,
                validation: acm.CertificateValidation.fromDns(hostedZone),
            }),
        });
        this.api = new apiGW.HttpApi(this, 'Resource', {
            apiName: `${props.apiName} [${props.stageName}]`,
            defaultDomainMapping: {
                domainName: dn,
            },
        });
        new route53.ARecord(this, 'DnsRecord', {
            zone: hostedZone,
            recordName: apiDomainName,
            target: route53.RecordTarget.fromAlias(new route53Target.ApiGatewayv2Domain(dn)),
        });
        if ((_b = props.monitoring) !== null && _b !== void 0 ? _b : true) {
            this.monitoring = new monitoring_1.Monitoring(this, 'Monitoring', {
                apiName: this.props.apiName,
                stageName: this.props.stageName,
            });
            this.monitoring.apiErrorsWidget.addLeftMetric(this.api.metricServerError({
                statistic: 'sum',
            }));
            this.monitoring.apiErrorsWidget.addLeftMetric(this.api.metricClientError({
                statistic: 'sum',
            }));
            this.monitoring.apiLatencyWidget.addLeftMetric(this.api.metricLatency({
                statistic: 'Average',
            }));
            this.monitoring.apiLatencyWidget.addLeftMetric(this.api.metricLatency({
                statistic: 'p90',
            }));
            this.monitoring.apiLatencyTailWidget.addLeftMetric(this.api.metricLatency({
                statistic: 'p95',
            }));
            this.monitoring.apiLatencyTailWidget.addLeftMetric(this.api.metricLatency({
                statistic: 'p99',
            }));
        }
        if ((_c = props.autoGenerateRoutes) !== null && _c !== void 0 ? _c : true) {
            for (const path in this.apiSpec.paths) {
                if (Object.prototype.hasOwnProperty.call(this.apiSpec.paths, path)) {
                    const pathItem = this.apiSpec.paths[path];
                    for (const method in pathItem) {
                        if (Object.prototype.hasOwnProperty.call(pathItem, method) &&
                            ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].indexOf(method) >= 0) {
                            // Add all operations
                            this.addRestResource(path, method);
                        }
                    }
                }
            }
        }
    }
    /**
     * getFunctionForOperation
     */
    getFunctionForOperation(operationId) {
        return this._functions[operationId];
    }
    addRoute(path, method, handler) {
        const apiMethod = this.methodTransform(method);
        new apiGW.HttpRoute(this, `${apiMethod}${path}`, {
            httpApi: this.api,
            routeKey: apiGW.HttpRouteKey.with(path, apiMethod),
            integration: new apiGWInteg.LambdaProxyIntegration({ handler }),
        });
    }
    addRestResource(path, method) {
        var _a;
        const oaPath = this.apiSpec.paths[path];
        const operation = oaPath[method];
        const description = `${method} ${path} - ${operation.summary}`;
        const entryFile = `./src/lambda/rest.${operation.operationId}.ts`;
        if (!fs.existsSync(entryFile)) {
            this.createEntryFile(entryFile, method, operation);
        }
        const fn = new func_1.LambdaFunction(this, `Fn${operation.operationId}`, {
            stageName: this.props.stageName,
            additionalEnv: {
                DOMAIN_NAME: this.props.domainName,
                ...this.props.additionalEnv,
            },
            entry: entryFile,
            description: `[${this.props.stageName}] ${description}`,
            ...this.authentication && {
                userPool: (_a = this.authentication) === null || _a === void 0 ? void 0 : _a.userpool,
            },
            ...this.singleTableDatastore && {
                table: this.singleTableDatastore.table,
                tableWrites: this.tableWriteAccessForMethod(method),
            },
            ...this.assetCdn && {
                assetDomainName: this.assetCdn.assetDomainName,
                assetBucket: this.assetCdn.assetBucket,
            },
        });
        this._functions[operation.operationId] = fn;
        cdk.Tags.of(fn).add('OpenAPI', description);
        if (this.monitoring) {
            this.monitoring.lambdaDurationsWidget.addLeftMetric(fn.metricDuration());
            this.monitoring.lambdaInvokesWidget.addLeftMetric(fn.metricInvocations());
            this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricErrors());
            this.monitoring.lambdaErrorsWidget.addLeftMetric(fn.metricThrottles());
        }
        this.addRoute(path, method, fn);
        return fn;
    }
    createEntryFile(entryFile, method, operation) {
        let factoryCall;
        switch (method.toLowerCase()) {
            case 'post':
            case 'put':
            case 'patch':
                factoryCall = `http.createOpenApiHandlerWithRequestBody<operations['${operation.operationId}']>(async (ctx, data) => {`;
                break;
            case 'options':
            case 'delete':
            case 'get':
            case 'head':
            default:
                factoryCall = `http.createOpenApiHandler<operations['${operation.operationId}']>(async (ctx) => {`;
                break;
        }
        fs.writeFileSync(entryFile, `import { http, errors } from '@taimos/lambda-toolbox';
import { operations } from './types.generated';

export const handler = ${factoryCall}
  console.log(ctx.event);    
  throw new Error('Not yet implemented');
});`, {
            encoding: 'utf-8',
        });
    }
    tableWriteAccessForMethod(method) {
        switch (method.toLowerCase()) {
            case 'delete':
            case 'post':
            case 'put':
            case 'patch':
                return true;
            case 'options':
            case 'get':
            case 'head':
            default:
                return false;
        }
    }
    methodTransform(method) {
        switch (method.toLowerCase()) {
            case 'get':
                return apiGW.HttpMethod.GET;
            case 'delete':
                return apiGW.HttpMethod.DELETE;
            case 'post':
                return apiGW.HttpMethod.POST;
            case 'put':
                return apiGW.HttpMethod.PUT;
            case 'head':
                return apiGW.HttpMethod.HEAD;
            case 'options':
                return apiGW.HttpMethod.OPTIONS;
            case 'patch':
                return apiGW.HttpMethod.PATCH;
            default:
                return apiGW.HttpMethod.ANY;
        }
    }
}
exports.HttpApi = HttpApi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29uc3RydWN0cy9odHRwLWFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsdUNBQXlCO0FBQ3pCLGlFQUFtRDtBQUNuRCxtRkFBcUU7QUFDckUscUVBQXVEO0FBRXZELDhEQUFnRDtBQUNoRCw0RUFBOEQ7QUFDOUQsbURBQXFDO0FBQ3JDLDhDQUFnQztBQUVoQywyQ0FBc0Q7QUFDdEQsaUNBQTZEO0FBQzdELGlDQUF3QztBQUN4Qyw2Q0FBMEM7QUFDMUMsbUNBQTBFO0FBd0IxRSxNQUFhLE9BQW9CLFNBQVEsR0FBRyxDQUFDLFNBQVM7SUFZcEQsWUFBWSxLQUFvQixFQUFFLEVBQVUsRUFBVSxLQUFtQjs7UUFDdkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQURtQyxVQUFLLEdBQUwsS0FBSyxDQUFjO1FBRmpFLGVBQVUsR0FBOEMsRUFBRSxDQUFDO1FBS2pFLElBQUksS0FBSyxDQUFDLG9CQUFvQixFQUFFO1lBQzlCLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLDRCQUFvQixDQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUM7U0FDekc7UUFDRCxJQUFJLEtBQUssQ0FBQyxjQUFjLEVBQUU7WUFDeEIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLHFCQUFjLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztTQUN4RjtRQUNELElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRTtZQUNsQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksb0JBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNoRTtRQUVELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMs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QUMsVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUNqQyxLQUFLLE1BQU07Z0JBQ1QsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztZQUMvQixLQUFLLEtBQUs7Z0JBQ1IsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztZQUM5QixLQUFLLE1BQU07Z0JBQ1QsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztZQUMvQixLQUFLLFNBQVM7Z0JBQ1osT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztZQUNsQyxLQUFLLE9BQU87Z0JBQ1YsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztZQUNoQztnQkFDRSxPQUFPLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1NBQy9CO0lBQ0gsQ0FBQztDQUNGO0FBeE5ELDBCQXdOQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGFwaUdXIGZyb20gJ0Bhd3MtY2RrL2F3cy1hcGlnYXRld2F5djInO1xuaW1wb3J0ICogYXMgYXBpR1dJbnRlZyBmcm9tICdAYXdzLWNkay9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucyc7XG5pbXBvcnQgKiBhcyBhY20gZnJvbSAnQGF3cy1jZGsvYXdzLWNlcnRpZmljYXRlbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnQGF3cy1jZGsvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyByb3V0ZTUzIGZyb20gJ0Bhd3MtY2RrL2F3cy1yb3V0ZTUzJztcbmltcG9ydCAqIGFzIHJvdXRlNTNUYXJnZXQgZnJvbSAnQGF3cy1jZGsvYXdzLXJvdXRlNTMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyB5YW1sIGZyb20gJ2pzLXlhbWwnO1xuaW1wb3J0IHsgT3BlbkFQSTMsIE9wZXJhdGlvbk9iamVjdCwgUGF0aEl0ZW1PYmplY3QgfSBmcm9tICdvcGVuYXBpLXR5cGVzY3JpcHQnO1xuaW1wb3J0IHsgQXNzZXRDZG4sIEFzc2V0Q2RuUHJvcHMgfSBmcm9tICcuL2Fzc2V0LWNkbic7XG5pbXBvcnQgeyBBdXRoZW50aWNhdGlvbiwgQXV0aGVudGljYXRpb25Qcm9wcyB9IGZyb20gJy4vYXV0aCc7XG5pbXBvcnQgeyBMYW1iZGFGdW5jdGlvbiB9IGZyb20gJy4vZnVuYyc7XG5pbXBvcnQgeyBNb25pdG9yaW5nIH0gZnJvbSAnLi9tb25pdG9yaW5nJztcbmltcG9ydCB7IFNpbmdsZVRhYmxlRGF0YXN0b3JlLCBTaW5nbGVUYWJsZURhdGFzdG9yZVByb3BzIH0gZnJvbSAnLi90YWJsZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSHR0cEFwaVByb3BzIHtcbiAgYXBpTmFtZTogc3RyaW5nO1xuICBzdGFnZU5hbWU6IHN0cmluZztcbiAgZG9tYWluTmFtZTogc3RyaW5nO1xuICAvKipcbiAgICogSG9zdG5hbWUgb2YgdGhlIEFQSVxuICAgKlxuICAgKiBAZGVmYXVsdCBhcGlcbiAgICovXG4gIGFwaUhvc3RuYW1lPzogc3RyaW5nO1xuICBhdXRvR2VuZXJhdGVSb3V0ZXM/OiBib29sZWFuO1xuXG4gIG1vbml0b3Jpbmc/OiBib29sZWFuO1xuICBzaW5nbGVUYWJsZURhdGFzdG9yZT86IFNpbmdsZVRhYmxlRGF0YXN0b3JlUHJvcHM7XG4gIGF1dGhlbnRpY2F0aW9uPzogQXV0aGVudGljYXRpb25Qcm9wcztcbiAgYXNzZXRDZG4/OiBBc3NldENkblByb3BzO1xuXG4gIGFkZGl0aW9uYWxFbnY/OiB7XG4gICAgW2tleTogc3RyaW5nXTogc3RyaW5nO1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgSHR0cEFwaTxQQVRIUywgT1BTPiBleHRlbmRzIGNkay5Db25zdHJ1Y3Qge1xuXG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaUdXLkh0dHBBcGk7XG4gIHB1YmxpYyByZWFkb25seSBhcGlTcGVjOiBPcGVuQVBJMztcblxuICBwdWJsaWMgcmVhZG9ubHkgc2luZ2xlVGFibGVEYXRhc3RvcmU/OiBTaW5nbGVUYWJsZURhdGFzdG9yZTtcbiAgcHVibGljIHJlYWRvbmx5IGF1dGhlbnRpY2F0aW9uPzogQXV0aGVudGljYXRpb247XG4gIHB1YmxpYyByZWFkb25seSBhc3NldENkbj86IEFzc2V0Q2RuO1xuICBwdWJsaWMgcmVhZG9ubHkgbW9uaXRvcmluZz86IE1vbml0b3Jpbmc7XG5cbiAgcHJpdmF0ZSBfZnVuY3Rpb25zOiB7IFtvcGVyYXRpb25JZDogc3RyaW5nXTogTGFtYmRhRnVuY3Rpb24gfSA9IHt9O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcml2YXRlIHByb3BzOiBIdHRwQXBpUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgaWYgKHByb3BzLnNpbmdsZVRhYmxlRGF0YXN0b3JlKSB7XG4gICAgICB0aGlzLnNpbmdsZVRhYmxlRGF0YXN0b3JlID0gbmV3IFNpbmdsZVRhYmxlRGF0YXN0b3JlKHRoaXMsICdTaW5nbGVUYWJsZURTJywgcHJvcHMuc2luZ2xlVGFibGVEYXRhc3RvcmUpO1xuICAgIH1cbiAgICBpZiAocHJvcHMuYXV0aGVudGljYXRpb24pIHtcbiAgICAgIHRoaXMuYXV0aGVudGljYXRpb24gPSBuZXcgQXV0aGVudGljYXRpb24odGhpcywgJ0F1dGhlbnRpY2F0aW9uJywgcHJvcHMuYXV0aGVudGljYXRpb24pO1xuICAgIH1cbiAgICBpZiAocHJvcHMuYXNzZXRDZG4pIHtcbiAgICAgIHRoaXMuYXNzZXRDZG4gPSBuZXcgQXNzZXRDZG4odGhpcywgJ0Fzc2V0Q2RuJywgcHJvcHMuYXNzZXRDZG4pO1xuICAgIH1cblxuICAgIGNvbnN0IGhvc3RlZFpvbmUgPSByb3V0ZTUzLkhvc3RlZFpvbmUuZnJvbUxvb2t1cCh0aGlzLCAnWm9uZScsIHsgZG9tYWluTmFtZTogcHJvcHMuZG9tYWluTmFtZSB9KTtcbiAgICBjb25zdCBhcGlEb21haW5OYW1lID0gYCR7cHJvcHMuYXBpSG9zdG5hbWUgPz8gJ2FwaSd9LiR7cHJvcHMuZG9tYWluTmFtZX1gO1xuICAgIHRoaXMuYXBpU3BlYyA9IHlhbWwubG9hZChmcy5yZWFkRmlsZVN5bmMoJ29wZW5hcGkueWFtbCcpLnRvU3RyaW5nKCkpIGFzIE9wZW5BUEkzO1xuXG4gICAgY29uc3QgZG4gPSBuZXcgYXBpR1cuRG9tYWluTmFtZSh0aGlzLCAnRG9tYWluTmFtZScsIHtcbiAgICAgIGRvbWFpbk5hbWU6IGFwaURvbWFpbk5hbWUsXG4gICAgICBjZXJ0aWZpY2F0ZTogbmV3IGFjbS5DZXJ0aWZpY2F0ZSh0aGlzLCAnQ2VydCcsIHtcbiAgICAgICAgZG9tYWluTmFtZTogYXBpRG9tYWluTmFtZSxcbiAgICAgICAgdmFsaWRhdGlvbjogYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKGhvc3RlZFpvbmUpLFxuICAgICAgfSksXG4gICAgfSk7XG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpR1cuSHR0cEFwaSh0aGlzLCAnUmVzb3VyY2UnLCB7XG4gICAgICBhcGlOYW1lOiBgJHtwcm9wcy5hcGlOYW1lfSBbJHtwcm9wcy5zdGFnZU5hbWV9XWAsXG4gICAgICBkZWZhdWx0RG9tYWluTWFwcGluZzoge1xuICAgICAgICBkb21haW5OYW1lOiBkbixcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnRG5zUmVjb3JkJywge1xuICAgICAgem9uZTogaG9zdGVkWm9uZSxcbiAgICAgIHJlY29yZE5hbWU6IGFwaURvbWFpbk5hbWUsXG4gICAgICB0YXJnZXQ6IHJvdXRlNTMuUmVjb3JkVGFyZ2V0LmZyb21BbGlhcyhuZXcgcm91dGU1M1RhcmdldC5BcGlHYXRld2F5djJEb21haW4oZG4pKSxcbiAgICB9KTtcblxuICAgIGlmIChwcm9wcy5tb25pdG9yaW5nID8/IHRydWUpIHtcbiAgICAgIHRoaXMubW9uaXRvcmluZyA9IG5ldyBNb25pdG9yaW5nKHRoaXMsICdNb25pdG9yaW5nJywge1xuICAgICAgICBhcGlOYW1lOiB0aGlzLnByb3BzLmFwaU5hbWUsXG4gICAgICAgIHN0YWdlTmFtZTogdGhpcy5wcm9wcy5zdGFnZU5hbWUsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUVycm9yc1dpZGdldC5hZGRMZWZ0TWV0cmljKHRoaXMuYXBpLm1ldHJpY1NlcnZlckVycm9yKHtcbiAgICAgICAgc3RhdGlzdGljOiAnc3VtJyxcbiAgICAgIH0pKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlFcnJvcnNXaWRnZXQuYWRkTGVmdE1ldHJpYyh0aGlzLmFwaS5tZXRyaWNDbGllbnRFcnJvcih7XG4gICAgICAgIHN0YXRpc3RpYzogJ3N1bScsXG4gICAgICB9KSk7XG5cbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlMYXRlbmN5V2lkZ2V0LmFkZExlZnRNZXRyaWModGhpcy5hcGkubWV0cmljTGF0ZW5jeSh7XG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgfSkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUxhdGVuY3lXaWRnZXQuYWRkTGVmdE1ldHJpYyh0aGlzLmFwaS5tZXRyaWNMYXRlbmN5KHtcbiAgICAgICAgc3RhdGlzdGljOiAncDkwJyxcbiAgICAgIH0pKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5hcGlMYXRlbmN5VGFpbFdpZGdldC5hZGRMZWZ0TWV0cmljKHRoaXMuYXBpLm1ldHJpY0xhdGVuY3koe1xuICAgICAgICBzdGF0aXN0aWM6ICdwOTUnLFxuICAgICAgfSkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUxhdGVuY3lUYWlsV2lkZ2V0LmFkZExlZnRNZXRyaWModGhpcy5hcGkubWV0cmljTGF0ZW5jeSh7XG4gICAgICAgIHN0YXRpc3RpYzogJ3A5OScsXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgaWYgKHByb3BzLmF1dG9HZW5lcmF0ZVJvdXRlcyA/PyB0cnVlKSB7XG4gICAgICBmb3IgKGNvbnN0IHBhdGggaW4gdGhpcy5hcGlTcGVjLnBhdGhzKSB7XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodGhpcy5hcGlTcGVjLnBhdGhzLCBwYXRoKSkge1xuICAgICAgICAgIGNvbnN0IHBhdGhJdGVtID0gdGhpcy5hcGlTcGVjLnBhdGhzW3BhdGhdO1xuICAgICAgICAgIGZvciAoY29uc3QgbWV0aG9kIGluIHBhdGhJdGVtKSB7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHBhdGhJdGVtLCBtZXRob2QpICYmXG4gICAgICAgICAgICAgIFsnZ2V0JywgJ3Bvc3QnLCAncHV0JywgJ2RlbGV0ZScsICdwYXRjaCcsICdvcHRpb25zJywgJ2hlYWQnXS5pbmRleE9mKG1ldGhvZCkgPj0gMCkge1xuICAgICAgICAgICAgICAvLyBBZGQgYWxsIG9wZXJhdGlvbnNcbiAgICAgICAgICAgICAgdGhpcy5hZGRSZXN0UmVzb3VyY2UocGF0aCBhcyBhbnksIG1ldGhvZCBhcyBhbnkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICB9XG5cbiAgLyoqXG4gICAqIGdldEZ1bmN0aW9uRm9yT3BlcmF0aW9uXG4gICAqL1xuICBwdWJsaWMgZ2V0RnVuY3Rpb25Gb3JPcGVyYXRpb24ob3BlcmF0aW9uSWQ6IGtleW9mIE9QUyk6IExhbWJkYUZ1bmN0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5fZnVuY3Rpb25zW29wZXJhdGlvbklkIGFzIHN0cmluZ107XG4gIH1cblxuICBwdWJsaWMgYWRkUm91dGU8UCBleHRlbmRzIGtleW9mIFBBVEhTPihwYXRoOiBQLCBtZXRob2Q6IGtleW9mIFBBVEhTW1BdLCBoYW5kbGVyOiBsYW1iZGEuRnVuY3Rpb24pIHtcbiAgICBjb25zdCBhcGlNZXRob2QgPSB0aGlzLm1ldGhvZFRyYW5zZm9ybShtZXRob2QgYXMgc3RyaW5nKTtcbiAgICBuZXcgYXBpR1cuSHR0cFJvdXRlKHRoaXMsIGAke2FwaU1ldGhvZH0ke3BhdGh9YCwge1xuICAgICAgaHR0cEFwaTogdGhpcy5hcGksXG4gICAgICByb3V0ZUtleTogYXBpR1cuSHR0cFJvdXRlS2V5LndpdGgocGF0aCBhcyBzdHJpbmcsIGFwaU1ldGhvZCksXG4gICAgICBpbnRlZ3JhdGlvbjogbmV3IGFwaUdXSW50ZWcuTGFtYmRhUHJveHlJbnRlZ3JhdGlvbih7IGhhbmRsZXIgfSksXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgYWRkUmVzdFJlc291cmNlPFAgZXh0ZW5kcyBrZXlvZiBQQVRIUz4ocGF0aDogUCwgbWV0aG9kOiBrZXlvZiBQQVRIU1tQXSkge1xuICAgIGNvbnN0IG9hUGF0aCA9IHRoaXMuYXBpU3BlYy5wYXRocyFbcGF0aCBhcyBzdHJpbmddO1xuICAgIGNvbnN0IG9wZXJhdGlvbiA9IG9hUGF0aFttZXRob2QgYXMga2V5b2YgUGF0aEl0ZW1PYmplY3RdIGFzIE9wZXJhdGlvbk9iamVjdDtcbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGAke21ldGhvZH0gJHtwYXRofSAtICR7b3BlcmF0aW9uLnN1bW1hcnl9YDtcblxuICAgIGNvbnN0IGVudHJ5RmlsZSA9IGAuL3NyYy9sYW1iZGEvcmVzdC4ke29wZXJhdGlvbi5vcGVyYXRpb25JZH0udHNgO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhlbnRyeUZpbGUpKSB7XG4gICAgICB0aGlzLmNyZWF0ZUVudHJ5RmlsZShlbnRyeUZpbGUsIG1ldGhvZCBhcyBzdHJpbmcsIG9wZXJhdGlvbik7XG4gICAgfVxuXG4gICAgY29uc3QgZm4gPSBuZXcgTGFtYmRhRnVuY3Rpb24odGhpcywgYEZuJHtvcGVyYXRpb24ub3BlcmF0aW9uSWR9YCwge1xuICAgICAgc3RhZ2VOYW1lOiB0aGlzLnByb3BzLnN0YWdlTmFtZSxcbiAgICAgIGFkZGl0aW9uYWxFbnY6IHtcbiAgICAgICAgRE9NQUlOX05BTUU6IHRoaXMucHJvcHMuZG9tYWluTmFtZSxcbiAgICAgICAgLi4udGhpcy5wcm9wcy5hZGRpdGlvbmFsRW52LFxuICAgICAgfSxcbiAgICAgIGVudHJ5OiBlbnRyeUZpbGUsXG4gICAgICBkZXNjcmlwdGlvbjogYFske3RoaXMucHJvcHMuc3RhZ2VOYW1lfV0gJHtkZXNjcmlwdGlvbn1gLFxuICAgICAgLi4udGhpcy5hdXRoZW50aWNhdGlvbiAmJiB7XG4gICAgICAgIHVzZXJQb29sOiB0aGlzLmF1dGhlbnRpY2F0aW9uPy51c2VycG9vbCxcbiAgICAgIH0sXG4gICAgICAuLi50aGlzLnNpbmdsZVRhYmxlRGF0YXN0b3JlICYmIHtcbiAgICAgICAgdGFibGU6IHRoaXMuc2luZ2xlVGFibGVEYXRhc3RvcmUudGFibGUsXG4gICAgICAgIHRhYmxlV3JpdGVzOiB0aGlzLnRhYmxlV3JpdGVBY2Nlc3NGb3JNZXRob2QobWV0aG9kIGFzIHN0cmluZyksXG4gICAgICB9LFxuICAgICAgLi4udGhpcy5hc3NldENkbiAmJiB7XG4gICAgICAgIGFzc2V0RG9tYWluTmFtZTogdGhpcy5hc3NldENkbi5hc3NldERvbWFpbk5hbWUsXG4gICAgICAgIGFzc2V0QnVja2V0OiB0aGlzLmFzc2V0Q2RuLmFzc2V0QnVja2V0LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICB0aGlzLl9mdW5jdGlvbnNbb3BlcmF0aW9uLm9wZXJhdGlvbklkIGFzIHN0cmluZ10gPSBmbjtcbiAgICBjZGsuVGFncy5vZihmbikuYWRkKCdPcGVuQVBJJywgZGVzY3JpcHRpb24pO1xuXG4gICAgaWYgKHRoaXMubW9uaXRvcmluZykge1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmxhbWJkYUR1cmF0aW9uc1dpZGdldC5hZGRMZWZ0TWV0cmljKGZuLm1ldHJpY0R1cmF0aW9uKCkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmxhbWJkYUludm9rZXNXaWRnZXQuYWRkTGVmdE1ldHJpYyhmbi5tZXRyaWNJbnZvY2F0aW9ucygpKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5sYW1iZGFFcnJvcnNXaWRnZXQuYWRkTGVmdE1ldHJpYyhmbi5tZXRyaWNFcnJvcnMoKSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcubGFtYmRhRXJyb3JzV2lkZ2V0LmFkZExlZnRNZXRyaWMoZm4ubWV0cmljVGhyb3R0bGVzKCkpO1xuICAgIH1cblxuICAgIHRoaXMuYWRkUm91dGUocGF0aCwgbWV0aG9kLCBmbik7XG5cbiAgICByZXR1cm4gZm47XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUVudHJ5RmlsZShlbnRyeUZpbGU6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIG9wZXJhdGlvbjogT3BlcmF0aW9uT2JqZWN0KSB7XG4gICAgbGV0IGZhY3RvcnlDYWxsO1xuICAgIHN3aXRjaCAobWV0aG9kLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJ3Bvc3QnOlxuICAgICAgY2FzZSAncHV0JzpcbiAgICAgIGNhc2UgJ3BhdGNoJzpcbiAgICAgICAgZmFjdG9yeUNhbGwgPSBgaHR0cC5jcmVhdGVPcGVuQXBpSGFuZGxlcldpdGhSZXF1ZXN0Qm9keTxvcGVyYXRpb25zWycke29wZXJhdGlvbi5vcGVyYXRpb25JZH0nXT4oYXN5bmMgKGN0eCwgZGF0YSkgPT4ge2A7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnb3B0aW9ucyc6XG4gICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgY2FzZSAnZ2V0JzpcbiAgICAgIGNhc2UgJ2hlYWQnOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgZmFjdG9yeUNhbGwgPSBgaHR0cC5jcmVhdGVPcGVuQXBpSGFuZGxlcjxvcGVyYXRpb25zWycke29wZXJhdGlvbi5vcGVyYXRpb25JZH0nXT4oYXN5bmMgKGN0eCkgPT4ge2A7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGZzLndyaXRlRmlsZVN5bmMoZW50cnlGaWxlLCBgaW1wb3J0IHsgaHR0cCwgZXJyb3JzIH0gZnJvbSAnQHRhaW1vcy9sYW1iZGEtdG9vbGJveCc7XG5pbXBvcnQgeyBvcGVyYXRpb25zIH0gZnJvbSAnLi90eXBlcy5nZW5lcmF0ZWQnO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlciA9ICR7ZmFjdG9yeUNhbGx9XG4gIGNvbnNvbGUubG9nKGN0eC5ldmVudCk7ICAgIFxuICB0aHJvdyBuZXcgRXJyb3IoJ05vdCB5ZXQgaW1wbGVtZW50ZWQnKTtcbn0pO2AsIHtcbiAgICAgIGVuY29kaW5nOiAndXRmLTgnLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB0YWJsZVdyaXRlQWNjZXNzRm9yTWV0aG9kKG1ldGhvZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgc3dpdGNoIChtZXRob2QudG9Mb3dlckNhc2UoKSkge1xuICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgIGNhc2UgJ3Bvc3QnOlxuICAgICAgY2FzZSAncHV0JzpcbiAgICAgIGNhc2UgJ3BhdGNoJzpcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICBjYXNlICdvcHRpb25zJzpcbiAgICAgIGNhc2UgJ2dldCc6XG4gICAgICBjYXNlICdoZWFkJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG1ldGhvZFRyYW5zZm9ybShtZXRob2Q6IHN0cmluZykge1xuICAgIHN3aXRjaCAobWV0aG9kLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJ2dldCc6XG4gICAgICAgIHJldHVybiBhcGlHVy5IdHRwTWV0aG9kLkdFVDtcbiAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgIHJldHVybiBhcGlHVy5IdHRwTWV0aG9kLkRFTEVURTtcbiAgICAgIGNhc2UgJ3Bvc3QnOlxuICAgICAgICByZXR1cm4gYXBpR1cuSHR0cE1ldGhvZC5QT1NUO1xuICAgICAgY2FzZSAncHV0JzpcbiAgICAgICAgcmV0dXJuIGFwaUdXLkh0dHBNZXRob2QuUFVUO1xuICAgICAgY2FzZSAnaGVhZCc6XG4gICAgICAgIHJldHVybiBhcGlHVy5IdHRwTWV0aG9kLkhFQUQ7XG4gICAgICBjYXNlICdvcHRpb25zJzpcbiAgICAgICAgcmV0dXJuIGFwaUdXLkh0dHBNZXRob2QuT1BUSU9OUztcbiAgICAgIGNhc2UgJ3BhdGNoJzpcbiAgICAgICAgcmV0dXJuIGFwaUdXLkh0dHBNZXRob2QuUEFUQ0g7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gYXBpR1cuSHR0cE1ldGhvZC5BTlk7XG4gICAgfVxuICB9XG59Il19