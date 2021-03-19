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
exports.HttpApiAspect = void 0;
const pj = __importStar(require("projen"));
class HttpApiAspect extends pj.Component {
    constructor(app, _options = {}) {
        var _a;
        super(app);
        app.cdkConfig.context = {
            ...app.cdkConfig.context,
            'aws-cdk:enableDiffNoFail': 'true',
            '@aws-cdk/core:enableStackNameDuplicates': 'true',
            '@aws-cdk/core:newStyleStackSynthesis': 'true',
            '@aws-cdk/core:stackRelativeExports': 'true',
            '@aws-cdk/aws-ecr-assets:dockerIgnoreSupport': 'true',
            '@aws-cdk/aws-secretsmanager:parseOwnedSecretName': 'true',
            '@aws-cdk/aws-kms:defaultKeyPolicies': 'true',
        };
        const generateTask = app.addTask('generate:api', {
            exec: 'openapi-typescript openapi.yaml --output src/lambda/types.generated.ts',
            category: pj.tasks.TaskCategory.BUILD,
            description: 'Generate Types from OpenAPI specification',
        });
        (_a = app.tasks.tryFind('build')) === null || _a === void 0 ? void 0 : _a.prependSpawn(generateTask);
        app.addDevDeps('@types/aws-lambda');
        new pj.SampleFile(app, 'openapi.yaml', {
            contents: '',
        });
    }
}
exports.HttpApiAspect = HttpApiAspect;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcHJvamVuL2h0dHAtYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyQ0FBNkI7QUFNN0IsTUFBYSxhQUFjLFNBQVEsRUFBRSxDQUFDLFNBQVM7SUFFN0MsWUFBWSxHQUEyQixFQUFFLFdBQWlDLEVBQUU7O1FBQzFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVYLEdBQUcsQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHO1lBQ3RCLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxPQUFPO1lBQ3hCLDBCQUEwQixFQUFFLE1BQU07WUFDbEMseUNBQXlDLEVBQUUsTUFBTTtZQUNqRCxzQ0FBc0MsRUFBRSxNQUFNO1lBQzlDLG9DQUFvQyxFQUFFLE1BQU07WUFDNUMsNkNBQTZDLEVBQUUsTUFBTTtZQUNyRCxrREFBa0QsRUFBRSxNQUFNO1lBQzFELHFDQUFxQyxFQUFFLE1BQU07U0FDOUMsQ0FBQztRQUVGLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFO1lBQy9DLElBQUksRUFBRSx3RUFBd0U7WUFDOUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEtBQUs7WUFDckMsV0FBVyxFQUFFLDJDQUEyQztTQUN6RCxDQUFDLENBQUM7UUFDSCxNQUFBLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQywwQ0FBRSxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFdkQsR0FBRyxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBRXBDLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsY0FBYyxFQUFFO1lBQ3JDLFFBQVEsRUFBRSxFQUFFO1NBQ2IsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUVGO0FBOUJELHNDQThCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHBqIGZyb20gJ3Byb2plbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSHR0cEFwaUFzcGVjdE9wdGlvbnMge1xuICAvL1xufVxuXG5leHBvcnQgY2xhc3MgSHR0cEFwaUFzcGVjdCBleHRlbmRzIHBqLkNvbXBvbmVudCB7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBwai5Bd3NDZGtUeXBlU2NyaXB0QXBwLCBfb3B0aW9uczogSHR0cEFwaUFzcGVjdE9wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKGFwcCk7XG5cbiAgICBhcHAuY2RrQ29uZmlnLmNvbnRleHQgPSB7XG4gICAgICAuLi5hcHAuY2RrQ29uZmlnLmNvbnRleHQsXG4gICAgICAnYXdzLWNkazplbmFibGVEaWZmTm9GYWlsJzogJ3RydWUnLFxuICAgICAgJ0Bhd3MtY2RrL2NvcmU6ZW5hYmxlU3RhY2tOYW1lRHVwbGljYXRlcyc6ICd0cnVlJyxcbiAgICAgICdAYXdzLWNkay9jb3JlOm5ld1N0eWxlU3RhY2tTeW50aGVzaXMnOiAndHJ1ZScsXG4gICAgICAnQGF3cy1jZGsvY29yZTpzdGFja1JlbGF0aXZlRXhwb3J0cyc6ICd0cnVlJyxcbiAgICAgICdAYXdzLWNkay9hd3MtZWNyLWFzc2V0czpkb2NrZXJJZ25vcmVTdXBwb3J0JzogJ3RydWUnLFxuICAgICAgJ0Bhd3MtY2RrL2F3cy1zZWNyZXRzbWFuYWdlcjpwYXJzZU93bmVkU2VjcmV0TmFtZSc6ICd0cnVlJyxcbiAgICAgICdAYXdzLWNkay9hd3Mta21zOmRlZmF1bHRLZXlQb2xpY2llcyc6ICd0cnVlJyxcbiAgICB9O1xuXG4gICAgY29uc3QgZ2VuZXJhdGVUYXNrID0gYXBwLmFkZFRhc2soJ2dlbmVyYXRlOmFwaScsIHtcbiAgICAgIGV4ZWM6ICdvcGVuYXBpLXR5cGVzY3JpcHQgb3BlbmFwaS55YW1sIC0tb3V0cHV0IHNyYy9sYW1iZGEvdHlwZXMuZ2VuZXJhdGVkLnRzJyxcbiAgICAgIGNhdGVnb3J5OiBwai50YXNrcy5UYXNrQ2F0ZWdvcnkuQlVJTEQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dlbmVyYXRlIFR5cGVzIGZyb20gT3BlbkFQSSBzcGVjaWZpY2F0aW9uJyxcbiAgICB9KTtcbiAgICBhcHAudGFza3MudHJ5RmluZCgnYnVpbGQnKT8ucHJlcGVuZFNwYXduKGdlbmVyYXRlVGFzayk7XG5cbiAgICBhcHAuYWRkRGV2RGVwcygnQHR5cGVzL2F3cy1sYW1iZGEnKTtcblxuICAgIG5ldyBwai5TYW1wbGVGaWxlKGFwcCwgJ29wZW5hcGkueWFtbCcsIHtcbiAgICAgIGNvbnRlbnRzOiAnJyxcbiAgICB9KTtcbiAgfVxuXG59Il19