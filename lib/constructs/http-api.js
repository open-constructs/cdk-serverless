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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29uc3RydWN0cy9odHRwLWFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsdUNBQXlCO0FBQ3pCLGlFQUFtRDtBQUNuRCxtRkFBcUU7QUFDckUscUVBQXVEO0FBRXZELDhEQUFnRDtBQUNoRCw0RUFBOEQ7QUFDOUQsbURBQXFDO0FBQ3JDLDhDQUFnQztBQUVoQywyQ0FBc0Q7QUFDdEQsaUNBQTZEO0FBQzdELGlDQUF3QztBQUN4Qyw2Q0FBMEM7QUFDMUMsbUNBQTBFO0FBd0IxRSxNQUFhLE9BQW9CLFNBQVEsR0FBRyxDQUFDLFNBQVM7SUFZcEQsWUFBWSxLQUFvQixFQUFFLEVBQVUsRUFBVSxLQUFtQjs7UUFDdkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQURtQyxVQUFLLEdBQUwsS0FBSyxDQUFjO1FBRmpFLGVBQVUsR0FBOEMsRUFBRSxDQUFDO1FBS2pFLElBQUksS0FBSyxDQUFDLG9CQUFvQixFQUFFO1lBQzlCLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLDRCQUFvQixDQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUM7U0FDekc7UUFDRCxJQUFJLEtBQUssQ0FBQyxjQUFjLEVBQUU7WUFDeEIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLHFCQUFjLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztTQUN4RjtRQUNELElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRTtZQUNsQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksb0JBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNoRTtRQUVELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMs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QUMsVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUNqQyxLQUFLLE1BQU07Z0JBQ1QsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztZQUMvQixLQUFLLEtBQUs7Z0JBQ1IsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztZQUM5QixLQUFLLE1BQU07Z0JBQ1QsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztZQUMvQixLQUFLLFNBQVM7Z0JBQ1osT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztZQUNsQyxLQUFLLE9BQU87Z0JBQ1YsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztZQUNoQztnQkFDRSxPQUFPLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1NBQy9CO0lBQ0gsQ0FBQztDQUNGO0FBeE5ELDBCQXdOQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIGFwaUdXIGZyb20gJ0Bhd3MtY2RrL2F3cy1hcGlnYXRld2F5djInO1xuaW1wb3J0ICogYXMgYXBpR1dJbnRlZyBmcm9tICdAYXdzLWNkay9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucyc7XG5pbXBvcnQgKiBhcyBhY20gZnJvbSAnQGF3cy1jZGsvYXdzLWNlcnRpZmljYXRlbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnQGF3cy1jZGsvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyByb3V0ZTUzIGZyb20gJ0Bhd3MtY2RrL2F3cy1yb3V0ZTUzJztcbmltcG9ydCAqIGFzIHJvdXRlNTNUYXJnZXQgZnJvbSAnQGF3cy1jZGsvYXdzLXJvdXRlNTMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyB5YW1sIGZyb20gJ2pzLXlhbWwnO1xuaW1wb3J0IHsgT3BlbkFQSTMsIE9wZXJhdGlvbk9iamVjdCwgUGF0aEl0ZW1PYmplY3QgfSBmcm9tICdvcGVuYXBpLXR5cGVzY3JpcHQvZGlzdC10eXBlcy90eXBlcyc7XG5pbXBvcnQgeyBBc3NldENkbiwgQXNzZXRDZG5Qcm9wcyB9IGZyb20gJy4vYXNzZXQtY2RuJztcbmltcG9ydCB7IEF1dGhlbnRpY2F0aW9uLCBBdXRoZW50aWNhdGlvblByb3BzIH0gZnJvbSAnLi9hdXRoJztcbmltcG9ydCB7IExhbWJkYUZ1bmN0aW9uIH0gZnJvbSAnLi9mdW5jJztcbmltcG9ydCB7IE1vbml0b3JpbmcgfSBmcm9tICcuL21vbml0b3JpbmcnO1xuaW1wb3J0IHsgU2luZ2xlVGFibGVEYXRhc3RvcmUsIFNpbmdsZVRhYmxlRGF0YXN0b3JlUHJvcHMgfSBmcm9tICcuL3RhYmxlJztcblxuZXhwb3J0IGludGVyZmFjZSBIdHRwQXBpUHJvcHMge1xuICBhcGlOYW1lOiBzdHJpbmc7XG4gIHN0YWdlTmFtZTogc3RyaW5nO1xuICBkb21haW5OYW1lOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBIb3N0bmFtZSBvZiB0aGUgQVBJXG4gICAqXG4gICAqIEBkZWZhdWx0IGFwaVxuICAgKi9cbiAgYXBpSG9zdG5hbWU/OiBzdHJpbmc7XG4gIGF1dG9HZW5lcmF0ZVJvdXRlcz86IGJvb2xlYW47XG5cbiAgbW9uaXRvcmluZz86IGJvb2xlYW47XG4gIHNpbmdsZVRhYmxlRGF0YXN0b3JlPzogU2luZ2xlVGFibGVEYXRhc3RvcmVQcm9wcztcbiAgYXV0aGVudGljYXRpb24/OiBBdXRoZW50aWNhdGlvblByb3BzO1xuICBhc3NldENkbj86IEFzc2V0Q2RuUHJvcHM7XG5cbiAgYWRkaXRpb25hbEVudj86IHtcbiAgICBba2V5OiBzdHJpbmddOiBzdHJpbmc7XG4gIH07XG59XG5cbmV4cG9ydCBjbGFzcyBIdHRwQXBpPFBBVEhTLCBPUFM+IGV4dGVuZHMgY2RrLkNvbnN0cnVjdCB7XG5cbiAgcHVibGljIHJlYWRvbmx5IGFwaTogYXBpR1cuSHR0cEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IGFwaVNwZWM6IE9wZW5BUEkzO1xuXG4gIHB1YmxpYyByZWFkb25seSBzaW5nbGVUYWJsZURhdGFzdG9yZT86IFNpbmdsZVRhYmxlRGF0YXN0b3JlO1xuICBwdWJsaWMgcmVhZG9ubHkgYXV0aGVudGljYXRpb24/OiBBdXRoZW50aWNhdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFzc2V0Q2RuPzogQXNzZXRDZG47XG4gIHB1YmxpYyByZWFkb25seSBtb25pdG9yaW5nPzogTW9uaXRvcmluZztcblxuICBwcml2YXRlIF9mdW5jdGlvbnM6IHsgW29wZXJhdGlvbklkOiBzdHJpbmddOiBMYW1iZGFGdW5jdGlvbiB9ID0ge307XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByaXZhdGUgcHJvcHM6IEh0dHBBcGlQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBpZiAocHJvcHMuc2luZ2xlVGFibGVEYXRhc3RvcmUpIHtcbiAgICAgIHRoaXMuc2luZ2xlVGFibGVEYXRhc3RvcmUgPSBuZXcgU2luZ2xlVGFibGVEYXRhc3RvcmUodGhpcywgJ1NpbmdsZVRhYmxlRFMnLCBwcm9wcy5zaW5nbGVUYWJsZURhdGFzdG9yZSk7XG4gICAgfVxuICAgIGlmIChwcm9wcy5hdXRoZW50aWNhdGlvbikge1xuICAgICAgdGhpcy5hdXRoZW50aWNhdGlvbiA9IG5ldyBBdXRoZW50aWNhdGlvbih0aGlzLCAnQXV0aGVudGljYXRpb24nLCBwcm9wcy5hdXRoZW50aWNhdGlvbik7XG4gICAgfVxuICAgIGlmIChwcm9wcy5hc3NldENkbikge1xuICAgICAgdGhpcy5hc3NldENkbiA9IG5ldyBBc3NldENkbih0aGlzLCAnQXNzZXRDZG4nLCBwcm9wcy5hc3NldENkbik7XG4gICAgfVxuXG4gICAgY29uc3QgaG9zdGVkWm9uZSA9IHJvdXRlNTMuSG9zdGVkWm9uZS5mcm9tTG9va3VwKHRoaXMsICdab25lJywgeyBkb21haW5OYW1lOiBwcm9wcy5kb21haW5OYW1lIH0pO1xuICAgIGNvbnN0IGFwaURvbWFpbk5hbWUgPSBgJHtwcm9wcy5hcGlIb3N0bmFtZSA/PyAnYXBpJ30uJHtwcm9wcy5kb21haW5OYW1lfWA7XG4gICAgdGhpcy5hcGlTcGVjID0geWFtbC5sb2FkKGZzLnJlYWRGaWxlU3luYygnb3BlbmFwaS55YW1sJykudG9TdHJpbmcoKSkgYXMgT3BlbkFQSTM7XG5cbiAgICBjb25zdCBkbiA9IG5ldyBhcGlHVy5Eb21haW5OYW1lKHRoaXMsICdEb21haW5OYW1lJywge1xuICAgICAgZG9tYWluTmFtZTogYXBpRG9tYWluTmFtZSxcbiAgICAgIGNlcnRpZmljYXRlOiBuZXcgYWNtLkNlcnRpZmljYXRlKHRoaXMsICdDZXJ0Jywge1xuICAgICAgICBkb21haW5OYW1lOiBhcGlEb21haW5OYW1lLFxuICAgICAgICB2YWxpZGF0aW9uOiBhY20uQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnMoaG9zdGVkWm9uZSksXG4gICAgICB9KSxcbiAgICB9KTtcbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlHVy5IdHRwQXBpKHRoaXMsICdSZXNvdXJjZScsIHtcbiAgICAgIGFwaU5hbWU6IGAke3Byb3BzLmFwaU5hbWV9IFske3Byb3BzLnN0YWdlTmFtZX1dYCxcbiAgICAgIGRlZmF1bHREb21haW5NYXBwaW5nOiB7XG4gICAgICAgIGRvbWFpbk5hbWU6IGRuLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBuZXcgcm91dGU1My5BUmVjb3JkKHRoaXMsICdEbnNSZWNvcmQnLCB7XG4gICAgICB6b25lOiBob3N0ZWRab25lLFxuICAgICAgcmVjb3JkTmFtZTogYXBpRG9tYWluTmFtZSxcbiAgICAgIHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKG5ldyByb3V0ZTUzVGFyZ2V0LkFwaUdhdGV3YXl2MkRvbWFpbihkbikpLFxuICAgIH0pO1xuXG4gICAgaWYgKHByb3BzLm1vbml0b3JpbmcgPz8gdHJ1ZSkge1xuICAgICAgdGhpcy5tb25pdG9yaW5nID0gbmV3IE1vbml0b3JpbmcodGhpcywgJ01vbml0b3JpbmcnLCB7XG4gICAgICAgIGFwaU5hbWU6IHRoaXMucHJvcHMuYXBpTmFtZSxcbiAgICAgICAgc3RhZ2VOYW1lOiB0aGlzLnByb3BzLnN0YWdlTmFtZSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpRXJyb3JzV2lkZ2V0LmFkZExlZnRNZXRyaWModGhpcy5hcGkubWV0cmljU2VydmVyRXJyb3Ioe1xuICAgICAgICBzdGF0aXN0aWM6ICdzdW0nLFxuICAgICAgfSkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUVycm9yc1dpZGdldC5hZGRMZWZ0TWV0cmljKHRoaXMuYXBpLm1ldHJpY0NsaWVudEVycm9yKHtcbiAgICAgICAgc3RhdGlzdGljOiAnc3VtJyxcbiAgICAgIH0pKTtcblxuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUxhdGVuY3lXaWRnZXQuYWRkTGVmdE1ldHJpYyh0aGlzLmFwaS5tZXRyaWNMYXRlbmN5KHtcbiAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICB9KSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpTGF0ZW5jeVdpZGdldC5hZGRMZWZ0TWV0cmljKHRoaXMuYXBpLm1ldHJpY0xhdGVuY3koe1xuICAgICAgICBzdGF0aXN0aWM6ICdwOTAnLFxuICAgICAgfSkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmFwaUxhdGVuY3lUYWlsV2lkZ2V0LmFkZExlZnRNZXRyaWModGhpcy5hcGkubWV0cmljTGF0ZW5jeSh7XG4gICAgICAgIHN0YXRpc3RpYzogJ3A5NScsXG4gICAgICB9KSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcuYXBpTGF0ZW5jeVRhaWxXaWRnZXQuYWRkTGVmdE1ldHJpYyh0aGlzLmFwaS5tZXRyaWNMYXRlbmN5KHtcbiAgICAgICAgc3RhdGlzdGljOiAncDk5JyxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICBpZiAocHJvcHMuYXV0b0dlbmVyYXRlUm91dGVzID8/IHRydWUpIHtcbiAgICAgIGZvciAoY29uc3QgcGF0aCBpbiB0aGlzLmFwaVNwZWMucGF0aHMpIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLmFwaVNwZWMucGF0aHMsIHBhdGgpKSB7XG4gICAgICAgICAgY29uc3QgcGF0aEl0ZW0gPSB0aGlzLmFwaVNwZWMucGF0aHNbcGF0aF07XG4gICAgICAgICAgZm9yIChjb25zdCBtZXRob2QgaW4gcGF0aEl0ZW0pIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocGF0aEl0ZW0sIG1ldGhvZCkgJiZcbiAgICAgICAgICAgICAgWydnZXQnLCAncG9zdCcsICdwdXQnLCAnZGVsZXRlJywgJ3BhdGNoJywgJ29wdGlvbnMnLCAnaGVhZCddLmluZGV4T2YobWV0aG9kKSA+PSAwKSB7XG4gICAgICAgICAgICAgIC8vIEFkZCBhbGwgb3BlcmF0aW9uc1xuICAgICAgICAgICAgICB0aGlzLmFkZFJlc3RSZXNvdXJjZShwYXRoIGFzIGFueSwgbWV0aG9kIGFzIGFueSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gIH1cblxuICAvKipcbiAgICogZ2V0RnVuY3Rpb25Gb3JPcGVyYXRpb25cbiAgICovXG4gIHB1YmxpYyBnZXRGdW5jdGlvbkZvck9wZXJhdGlvbihvcGVyYXRpb25JZDoga2V5b2YgT1BTKTogTGFtYmRhRnVuY3Rpb24ge1xuICAgIHJldHVybiB0aGlzLl9mdW5jdGlvbnNbb3BlcmF0aW9uSWQgYXMgc3RyaW5nXTtcbiAgfVxuXG4gIHB1YmxpYyBhZGRSb3V0ZTxQIGV4dGVuZHMga2V5b2YgUEFUSFM+KHBhdGg6IFAsIG1ldGhvZDoga2V5b2YgUEFUSFNbUF0sIGhhbmRsZXI6IGxhbWJkYS5GdW5jdGlvbikge1xuICAgIGNvbnN0IGFwaU1ldGhvZCA9IHRoaXMubWV0aG9kVHJhbnNmb3JtKG1ldGhvZCBhcyBzdHJpbmcpO1xuICAgIG5ldyBhcGlHVy5IdHRwUm91dGUodGhpcywgYCR7YXBpTWV0aG9kfSR7cGF0aH1gLCB7XG4gICAgICBodHRwQXBpOiB0aGlzLmFwaSxcbiAgICAgIHJvdXRlS2V5OiBhcGlHVy5IdHRwUm91dGVLZXkud2l0aChwYXRoIGFzIHN0cmluZywgYXBpTWV0aG9kKSxcbiAgICAgIGludGVncmF0aW9uOiBuZXcgYXBpR1dJbnRlZy5MYW1iZGFQcm94eUludGVncmF0aW9uKHsgaGFuZGxlciB9KSxcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBhZGRSZXN0UmVzb3VyY2U8UCBleHRlbmRzIGtleW9mIFBBVEhTPihwYXRoOiBQLCBtZXRob2Q6IGtleW9mIFBBVEhTW1BdKSB7XG4gICAgY29uc3Qgb2FQYXRoID0gdGhpcy5hcGlTcGVjLnBhdGhzIVtwYXRoIGFzIHN0cmluZ107XG4gICAgY29uc3Qgb3BlcmF0aW9uID0gb2FQYXRoW21ldGhvZCBhcyBrZXlvZiBQYXRoSXRlbU9iamVjdF0gYXMgT3BlcmF0aW9uT2JqZWN0O1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gYCR7bWV0aG9kfSAke3BhdGh9IC0gJHtvcGVyYXRpb24uc3VtbWFyeX1gO1xuXG4gICAgY29uc3QgZW50cnlGaWxlID0gYC4vc3JjL2xhbWJkYS9yZXN0LiR7b3BlcmF0aW9uLm9wZXJhdGlvbklkfS50c2A7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGVudHJ5RmlsZSkpIHtcbiAgICAgIHRoaXMuY3JlYXRlRW50cnlGaWxlKGVudHJ5RmlsZSwgbWV0aG9kIGFzIHN0cmluZywgb3BlcmF0aW9uKTtcbiAgICB9XG5cbiAgICBjb25zdCBmbiA9IG5ldyBMYW1iZGFGdW5jdGlvbih0aGlzLCBgRm4ke29wZXJhdGlvbi5vcGVyYXRpb25JZH1gLCB7XG4gICAgICBzdGFnZU5hbWU6IHRoaXMucHJvcHMuc3RhZ2VOYW1lLFxuICAgICAgYWRkaXRpb25hbEVudjoge1xuICAgICAgICBET01BSU5fTkFNRTogdGhpcy5wcm9wcy5kb21haW5OYW1lLFxuICAgICAgICAuLi50aGlzLnByb3BzLmFkZGl0aW9uYWxFbnYsXG4gICAgICB9LFxuICAgICAgZW50cnk6IGVudHJ5RmlsZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgWyR7dGhpcy5wcm9wcy5zdGFnZU5hbWV9XSAke2Rlc2NyaXB0aW9ufWAsXG4gICAgICAuLi50aGlzLmF1dGhlbnRpY2F0aW9uICYmIHtcbiAgICAgICAgdXNlclBvb2w6IHRoaXMuYXV0aGVudGljYXRpb24/LnVzZXJwb29sLFxuICAgICAgfSxcbiAgICAgIC4uLnRoaXMuc2luZ2xlVGFibGVEYXRhc3RvcmUgJiYge1xuICAgICAgICB0YWJsZTogdGhpcy5zaW5nbGVUYWJsZURhdGFzdG9yZS50YWJsZSxcbiAgICAgICAgdGFibGVXcml0ZXM6IHRoaXMudGFibGVXcml0ZUFjY2Vzc0Zvck1ldGhvZChtZXRob2QgYXMgc3RyaW5nKSxcbiAgICAgIH0sXG4gICAgICAuLi50aGlzLmFzc2V0Q2RuICYmIHtcbiAgICAgICAgYXNzZXREb21haW5OYW1lOiB0aGlzLmFzc2V0Q2RuLmFzc2V0RG9tYWluTmFtZSxcbiAgICAgICAgYXNzZXRCdWNrZXQ6IHRoaXMuYXNzZXRDZG4uYXNzZXRCdWNrZXQsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuX2Z1bmN0aW9uc1tvcGVyYXRpb24ub3BlcmF0aW9uSWQgYXMgc3RyaW5nXSA9IGZuO1xuICAgIGNkay5UYWdzLm9mKGZuKS5hZGQoJ09wZW5BUEknLCBkZXNjcmlwdGlvbik7XG5cbiAgICBpZiAodGhpcy5tb25pdG9yaW5nKSB7XG4gICAgICB0aGlzLm1vbml0b3JpbmcubGFtYmRhRHVyYXRpb25zV2lkZ2V0LmFkZExlZnRNZXRyaWMoZm4ubWV0cmljRHVyYXRpb24oKSk7XG4gICAgICB0aGlzLm1vbml0b3JpbmcubGFtYmRhSW52b2tlc1dpZGdldC5hZGRMZWZ0TWV0cmljKGZuLm1ldHJpY0ludm9jYXRpb25zKCkpO1xuICAgICAgdGhpcy5tb25pdG9yaW5nLmxhbWJkYUVycm9yc1dpZGdldC5hZGRMZWZ0TWV0cmljKGZuLm1ldHJpY0Vycm9ycygpKTtcbiAgICAgIHRoaXMubW9uaXRvcmluZy5sYW1iZGFFcnJvcnNXaWRnZXQuYWRkTGVmdE1ldHJpYyhmbi5tZXRyaWNUaHJvdHRsZXMoKSk7XG4gICAgfVxuXG4gICAgdGhpcy5hZGRSb3V0ZShwYXRoLCBtZXRob2QsIGZuKTtcblxuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRW50cnlGaWxlKGVudHJ5RmlsZTogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgb3BlcmF0aW9uOiBPcGVyYXRpb25PYmplY3QpIHtcbiAgICBsZXQgZmFjdG9yeUNhbGw7XG4gICAgc3dpdGNoIChtZXRob2QudG9Mb3dlckNhc2UoKSkge1xuICAgICAgY2FzZSAncG9zdCc6XG4gICAgICBjYXNlICdwdXQnOlxuICAgICAgY2FzZSAncGF0Y2gnOlxuICAgICAgICBmYWN0b3J5Q2FsbCA9IGBodHRwLmNyZWF0ZU9wZW5BcGlIYW5kbGVyV2l0aFJlcXVlc3RCb2R5PG9wZXJhdGlvbnNbJyR7b3BlcmF0aW9uLm9wZXJhdGlvbklkfSddPihhc3luYyAoY3R4LCBkYXRhKSA9PiB7YDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdvcHRpb25zJzpcbiAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICBjYXNlICdnZXQnOlxuICAgICAgY2FzZSAnaGVhZCc6XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBmYWN0b3J5Q2FsbCA9IGBodHRwLmNyZWF0ZU9wZW5BcGlIYW5kbGVyPG9wZXJhdGlvbnNbJyR7b3BlcmF0aW9uLm9wZXJhdGlvbklkfSddPihhc3luYyAoY3R4KSA9PiB7YDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgZnMud3JpdGVGaWxlU3luYyhlbnRyeUZpbGUsIGBpbXBvcnQgeyBodHRwLCBlcnJvcnMgfSBmcm9tICdAdGFpbW9zL2xhbWJkYS10b29sYm94JztcbmltcG9ydCB7IG9wZXJhdGlvbnMgfSBmcm9tICcuL3R5cGVzLmdlbmVyYXRlZCc7XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gJHtmYWN0b3J5Q2FsbH1cbiAgY29uc29sZS5sb2coY3R4LmV2ZW50KTsgICAgXG4gIHRocm93IG5ldyBFcnJvcignTm90IHlldCBpbXBsZW1lbnRlZCcpO1xufSk7YCwge1xuICAgICAgZW5jb2Rpbmc6ICd1dGYtOCcsXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHRhYmxlV3JpdGVBY2Nlc3NGb3JNZXRob2QobWV0aG9kOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBzd2l0Y2ggKG1ldGhvZC50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgY2FzZSAncG9zdCc6XG4gICAgICBjYXNlICdwdXQnOlxuICAgICAgY2FzZSAncGF0Y2gnOlxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIGNhc2UgJ29wdGlvbnMnOlxuICAgICAgY2FzZSAnZ2V0JzpcbiAgICAgIGNhc2UgJ2hlYWQnOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgbWV0aG9kVHJhbnNmb3JtKG1ldGhvZDogc3RyaW5nKSB7XG4gICAgc3dpdGNoIChtZXRob2QudG9Mb3dlckNhc2UoKSkge1xuICAgICAgY2FzZSAnZ2V0JzpcbiAgICAgICAgcmV0dXJuIGFwaUdXLkh0dHBNZXRob2QuR0VUO1xuICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgcmV0dXJuIGFwaUdXLkh0dHBNZXRob2QuREVMRVRFO1xuICAgICAgY2FzZSAncG9zdCc6XG4gICAgICAgIHJldHVybiBhcGlHVy5IdHRwTWV0aG9kLlBPU1Q7XG4gICAgICBjYXNlICdwdXQnOlxuICAgICAgICByZXR1cm4gYXBpR1cuSHR0cE1ldGhvZC5QVVQ7XG4gICAgICBjYXNlICdoZWFkJzpcbiAgICAgICAgcmV0dXJuIGFwaUdXLkh0dHBNZXRob2QuSEVBRDtcbiAgICAgIGNhc2UgJ29wdGlvbnMnOlxuICAgICAgICByZXR1cm4gYXBpR1cuSHR0cE1ldGhvZC5PUFRJT05TO1xuICAgICAgY2FzZSAncGF0Y2gnOlxuICAgICAgICByZXR1cm4gYXBpR1cuSHR0cE1ldGhvZC5QQVRDSDtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBhcGlHVy5IdHRwTWV0aG9kLkFOWTtcbiAgICB9XG4gIH1cbn0iXX0=