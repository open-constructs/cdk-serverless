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
exports.GraphQlApiAspect = void 0;
const pj = __importStar(require("projen"));
class GraphQlApiAspect extends pj.Component {
    constructor(app, _options = {}) {
        var _a;
        super(app);
        app.addDevDeps('@types/aws-lambda', '@graphql-codegen/cli', '@graphql-codegen/typescript', 'graphql');
        app.addCdkDependency('@aws-cdk/core', '@aws-cdk/aws-lambda-nodejs', '@aws-cdk/aws-lambda', '@aws-cdk/aws-cloudwatch', '@aws-cdk/aws-dynamodb', '@aws-cdk/aws-cognito', '@aws-cdk/aws-route53', '@aws-cdk/aws-route53-targets', '@aws-cdk/aws-appsync', '@aws-cdk/aws-certificatemanager', '@aws-cdk/aws-cloudfront', '@aws-cdk/aws-s3', '@aws-cdk/aws-iam', '@aws-cdk/aws-kms');
        const generateTask = app.addTask('generate:api', {
            exec: 'graphql-codegen',
            category: pj.tasks.TaskCategory.BUILD,
            description: 'Generate Types from GraphQL specification',
        });
        (_a = app.tasks.tryFind('build')) === null || _a === void 0 ? void 0 : _a.prependSpawn(generateTask);
        const codegenConfig = {
            schema: 'schema.graphql',
            config: {
                scalars: {
                    AWSDate: 'string',
                    AWSURL: 'string',
                },
            },
            generates: {
                './src/lambda/types.generated.ts': {
                    plugins: ['typescript'],
                },
            },
        };
        new pj.YamlFile(app, 'codegen.yml', {
            obj: codegenConfig,
        });
    }
}
exports.GraphQlApiAspect = GraphQlApiAspect;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhxbC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcHJvamVuL2dyYXBocWwtYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyQ0FBNkI7QUFNN0IsTUFBYSxnQkFBaUIsU0FBUSxFQUFFLENBQUMsU0FBUztJQUVoRCxZQUFZLEdBQTJCLEVBQUUsV0FBb0MsRUFBRTs7UUFDN0UsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRVgsR0FBRyxDQUFDLFVBQVUsQ0FDWixtQkFBbUIsRUFDbkIsc0JBQXNCLEVBQ3RCLDZCQUE2QixFQUM3QixTQUFTLENBQ1YsQ0FBQztRQUVGLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FDbEIsZUFBZSxFQUNmLDRCQUE0QixFQUM1QixxQkFBcUIsRUFDckIseUJBQXlCLEVBQ3pCLHVCQUF1QixFQUN2QixzQkFBc0IsRUFDdEIsc0JBQXNCLEVBQ3RCLDhCQUE4QixFQUM5QixzQkFBc0IsRUFDdEIsaUNBQWlDLEVBQ2pDLHlCQUF5QixFQUN6QixpQkFBaUIsRUFDakIsa0JBQWtCLEVBQ2xCLGtCQUFrQixDQUNuQixDQUFDO1FBRUYsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUU7WUFDL0MsSUFBSSxFQUFFLGlCQUFpQjtZQUN2QixRQUFRLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsS0FBSztZQUNyQyxXQUFXLEVBQUUsMkNBQTJDO1NBQ3pELENBQUMsQ0FBQztRQUNILE1BQUEsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDBDQUFFLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUV2RCxNQUFNLGFBQWEsR0FBRztZQUNwQixNQUFNLEVBQUUsZ0JBQWdCO1lBQ3hCLE1BQU0sRUFBRTtnQkFDTixPQUFPLEVBQUU7b0JBQ1AsT0FBTyxFQUFFLFFBQVE7b0JBQ2pCLE1BQU0sRUFBRSxRQUFRO2lCQUNqQjthQUNGO1lBQ0QsU0FBUyxFQUFFO2dCQUNULGlDQUFpQyxFQUFFO29CQUNqQyxPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUM7aUJBQ3hCO2FBQ0Y7U0FDRixDQUFDO1FBRUYsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxhQUFhLEVBQUU7WUFDbEMsR0FBRyxFQUFFLGFBQWE7U0FDbkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUVGO0FBeERELDRDQXdEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHBqIGZyb20gJ3Byb2plbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgR3JhcGhRbEFwaUFzcGVjdE9wdGlvbnMge1xuICAvL1xufVxuXG5leHBvcnQgY2xhc3MgR3JhcGhRbEFwaUFzcGVjdCBleHRlbmRzIHBqLkNvbXBvbmVudCB7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBwai5Bd3NDZGtUeXBlU2NyaXB0QXBwLCBfb3B0aW9uczogR3JhcGhRbEFwaUFzcGVjdE9wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKGFwcCk7XG5cbiAgICBhcHAuYWRkRGV2RGVwcyhcbiAgICAgICdAdHlwZXMvYXdzLWxhbWJkYScsXG4gICAgICAnQGdyYXBocWwtY29kZWdlbi9jbGknLFxuICAgICAgJ0BncmFwaHFsLWNvZGVnZW4vdHlwZXNjcmlwdCcsXG4gICAgICAnZ3JhcGhxbCcsXG4gICAgKTtcblxuICAgIGFwcC5hZGRDZGtEZXBlbmRlbmN5KFxuICAgICAgJ0Bhd3MtY2RrL2NvcmUnLFxuICAgICAgJ0Bhd3MtY2RrL2F3cy1sYW1iZGEtbm9kZWpzJyxcbiAgICAgICdAYXdzLWNkay9hd3MtbGFtYmRhJyxcbiAgICAgICdAYXdzLWNkay9hd3MtY2xvdWR3YXRjaCcsXG4gICAgICAnQGF3cy1jZGsvYXdzLWR5bmFtb2RiJyxcbiAgICAgICdAYXdzLWNkay9hd3MtY29nbml0bycsXG4gICAgICAnQGF3cy1jZGsvYXdzLXJvdXRlNTMnLFxuICAgICAgJ0Bhd3MtY2RrL2F3cy1yb3V0ZTUzLXRhcmdldHMnLFxuICAgICAgJ0Bhd3MtY2RrL2F3cy1hcHBzeW5jJyxcbiAgICAgICdAYXdzLWNkay9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJyxcbiAgICAgICdAYXdzLWNkay9hd3MtY2xvdWRmcm9udCcsXG4gICAgICAnQGF3cy1jZGsvYXdzLXMzJyxcbiAgICAgICdAYXdzLWNkay9hd3MtaWFtJyxcbiAgICAgICdAYXdzLWNkay9hd3Mta21zJyxcbiAgICApO1xuXG4gICAgY29uc3QgZ2VuZXJhdGVUYXNrID0gYXBwLmFkZFRhc2soJ2dlbmVyYXRlOmFwaScsIHtcbiAgICAgIGV4ZWM6ICdncmFwaHFsLWNvZGVnZW4nLFxuICAgICAgY2F0ZWdvcnk6IHBqLnRhc2tzLlRhc2tDYXRlZ29yeS5CVUlMRCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2VuZXJhdGUgVHlwZXMgZnJvbSBHcmFwaFFMIHNwZWNpZmljYXRpb24nLFxuICAgIH0pO1xuICAgIGFwcC50YXNrcy50cnlGaW5kKCdidWlsZCcpPy5wcmVwZW5kU3Bhd24oZ2VuZXJhdGVUYXNrKTtcblxuICAgIGNvbnN0IGNvZGVnZW5Db25maWcgPSB7XG4gICAgICBzY2hlbWE6ICdzY2hlbWEuZ3JhcGhxbCcsXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgc2NhbGFyczoge1xuICAgICAgICAgIEFXU0RhdGU6ICdzdHJpbmcnLFxuICAgICAgICAgIEFXU1VSTDogJ3N0cmluZycsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgZ2VuZXJhdGVzOiB7XG4gICAgICAgICcuL3NyYy9sYW1iZGEvdHlwZXMuZ2VuZXJhdGVkLnRzJzoge1xuICAgICAgICAgIHBsdWdpbnM6IFsndHlwZXNjcmlwdCddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgbmV3IHBqLllhbWxGaWxlKGFwcCwgJ2NvZGVnZW4ueW1sJywge1xuICAgICAgb2JqOiBjb2RlZ2VuQ29uZmlnLFxuICAgIH0pO1xuICB9XG5cbn0iXX0=