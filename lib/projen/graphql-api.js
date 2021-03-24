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
        app.addDeps('@taimos/lambda-toolbox@^0.0.72');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhxbC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcHJvamVuL2dyYXBocWwtYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyQ0FBNkI7QUFNN0IsTUFBYSxnQkFBaUIsU0FBUSxFQUFFLENBQUMsU0FBUztJQUVoRCxZQUFZLEdBQTJCLEVBQUUsV0FBb0MsRUFBRTs7UUFDN0UsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRVgsR0FBRyxDQUFDLFVBQVUsQ0FDWixtQkFBbUIsRUFDbkIsc0JBQXNCLEVBQ3RCLDZCQUE2QixFQUM3QixTQUFTLENBQ1YsQ0FBQztRQUVGLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FDbEIsZUFBZSxFQUNmLDRCQUE0QixFQUM1QixxQkFBcUIsRUFDckIseUJBQXlCLEVBQ3pCLHVCQUF1QixFQUN2QixzQkFBc0IsRUFDdEIsc0JBQXNCLEVBQ3RCLDhCQUE4QixFQUM5QixzQkFBc0IsRUFDdEIsaUNBQWlDLEVBQ2pDLHlCQUF5QixFQUN6QixpQkFBaUIsRUFDakIsa0JBQWtCLEVBQ2xCLGtCQUFrQixDQUNuQixDQUFDO1FBRUYsR0FBRyxDQUFDLE9BQU8sQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1FBRTlDLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFO1lBQy9DLElBQUksRUFBRSxpQkFBaUI7WUFDdkIsUUFBUSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEtBQUs7WUFDckMsV0FBVyxFQUFFLDJDQUEyQztTQUN6RCxDQUFDLENBQUM7UUFDSCxNQUFBLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQywwQ0FBRSxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFdkQsTUFBTSxhQUFhLEdBQUc7WUFDcEIsTUFBTSxFQUFFLGdCQUFnQjtZQUN4QixNQUFNLEVBQUU7Z0JBQ04sT0FBTyxFQUFFO29CQUNQLE9BQU8sRUFBRSxRQUFRO29CQUNqQixNQUFNLEVBQUUsUUFBUTtpQkFDakI7YUFDRjtZQUNELFNBQVMsRUFBRTtnQkFDVCxpQ0FBaUMsRUFBRTtvQkFDakMsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDO2lCQUN4QjthQUNGO1NBQ0YsQ0FBQztRQUVGLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsYUFBYSxFQUFFO1lBQ2xDLEdBQUcsRUFBRSxhQUFhO1NBQ25CLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FFRjtBQTFERCw0Q0EwREMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBwaiBmcm9tICdwcm9qZW4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdyYXBoUWxBcGlBc3BlY3RPcHRpb25zIHtcbiAgLy9cbn1cblxuZXhwb3J0IGNsYXNzIEdyYXBoUWxBcGlBc3BlY3QgZXh0ZW5kcyBwai5Db21wb25lbnQge1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogcGouQXdzQ2RrVHlwZVNjcmlwdEFwcCwgX29wdGlvbnM6IEdyYXBoUWxBcGlBc3BlY3RPcHRpb25zID0ge30pIHtcbiAgICBzdXBlcihhcHApO1xuXG4gICAgYXBwLmFkZERldkRlcHMoXG4gICAgICAnQHR5cGVzL2F3cy1sYW1iZGEnLFxuICAgICAgJ0BncmFwaHFsLWNvZGVnZW4vY2xpJyxcbiAgICAgICdAZ3JhcGhxbC1jb2RlZ2VuL3R5cGVzY3JpcHQnLFxuICAgICAgJ2dyYXBocWwnLFxuICAgICk7XG5cbiAgICBhcHAuYWRkQ2RrRGVwZW5kZW5jeShcbiAgICAgICdAYXdzLWNkay9jb3JlJyxcbiAgICAgICdAYXdzLWNkay9hd3MtbGFtYmRhLW5vZGVqcycsXG4gICAgICAnQGF3cy1jZGsvYXdzLWxhbWJkYScsXG4gICAgICAnQGF3cy1jZGsvYXdzLWNsb3Vkd2F0Y2gnLFxuICAgICAgJ0Bhd3MtY2RrL2F3cy1keW5hbW9kYicsXG4gICAgICAnQGF3cy1jZGsvYXdzLWNvZ25pdG8nLFxuICAgICAgJ0Bhd3MtY2RrL2F3cy1yb3V0ZTUzJyxcbiAgICAgICdAYXdzLWNkay9hd3Mtcm91dGU1My10YXJnZXRzJyxcbiAgICAgICdAYXdzLWNkay9hd3MtYXBwc3luYycsXG4gICAgICAnQGF3cy1jZGsvYXdzLWNlcnRpZmljYXRlbWFuYWdlcicsXG4gICAgICAnQGF3cy1jZGsvYXdzLWNsb3VkZnJvbnQnLFxuICAgICAgJ0Bhd3MtY2RrL2F3cy1zMycsXG4gICAgICAnQGF3cy1jZGsvYXdzLWlhbScsXG4gICAgICAnQGF3cy1jZGsvYXdzLWttcycsXG4gICAgKTtcblxuICAgIGFwcC5hZGREZXBzKCdAdGFpbW9zL2xhbWJkYS10b29sYm94QF4wLjAuNzInKTtcblxuICAgIGNvbnN0IGdlbmVyYXRlVGFzayA9IGFwcC5hZGRUYXNrKCdnZW5lcmF0ZTphcGknLCB7XG4gICAgICBleGVjOiAnZ3JhcGhxbC1jb2RlZ2VuJyxcbiAgICAgIGNhdGVnb3J5OiBwai50YXNrcy5UYXNrQ2F0ZWdvcnkuQlVJTEQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dlbmVyYXRlIFR5cGVzIGZyb20gR3JhcGhRTCBzcGVjaWZpY2F0aW9uJyxcbiAgICB9KTtcbiAgICBhcHAudGFza3MudHJ5RmluZCgnYnVpbGQnKT8ucHJlcGVuZFNwYXduKGdlbmVyYXRlVGFzayk7XG5cbiAgICBjb25zdCBjb2RlZ2VuQ29uZmlnID0ge1xuICAgICAgc2NoZW1hOiAnc2NoZW1hLmdyYXBocWwnLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIHNjYWxhcnM6IHtcbiAgICAgICAgICBBV1NEYXRlOiAnc3RyaW5nJyxcbiAgICAgICAgICBBV1NVUkw6ICdzdHJpbmcnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGdlbmVyYXRlczoge1xuICAgICAgICAnLi9zcmMvbGFtYmRhL3R5cGVzLmdlbmVyYXRlZC50cyc6IHtcbiAgICAgICAgICBwbHVnaW5zOiBbJ3R5cGVzY3JpcHQnXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIG5ldyBwai5ZYW1sRmlsZShhcHAsICdjb2RlZ2VuLnltbCcsIHtcbiAgICAgIG9iajogY29kZWdlbkNvbmZpZyxcbiAgICB9KTtcbiAgfVxuXG59Il19