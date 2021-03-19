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
        app.addDeps('@taimos/lambda-toolbox@^0.0.72');
        new pj.SampleFile(app, 'openapi.yaml', {
            contents: '',
        });
    }
}
exports.HttpApiAspect = HttpApiAspect;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcHJvamVuL2h0dHAtYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyQ0FBNkI7QUFNN0IsTUFBYSxhQUFjLFNBQVEsRUFBRSxDQUFDLFNBQVM7SUFFN0MsWUFBWSxHQUEyQixFQUFFLFdBQWlDLEVBQUU7O1FBQzFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVYLEdBQUcsQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHO1lBQ3RCLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxPQUFPO1lBQ3hCLDBCQUEwQixFQUFFLE1BQU07WUFDbEMseUNBQXlDLEVBQUUsTUFBTTtZQUNqRCxzQ0FBc0MsRUFBRSxNQUFNO1lBQzlDLG9DQUFvQyxFQUFFLE1BQU07WUFDNUMsNkNBQTZDLEVBQUUsTUFBTTtZQUNyRCxrREFBa0QsRUFBRSxNQUFNO1lBQzFELHFDQUFxQyxFQUFFLE1BQU07U0FDOUMsQ0FBQztRQUVGLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFO1lBQy9DLElBQUksRUFBRSx3RUFBd0U7WUFDOUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEtBQUs7WUFDckMsV0FBVyxFQUFFLDJDQUEyQztTQUN6RCxDQUFDLENBQUM7UUFDSCxNQUFBLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQywwQ0FBRSxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFdkQsR0FBRyxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3BDLEdBQUcsQ0FBQyxPQUFPLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztRQUU5QyxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLGNBQWMsRUFBRTtZQUNyQyxRQUFRLEVBQUUsRUFBRTtTQUNiLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FFRjtBQS9CRCxzQ0ErQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBwaiBmcm9tICdwcm9qZW4nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEh0dHBBcGlBc3BlY3RPcHRpb25zIHtcbiAgLy9cbn1cblxuZXhwb3J0IGNsYXNzIEh0dHBBcGlBc3BlY3QgZXh0ZW5kcyBwai5Db21wb25lbnQge1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogcGouQXdzQ2RrVHlwZVNjcmlwdEFwcCwgX29wdGlvbnM6IEh0dHBBcGlBc3BlY3RPcHRpb25zID0ge30pIHtcbiAgICBzdXBlcihhcHApO1xuXG4gICAgYXBwLmNka0NvbmZpZy5jb250ZXh0ID0ge1xuICAgICAgLi4uYXBwLmNka0NvbmZpZy5jb250ZXh0LFxuICAgICAgJ2F3cy1jZGs6ZW5hYmxlRGlmZk5vRmFpbCc6ICd0cnVlJyxcbiAgICAgICdAYXdzLWNkay9jb3JlOmVuYWJsZVN0YWNrTmFtZUR1cGxpY2F0ZXMnOiAndHJ1ZScsXG4gICAgICAnQGF3cy1jZGsvY29yZTpuZXdTdHlsZVN0YWNrU3ludGhlc2lzJzogJ3RydWUnLFxuICAgICAgJ0Bhd3MtY2RrL2NvcmU6c3RhY2tSZWxhdGl2ZUV4cG9ydHMnOiAndHJ1ZScsXG4gICAgICAnQGF3cy1jZGsvYXdzLWVjci1hc3NldHM6ZG9ja2VySWdub3JlU3VwcG9ydCc6ICd0cnVlJyxcbiAgICAgICdAYXdzLWNkay9hd3Mtc2VjcmV0c21hbmFnZXI6cGFyc2VPd25lZFNlY3JldE5hbWUnOiAndHJ1ZScsXG4gICAgICAnQGF3cy1jZGsvYXdzLWttczpkZWZhdWx0S2V5UG9saWNpZXMnOiAndHJ1ZScsXG4gICAgfTtcblxuICAgIGNvbnN0IGdlbmVyYXRlVGFzayA9IGFwcC5hZGRUYXNrKCdnZW5lcmF0ZTphcGknLCB7XG4gICAgICBleGVjOiAnb3BlbmFwaS10eXBlc2NyaXB0IG9wZW5hcGkueWFtbCAtLW91dHB1dCBzcmMvbGFtYmRhL3R5cGVzLmdlbmVyYXRlZC50cycsXG4gICAgICBjYXRlZ29yeTogcGoudGFza3MuVGFza0NhdGVnb3J5LkJVSUxELFxuICAgICAgZGVzY3JpcHRpb246ICdHZW5lcmF0ZSBUeXBlcyBmcm9tIE9wZW5BUEkgc3BlY2lmaWNhdGlvbicsXG4gICAgfSk7XG4gICAgYXBwLnRhc2tzLnRyeUZpbmQoJ2J1aWxkJyk/LnByZXBlbmRTcGF3bihnZW5lcmF0ZVRhc2spO1xuXG4gICAgYXBwLmFkZERldkRlcHMoJ0B0eXBlcy9hd3MtbGFtYmRhJyk7XG4gICAgYXBwLmFkZERlcHMoJ0B0YWltb3MvbGFtYmRhLXRvb2xib3hAXjAuMC43MicpO1xuXG4gICAgbmV3IHBqLlNhbXBsZUZpbGUoYXBwLCAnb3BlbmFwaS55YW1sJywge1xuICAgICAgY29udGVudHM6ICcnLFxuICAgIH0pO1xuICB9XG5cbn0iXX0=