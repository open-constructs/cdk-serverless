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
        app.addDevDeps('@types/aws-lambda', '@graphql-codegen/cli', '@graphql-codegen/typescript');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhxbC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcHJvamVuL2dyYXBocWwtYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyQ0FBNkI7QUFNN0IsTUFBYSxnQkFBaUIsU0FBUSxFQUFFLENBQUMsU0FBUztJQUVoRCxZQUFZLEdBQTJCLEVBQUUsV0FBb0MsRUFBRTs7UUFDN0UsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRVgsR0FBRyxDQUFDLFVBQVUsQ0FDWixtQkFBbUIsRUFDbkIsc0JBQXNCLEVBQ3RCLDZCQUE2QixDQUM5QixDQUFDO1FBRUYsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUU7WUFDL0MsSUFBSSxFQUFFLGlCQUFpQjtZQUN2QixRQUFRLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsS0FBSztZQUNyQyxXQUFXLEVBQUUsMkNBQTJDO1NBQ3pELENBQUMsQ0FBQztRQUNILE1BQUEsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDBDQUFFLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUV2RCxNQUFNLGFBQWEsR0FBRztZQUNwQixNQUFNLEVBQUUsZ0JBQWdCO1lBQ3hCLE1BQU0sRUFBRTtnQkFDTixPQUFPLEVBQUU7b0JBQ1AsT0FBTyxFQUFFLFFBQVE7b0JBQ2pCLE1BQU0sRUFBRSxRQUFRO2lCQUNqQjthQUNGO1lBQ0QsU0FBUyxFQUFFO2dCQUNULGlDQUFpQyxFQUFFO29CQUNqQyxPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUM7aUJBQ3hCO2FBQ0Y7U0FDRixDQUFDO1FBRUYsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxhQUFhLEVBQUU7WUFDbEMsR0FBRyxFQUFFLGFBQWE7U0FDbkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUVGO0FBdENELDRDQXNDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHBqIGZyb20gJ3Byb2plbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgR3JhcGhRbEFwaUFzcGVjdE9wdGlvbnMge1xuICAvL1xufVxuXG5leHBvcnQgY2xhc3MgR3JhcGhRbEFwaUFzcGVjdCBleHRlbmRzIHBqLkNvbXBvbmVudCB7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBwai5Bd3NDZGtUeXBlU2NyaXB0QXBwLCBfb3B0aW9uczogR3JhcGhRbEFwaUFzcGVjdE9wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKGFwcCk7XG5cbiAgICBhcHAuYWRkRGV2RGVwcyhcbiAgICAgICdAdHlwZXMvYXdzLWxhbWJkYScsXG4gICAgICAnQGdyYXBocWwtY29kZWdlbi9jbGknLFxuICAgICAgJ0BncmFwaHFsLWNvZGVnZW4vdHlwZXNjcmlwdCcsXG4gICAgKTtcblxuICAgIGNvbnN0IGdlbmVyYXRlVGFzayA9IGFwcC5hZGRUYXNrKCdnZW5lcmF0ZTphcGknLCB7XG4gICAgICBleGVjOiAnZ3JhcGhxbC1jb2RlZ2VuJyxcbiAgICAgIGNhdGVnb3J5OiBwai50YXNrcy5UYXNrQ2F0ZWdvcnkuQlVJTEQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dlbmVyYXRlIFR5cGVzIGZyb20gR3JhcGhRTCBzcGVjaWZpY2F0aW9uJyxcbiAgICB9KTtcbiAgICBhcHAudGFza3MudHJ5RmluZCgnYnVpbGQnKT8ucHJlcGVuZFNwYXduKGdlbmVyYXRlVGFzayk7XG5cbiAgICBjb25zdCBjb2RlZ2VuQ29uZmlnID0ge1xuICAgICAgc2NoZW1hOiAnc2NoZW1hLmdyYXBocWwnLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIHNjYWxhcnM6IHtcbiAgICAgICAgICBBV1NEYXRlOiAnc3RyaW5nJyxcbiAgICAgICAgICBBV1NVUkw6ICdzdHJpbmcnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGdlbmVyYXRlczoge1xuICAgICAgICAnLi9zcmMvbGFtYmRhL3R5cGVzLmdlbmVyYXRlZC50cyc6IHtcbiAgICAgICAgICBwbHVnaW5zOiBbJ3R5cGVzY3JpcHQnXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIG5ldyBwai5ZYW1sRmlsZShhcHAsICdjb2RlZ2VuLnltbCcsIHtcbiAgICAgIG9iajogY29kZWdlbkNvbmZpZyxcbiAgICB9KTtcbiAgfVxuXG59Il19