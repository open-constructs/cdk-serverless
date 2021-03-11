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
            this.customMessageFunction = new cdk_watch_1.WatchableNodejsFunction(this, 'CustomMessageFunction', {
                entry: './src/lambda/cognito.custom-message.ts',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb25zdHJ1Y3RzL2F1dGgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhEQUFnRDtBQUNoRCxtREFBcUM7QUFDckMseUNBQW9EO0FBd0JwRCxNQUFhLGNBQWUsU0FBUSxHQUFHLENBQUMsU0FBUztJQUsvQyxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQTBCOztRQUN0RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDckQsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtZQUMzQixjQUFjLEVBQUU7Z0JBQ2QsU0FBUyxFQUFFLEVBQUU7Z0JBQ2IsYUFBYSxFQUFFLEtBQUs7Z0JBQ3BCLGdCQUFnQixFQUFFLEtBQUs7Z0JBQ3ZCLGNBQWMsRUFBRSxLQUFLO2dCQUNyQixnQkFBZ0IsRUFBRSxLQUFLO2FBQ3hCO1lBQ0Qsa0JBQWtCLEVBQUU7Z0JBQ2xCLFFBQVEsRUFBRTtvQkFDUixPQUFPLEVBQUUsSUFBSTtvQkFDYixRQUFRLEVBQUUsSUFBSTtpQkFDZjtnQkFDRCxLQUFLLEVBQUU7b0JBQ0wsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsUUFBUSxFQUFFLElBQUk7aUJBQ2Y7YUFDRjtZQUNELGlCQUFpQixFQUFFLEtBQUs7WUFDeEIsYUFBYSxFQUFFO2dCQUNiLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxtQkFBbUIsRUFBRSxLQUFLO1lBQzFCLEdBQUcsS0FBSyxDQUFDLGFBQWE7U0FDdkIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxNQUFBLEtBQUssQ0FBQyxRQUFRLDBDQUFFLGNBQWMsRUFBRTtZQUNsQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSSxtQ0FBdUIsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7Z0JBQ3RGLEtBQUssRUFBRSx3Q0FBd0M7Z0JBQy9DLFFBQVEsRUFBRTtvQkFDUixNQUFNLEVBQUU7d0JBQ04sT0FBTyxFQUFFLE1BQU07cUJBQ2hCO2lCQUNGO2dCQUNELE9BQU8sRUFBRSxTQUFTO2dCQUNsQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2pDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7U0FDaEc7UUFFRCxJQUFJLEtBQUssQ0FBQyxjQUFjLEVBQUU7WUFDdkIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBb0MsQ0FBQyxrQkFBa0IsR0FBRztnQkFDNUUsbUJBQW1CLEVBQUUsV0FBVztnQkFDaEMsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLEdBQUc7Z0JBQ3BFLFNBQVMsRUFBRSxlQUFlLEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sYUFBYSxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRTthQUM3SCxDQUFDO1NBQ0g7UUFFRCxLQUFLLE1BQU0sU0FBUyxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7WUFDcEMsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsRUFBRTtnQkFDakUsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNqRCxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsUUFBUSxTQUFTLEVBQUUsRUFBRTtvQkFDdEQsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVTtvQkFDcEMsU0FBUztvQkFDVCxXQUFXLEVBQUUsZ0JBQWdCO2lCQUM5QixDQUFDLENBQUM7YUFDSjtTQUNGO1FBRUQsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQzdFLENBQUM7Q0FDRjtBQXRFRCx3Q0FzRUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCB7IFdhdGNoYWJsZU5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnY2RrLXdhdGNoJztcblxuZXhwb3J0IGludGVyZmFjZSBBdXRoZW50aWNhdGlvblByb3BzIHtcbiAgdHJpZ2dlcnM/OiB7XG4gICAgLyoqXG4gICAgICogQXR0YWNoZXMgYSBsYW1iZGEgZnVuY3Rpb24gdG8gdGhlIGN1c3RvbSBtZXNzYWdlIHRyaWdnZXJcbiAgICAgKlxuICAgICAqIENvZGUgaGFzIHRvIHJlc2lkZSBpbiAnLi9zcmMvbGFtYmRhL2NvZ25pdG8uY3VzdG9tLW1lc3NhZ2UudHMnIHdpdGggYSBtZXRob2QgJ2hhbmRsZXInXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgICAqL1xuICAgIGN1c3RvbU1lc3NhZ2VzPzogYm9vbGVhbjtcbiAgfTtcbiAgdXNlclBvb2xQcm9wcz86IGNvZ25pdG8uVXNlclBvb2xQcm9wcztcbiAgc2VzRW1haWxTZW5kZXI/OiB7XG4gICAgcmVnaW9uOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGVtYWlsOiBzdHJpbmc7XG4gIH07XG4gIGdyb3Vwcz86IHtcbiAgICBbbmFtZTogc3RyaW5nXTogc3RyaW5nO1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgQXV0aGVudGljYXRpb24gZXh0ZW5kcyBjZGsuQ29uc3RydWN0IHtcblxuICBwdWJsaWMgcmVhZG9ubHkgdXNlcnBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSBjdXN0b21NZXNzYWdlRnVuY3Rpb24/OiBXYXRjaGFibGVOb2RlanNGdW5jdGlvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEF1dGhlbnRpY2F0aW9uUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgdGhpcy51c2VycG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdVc2VyUG9vbCcsIHtcbiAgICAgIGF1dG9WZXJpZnk6IHsgZW1haWw6IHRydWUgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogMTIsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IGZhbHNlLFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiBmYWxzZSxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZnVsbG5hbWU6IHtcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIG11dGFibGU6IGZhbHNlLFxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiBmYWxzZSxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgc2lnbkluQ2FzZVNlbnNpdGl2ZTogZmFsc2UsXG4gICAgICAuLi5wcm9wcy51c2VyUG9vbFByb3BzLFxuICAgIH0pO1xuXG4gICAgaWYgKHByb3BzLnRyaWdnZXJzPy5jdXN0b21NZXNzYWdlcykge1xuICAgICAgdGhpcy5jdXN0b21NZXNzYWdlRnVuY3Rpb24gPSBuZXcgV2F0Y2hhYmxlTm9kZWpzRnVuY3Rpb24odGhpcywgJ0N1c3RvbU1lc3NhZ2VGdW5jdGlvbicsIHtcbiAgICAgICAgZW50cnk6ICcuL3NyYy9sYW1iZGEvY29nbml0by5jdXN0b20tbWVzc2FnZS50cycsXG4gICAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgICAgbG9hZGVyOiB7XG4gICAgICAgICAgICAnLmh0bWwnOiAndGV4dCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcbiAgICAgIH0pO1xuICAgICAgdGhpcy51c2VycG9vbC5hZGRUcmlnZ2VyKGNvZ25pdG8uVXNlclBvb2xPcGVyYXRpb24uQ1VTVE9NX01FU1NBR0UsIHRoaXMuY3VzdG9tTWVzc2FnZUZ1bmN0aW9uKTtcbiAgICB9XG5cbiAgICBpZiAocHJvcHMuc2VzRW1haWxTZW5kZXIpIHtcbiAgICAgICh0aGlzLnVzZXJwb29sLm5vZGUuZGVmYXVsdENoaWxkIGFzIGNvZ25pdG8uQ2ZuVXNlclBvb2wpLmVtYWlsQ29uZmlndXJhdGlvbiA9IHtcbiAgICAgICAgZW1haWxTZW5kaW5nQWNjb3VudDogJ0RFVkVMT1BFUicsXG4gICAgICAgIGZyb206IGAke3Byb3BzLnNlc0VtYWlsU2VuZGVyLm5hbWV9IDwke3Byb3BzLnNlc0VtYWlsU2VuZGVyLmVtYWlsfT5gLFxuICAgICAgICBzb3VyY2VBcm46IGBhcm46YXdzOnNlczoke3Byb3BzLnNlc0VtYWlsU2VuZGVyLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06aWRlbnRpdHkvJHtwcm9wcy5zZXNFbWFpbFNlbmRlci5lbWFpbH1gLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGdyb3VwTmFtZSBpbiBwcm9wcy5ncm91cHMpIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocHJvcHMuZ3JvdXBzLCBncm91cE5hbWUpKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwRGVzY3JpcHRpb24gPSBwcm9wcy5ncm91cHNbZ3JvdXBOYW1lXTtcbiAgICAgICAgbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCBgR3JvdXAke2dyb3VwTmFtZX1gLCB7XG4gICAgICAgICAgdXNlclBvb2xJZDogdGhpcy51c2VycG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgIGdyb3VwTmFtZSxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogZ3JvdXBEZXNjcmlwdGlvbixcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7IHZhbHVlOiB0aGlzLnVzZXJwb29sLnVzZXJQb29sSWQgfSk7XG4gIH1cbn0iXX0=