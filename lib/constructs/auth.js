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
exports.Authentication = void 0;
const fs = __importStar(require("fs"));
const cognito = __importStar(require("@aws-cdk/aws-cognito"));
const cdk = __importStar(require("@aws-cdk/core"));
const cdk_watch_1 = require("cdk-watch");
class Authentication extends cdk.Construct {
    constructor(scope, id, props) {
        var _a;
        super(scope, id);
        this.userpool = new cognito.UserPool(this, 'UserPool', {
            autoVerify: { email: true },
            passwordPolicy: {
                minLength: 12,
                requireDigits: false,
                requireLowercase: false,
                requireSymbols: false,
                requireUppercase: false,
            },
            standardAttributes: {
                fullname: {
                    mutable: true,
                    required: true,
                },
                email: {
                    mutable: false,
                    required: true,
                },
            },
            selfSignUpEnabled: false,
            signInAliases: {
                email: true,
            },
            signInCaseSensitive: false,
            ...props.userPoolProps,
        });
        if ((_a = props.triggers) === null || _a === void 0 ? void 0 : _a.customMessages) {
            const entryFile = './src/lambda/cognito.custom-message.ts';
            if (!fs.existsSync(entryFile)) {
                fs.writeFileSync(entryFile, `import { CustomMessageTriggerEvent } from 'aws-lambda';
      
export async function handler(event: CustomMessageTriggerEvent): Promise<CustomMessageTriggerEvent> {
  console.log(event);

  if (event.triggerSource === 'CustomMessage_AdminCreateUser') {
    // event.response.emailSubject = '';
    // event.response.emailMessage = '';
  } else if (event.triggerSource === 'CustomMessage_ForgotPassword') {
    // event.response.emailSubject = '';
    // event.response.emailMessage = '';
  } // ...

  return event;
}`, {
                    encoding: 'utf-8',
                });
            }
            this.customMessageFunction = new cdk_watch_1.WatchableNodejsFunction(this, 'CustomMessageFunction', {
                entry: entryFile,
                bundling: {
                    loader: {
                        '.html': 'text',
                    },
                },
                handler: 'handler',
                timeout: cdk.Duration.seconds(5),
            });
            this.userpool.addTrigger(cognito.UserPoolOperation.CUSTOM_MESSAGE, this.customMessageFunction);
        }
        if (props.sesEmailSender) {
            this.userpool.node.defaultChild.emailConfiguration = {
                emailSendingAccount: 'DEVELOPER',
                from: `${props.sesEmailSender.name} <${props.sesEmailSender.email}>`,
                sourceArn: `arn:aws:ses:${props.sesEmailSender.region}:${cdk.Stack.of(this).account}:identity/${props.sesEmailSender.email}`,
            };
        }
        for (const groupName in props.groups) {
            if (Object.prototype.hasOwnProperty.call(props.groups, groupName)) {
                const groupDescription = props.groups[groupName];
                new cognito.CfnUserPoolGroup(this, `Group${groupName}`, {
                    userPoolId: this.userpool.userPoolId,
                    groupName,
                    description: groupDescription,
                });
            }
        }
        new cdk.CfnOutput(this, 'UserPoolId', { value: this.userpool.userPoolId });
    }
}
exports.Authentication = Authentication;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb25zdHJ1Y3RzL2F1dGgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6Qiw4REFBZ0Q7QUFDaEQsbURBQXFDO0FBQ3JDLHlDQUFvRDtBQW1EcEQsTUFBYSxjQUFlLFNBQVEsR0FBRyxDQUFDLFNBQVM7SUFLL0MsWUFBWSxLQUFvQixFQUFFLEVBQVUsRUFBRSxLQUEwQjs7UUFDdEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ3JELFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7WUFDM0IsY0FBYyxFQUFFO2dCQUNkLFNBQVMsRUFBRSxFQUFFO2dCQUNiLGFBQWEsRUFBRSxLQUFLO2dCQUNwQixnQkFBZ0IsRUFBRSxLQUFLO2dCQUN2QixjQUFjLEVBQUUsS0FBSztnQkFDckIsZ0JBQWdCLEVBQUUsS0FBSzthQUN4QjtZQUNELGtCQUFrQixFQUFFO2dCQUNsQixRQUFRLEVBQUU7b0JBQ1IsT0FBTyxFQUFFLElBQUk7b0JBQ2IsUUFBUSxFQUFFLElBQUk7aUJBQ2Y7Z0JBQ0QsS0FBSyxFQUFFO29CQUNMLE9BQU8sRUFBRSxLQUFLO29CQUNkLFFBQVEsRUFBRSxJQUFJO2lCQUNmO2FBQ0Y7WUFDRCxpQkFBaUIsRUFBRSxLQUFLO1lBQ3hCLGFBQWEsRUFBRTtnQkFDYixLQUFLLEVBQUUsSUFBSTthQUNaO1lBQ0QsbUJBQW1CLEVBQUUsS0FBSztZQUMxQixHQUFHLEtBQUssQ0FBQyxhQUFhO1NBQ3ZCLENBQUMsQ0FBQztRQUVILElBQUksTUFBQSxLQUFLLENBQUMsUUFBUSwwQ0FBRSxjQUFjLEVBQUU7WUFDbEMsTUFBTSxTQUFTLEdBQUcsd0NBQXdDLENBQUM7WUFFM0QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQzdCLEVBQUUsQ0FBQyxhQUFhLENBQUMsU0FBUyxFQUFFOzs7Ozs7Ozs7Ozs7OztFQWNsQyxFQUFFO29CQUNNLFFBQVEsRUFBRSxPQUFPO2lCQUNsQixDQUFDLENBQUM7YUFDSjtZQUVELElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLG1DQUF1QixDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtnQkFDdEYsS0FBSyxFQUFFLFNBQVM7Z0JBQ2hCLFFBQVEsRUFBRTtvQkFDUixNQUFNLEVBQUU7d0JBQ04sT0FBTyxFQUFFLE1BQU07cUJBQ2hCO2lCQUNGO2dCQUNELE9BQU8sRUFBRSxTQUFTO2dCQUNsQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2pDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7U0FDaEc7UUFFRCxJQUFJLEtBQUssQ0FBQyxjQUFjLEVBQUU7WUFDdkIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBb0MsQ0FBQyxrQkFBa0IsR0FBRztnQkFDNUUsbUJBQW1CLEVBQUUsV0FBVztnQkFDaEMsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLEdBQUc7Z0JBQ3BFLFNBQVMsRUFBRSxlQUFlLEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sYUFBYSxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRTthQUM3SCxDQUFDO1NBQ0g7UUFFRCxLQUFLLE1BQU0sU0FBUyxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7WUFDcEMsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsRUFBRTtnQkFDakUsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNqRCxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsUUFBUSxTQUFTLEVBQUUsRUFBRTtvQkFDdEQsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVTtvQkFDcEMsU0FBUztvQkFDVCxXQUFXLEVBQUUsZ0JBQWdCO2lCQUM5QixDQUFDLENBQUM7YUFDSjtTQUNGO1FBRUQsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQzdFLENBQUM7Q0FDRjtBQTVGRCx3Q0E0RkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCB7IFdhdGNoYWJsZU5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnY2RrLXdhdGNoJztcblxuZXhwb3J0IGludGVyZmFjZSBBdXRoZW50aWNhdGlvblByb3BzIHtcblxuICAvKipcbiAgICogQ29uZmlndXJlIENvZ25pdG8gTGFtYmRhIHRyaWdnZXJzXG4gICAqL1xuICB0cmlnZ2Vycz86IHtcbiAgICAvKipcbiAgICAgKiBBdHRhY2hlcyBhIGxhbWJkYSBmdW5jdGlvbiB0byB0aGUgY3VzdG9tIG1lc3NhZ2UgdHJpZ2dlclxuICAgICAqXG4gICAgICogQ29kZSBoYXMgdG8gcmVzaWRlIGluICcuL3NyYy9sYW1iZGEvY29nbml0by5jdXN0b20tbWVzc2FnZS50cycgd2l0aCBhIG1ldGhvZCAnaGFuZGxlcidcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IGZhbHNlXG4gICAgICovXG4gICAgY3VzdG9tTWVzc2FnZXM/OiBib29sZWFuO1xuICB9O1xuXG4gIC8qKlxuICAgKiBQcm9wZXJ0aWVzIG9mIHRoZSBDb2duaXRvIHVzZXIgcG9vbFxuICAgKi9cbiAgdXNlclBvb2xQcm9wcz86IGNvZ25pdG8uVXNlclBvb2xQcm9wcztcblxuICAvKipcbiAgICogQ29uZmlndXJlIFNFUyBtYWlsIHNlbmRpbmdcbiAgICovXG4gIHNlc0VtYWlsU2VuZGVyPzoge1xuICAgIC8qKlxuICAgICAqIEFXUyByZWdpb24gdG8gdXNlIGZvciBTRVNcbiAgICAgKi9cbiAgICByZWdpb246IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBTZW5kZXIgbmFtZVxuICAgICAqL1xuICAgIG5hbWU6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBTZW5kZXIgZW1haWwuIE5lZWRzIHRvIGJlIHZlcmlmaWVkIGluIFNFU1xuICAgICAqL1xuICAgIGVtYWlsOiBzdHJpbmc7XG4gIH07XG5cbiAgLyoqXG4gICAqIEdyb3VwcyB0byBjcmVhdGUgaW4gQ29nbml0byB1c2VyIHBvb2xcbiAgICogS2V5OiBncm91cCBuYW1lXG4gICAqIFZhbHVlOiBncm91cCBkZXNjcmlwdGlvblxuICAgKi9cbiAgZ3JvdXBzPzoge1xuICAgIFtuYW1lOiBzdHJpbmddOiBzdHJpbmc7XG4gIH07XG59XG5cbmV4cG9ydCBjbGFzcyBBdXRoZW50aWNhdGlvbiBleHRlbmRzIGNkay5Db25zdHJ1Y3Qge1xuXG4gIHB1YmxpYyByZWFkb25seSB1c2VycG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IGN1c3RvbU1lc3NhZ2VGdW5jdGlvbj86IFdhdGNoYWJsZU5vZGVqc0Z1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXV0aGVudGljYXRpb25Qcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICB0aGlzLnVzZXJwb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1VzZXJQb29sJywge1xuICAgICAgYXV0b1ZlcmlmeTogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiAxMixcbiAgICAgICAgcmVxdWlyZURpZ2l0czogZmFsc2UsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IGZhbHNlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogZmFsc2UsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBmdWxsbmFtZToge1xuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGVtYWlsOiB7XG4gICAgICAgICAgbXV0YWJsZTogZmFsc2UsXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IGZhbHNlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzaWduSW5DYXNlU2Vuc2l0aXZlOiBmYWxzZSxcbiAgICAgIC4uLnByb3BzLnVzZXJQb29sUHJvcHMsXG4gICAgfSk7XG5cbiAgICBpZiAocHJvcHMudHJpZ2dlcnM/LmN1c3RvbU1lc3NhZ2VzKSB7XG4gICAgICBjb25zdCBlbnRyeUZpbGUgPSAnLi9zcmMvbGFtYmRhL2NvZ25pdG8uY3VzdG9tLW1lc3NhZ2UudHMnO1xuXG4gICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZW50cnlGaWxlKSkge1xuICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGVudHJ5RmlsZSwgYGltcG9ydCB7IEN1c3RvbU1lc3NhZ2VUcmlnZ2VyRXZlbnQgfSBmcm9tICdhd3MtbGFtYmRhJztcbiAgICAgIFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIoZXZlbnQ6IEN1c3RvbU1lc3NhZ2VUcmlnZ2VyRXZlbnQpOiBQcm9taXNlPEN1c3RvbU1lc3NhZ2VUcmlnZ2VyRXZlbnQ+IHtcbiAgY29uc29sZS5sb2coZXZlbnQpO1xuXG4gIGlmIChldmVudC50cmlnZ2VyU291cmNlID09PSAnQ3VzdG9tTWVzc2FnZV9BZG1pbkNyZWF0ZVVzZXInKSB7XG4gICAgLy8gZXZlbnQucmVzcG9uc2UuZW1haWxTdWJqZWN0ID0gJyc7XG4gICAgLy8gZXZlbnQucmVzcG9uc2UuZW1haWxNZXNzYWdlID0gJyc7XG4gIH0gZWxzZSBpZiAoZXZlbnQudHJpZ2dlclNvdXJjZSA9PT0gJ0N1c3RvbU1lc3NhZ2VfRm9yZ290UGFzc3dvcmQnKSB7XG4gICAgLy8gZXZlbnQucmVzcG9uc2UuZW1haWxTdWJqZWN0ID0gJyc7XG4gICAgLy8gZXZlbnQucmVzcG9uc2UuZW1haWxNZXNzYWdlID0gJyc7XG4gIH0gLy8gLi4uXG5cbiAgcmV0dXJuIGV2ZW50O1xufWAsIHtcbiAgICAgICAgICBlbmNvZGluZzogJ3V0Zi04JyxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuY3VzdG9tTWVzc2FnZUZ1bmN0aW9uID0gbmV3IFdhdGNoYWJsZU5vZGVqc0Z1bmN0aW9uKHRoaXMsICdDdXN0b21NZXNzYWdlRnVuY3Rpb24nLCB7XG4gICAgICAgIGVudHJ5OiBlbnRyeUZpbGUsXG4gICAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgICAgbG9hZGVyOiB7XG4gICAgICAgICAgICAnLmh0bWwnOiAndGV4dCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcbiAgICAgIH0pO1xuICAgICAgdGhpcy51c2VycG9vbC5hZGRUcmlnZ2VyKGNvZ25pdG8uVXNlclBvb2xPcGVyYXRpb24uQ1VTVE9NX01FU1NBR0UsIHRoaXMuY3VzdG9tTWVzc2FnZUZ1bmN0aW9uKTtcbiAgICB9XG5cbiAgICBpZiAocHJvcHMuc2VzRW1haWxTZW5kZXIpIHtcbiAgICAgICh0aGlzLnVzZXJwb29sLm5vZGUuZGVmYXVsdENoaWxkIGFzIGNvZ25pdG8uQ2ZuVXNlclBvb2wpLmVtYWlsQ29uZmlndXJhdGlvbiA9IHtcbiAgICAgICAgZW1haWxTZW5kaW5nQWNjb3VudDogJ0RFVkVMT1BFUicsXG4gICAgICAgIGZyb206IGAke3Byb3BzLnNlc0VtYWlsU2VuZGVyLm5hbWV9IDwke3Byb3BzLnNlc0VtYWlsU2VuZGVyLmVtYWlsfT5gLFxuICAgICAgICBzb3VyY2VBcm46IGBhcm46YXdzOnNlczoke3Byb3BzLnNlc0VtYWlsU2VuZGVyLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06aWRlbnRpdHkvJHtwcm9wcy5zZXNFbWFpbFNlbmRlci5lbWFpbH1gLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGdyb3VwTmFtZSBpbiBwcm9wcy5ncm91cHMpIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocHJvcHMuZ3JvdXBzLCBncm91cE5hbWUpKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwRGVzY3JpcHRpb24gPSBwcm9wcy5ncm91cHNbZ3JvdXBOYW1lXTtcbiAgICAgICAgbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCBgR3JvdXAke2dyb3VwTmFtZX1gLCB7XG4gICAgICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VycG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgIGdyb3VwTmFtZSxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogZ3JvdXBEZXNjcmlwdGlvbixcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7IHZhbHVlOiB0aGlzLnVzZXJwb29sLnVzZXJQb29sSWQgfSk7XG4gIH1cbn0iXX0=