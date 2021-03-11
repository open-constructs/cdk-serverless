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
exports.Monitoring = void 0;
const fs_1 = require("fs");
const cloudwatch = __importStar(require("@aws-cdk/aws-cloudwatch"));
const cdk = __importStar(require("@aws-cdk/core"));
class Monitoring extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
            dashboardName: `${props.apiName}-${props.stageName}`,
        });
        this.apiErrorsWidget = new cloudwatch.GraphWidget({
            title: 'API Errors',
        });
        this.apiLatencyWidget = new cloudwatch.GraphWidget({
            title: 'API Latency',
        });
        this.apiLatencyTailWidget = new cloudwatch.GraphWidget({
            title: 'API Latency Longtail',
        });
        this.dashboard.addWidgets(this.getTextWidget('api'), this.apiErrorsWidget, this.apiLatencyWidget, this.apiLatencyTailWidget);
        this.lambdaErrorsWidget = new cloudwatch.GraphWidget({
            title: 'Lambda Errors/Throttles',
        });
        this.lambdaInvokesWidget = new cloudwatch.GraphWidget({
            title: 'Lambda Invocations',
        });
        this.lambdaDurationsWidget = new cloudwatch.GraphWidget({
            title: 'Lambda Duration',
        });
        this.dashboard.addWidgets(this.getTextWidget('functions'), this.lambdaErrorsWidget, this.lambdaInvokesWidget, this.lambdaDurationsWidget);
    }
    getTextWidget(fileName) {
        const file = `./dashboard/${fileName}.md`;
        let markdown = `Create a file called './dashboard/${fileName}.md' to describe this dashboard`;
        if (fs_1.existsSync(file)) {
            markdown = fs_1.readFileSync(file).toString('utf-8');
        }
        return new cloudwatch.TextWidget({
            markdown,
            height: 6,
        });
    }
}
exports.Monitoring = Monitoring;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb25zdHJ1Y3RzL21vbml0b3JpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJCQUE4QztBQUM5QyxvRUFBc0Q7QUFDdEQsbURBQXFDO0FBT3JDLE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxTQUFTO0lBWTNDLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQzNELGFBQWEsRUFBRSxHQUFHLEtBQUssQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLFNBQVMsRUFBRTtTQUNyRCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUNoRCxLQUFLLEVBQUUsWUFBWTtTQUNwQixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO1lBQ2pELEtBQUssRUFBRSxhQUFhO1NBQ3JCLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDckQsS0FBSyxFQUFFLHNCQUFzQjtTQUM5QixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FDdkIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsRUFDekIsSUFBSSxDQUFDLGVBQWUsRUFDcEIsSUFBSSxDQUFDLGdCQUFnQixFQUNyQixJQUFJLENBQUMsb0JBQW9CLENBQzFCLENBQUM7UUFFRixJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO1lBQ25ELEtBQUssRUFBRSx5QkFBeUI7U0FDakMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUNwRCxLQUFLLEVBQUUsb0JBQW9CO1NBQzVCLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDdEQsS0FBSyxFQUFFLGlCQUFpQjtTQUN6QixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FDdkIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsRUFDL0IsSUFBSSxDQUFDLGtCQUFrQixFQUN2QixJQUFJLENBQUMsbUJBQW1CLEVBQ3hCLElBQUksQ0FBQyxxQkFBcUIsQ0FDM0IsQ0FBQztJQUNKLENBQUM7SUFFRCxhQUFhLENBQUMsUUFBZ0I7UUFDNUIsTUFBTSxJQUFJLEdBQUcsZUFBZSxRQUFRLEtBQUssQ0FBQztRQUMxQyxJQUFJLFFBQVEsR0FBRyxxQ0FBcUMsUUFBUSxpQ0FBaUMsQ0FBQztRQUM5RixJQUFJLGVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNwQixRQUFRLEdBQUcsaUJBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDakQ7UUFDRCxPQUFPLElBQUksVUFBVSxDQUFDLFVBQVUsQ0FBQztZQUMvQixRQUFRO1lBQ1IsTUFBTSxFQUFFLENBQUM7U0FDVixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFqRUQsZ0NBaUVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXhpc3RzU3luYywgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdAYXdzLWNkay9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTW9uaXRvcmluZ1Byb3BzIHtcbiAgYXBpTmFtZTogc3RyaW5nO1xuICBzdGFnZU5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1vbml0b3JpbmcgZXh0ZW5kcyBjZGsuQ29uc3RydWN0IHtcblxuICBwdWJsaWMgcmVhZG9ubHkgZGFzaGJvYXJkOiBjbG91ZHdhdGNoLkRhc2hib2FyZDtcblxuICBwdWJsaWMgcmVhZG9ubHkgYXBpRXJyb3JzV2lkZ2V0OiBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpTGF0ZW5jeVdpZGdldDogY2xvdWR3YXRjaC5HcmFwaFdpZGdldDtcbiAgcHVibGljIHJlYWRvbmx5IGFwaUxhdGVuY3lUYWlsV2lkZ2V0OiBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0O1xuXG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFFcnJvcnNXaWRnZXQ6IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQ7XG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFJbnZva2VzV2lkZ2V0OiBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgbGFtYmRhRHVyYXRpb25zV2lkZ2V0OiBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTW9uaXRvcmluZ1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIHRoaXMuZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiBgJHtwcm9wcy5hcGlOYW1lfS0ke3Byb3BzLnN0YWdlTmFtZX1gLFxuICAgIH0pO1xuXG4gICAgdGhpcy5hcGlFcnJvcnNXaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ0FQSSBFcnJvcnMnLFxuICAgIH0pO1xuICAgIHRoaXMuYXBpTGF0ZW5jeVdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnQVBJIExhdGVuY3knLFxuICAgIH0pO1xuICAgIHRoaXMuYXBpTGF0ZW5jeVRhaWxXaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ0FQSSBMYXRlbmN5IExvbmd0YWlsJyxcbiAgICB9KTtcblxuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICB0aGlzLmdldFRleHRXaWRnZXQoJ2FwaScpLFxuICAgICAgdGhpcy5hcGlFcnJvcnNXaWRnZXQsXG4gICAgICB0aGlzLmFwaUxhdGVuY3lXaWRnZXQsXG4gICAgICB0aGlzLmFwaUxhdGVuY3lUYWlsV2lkZ2V0LFxuICAgICk7XG5cbiAgICB0aGlzLmxhbWJkYUVycm9yc1dpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnTGFtYmRhIEVycm9ycy9UaHJvdHRsZXMnLFxuICAgIH0pO1xuICAgIHRoaXMubGFtYmRhSW52b2tlc1dpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnTGFtYmRhIEludm9jYXRpb25zJyxcbiAgICB9KTtcbiAgICB0aGlzLmxhbWJkYUR1cmF0aW9uc1dpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnTGFtYmRhIER1cmF0aW9uJyxcbiAgICB9KTtcblxuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICB0aGlzLmdldFRleHRXaWRnZXQoJ2Z1bmN0aW9ucycpLFxuICAgICAgdGhpcy5sYW1iZGFFcnJvcnNXaWRnZXQsXG4gICAgICB0aGlzLmxhbWJkYUludm9rZXNXaWRnZXQsXG4gICAgICB0aGlzLmxhbWJkYUR1cmF0aW9uc1dpZGdldCxcbiAgICApO1xuICB9XG5cbiAgZ2V0VGV4dFdpZGdldChmaWxlTmFtZTogc3RyaW5nKTogY2xvdWR3YXRjaC5UZXh0V2lkZ2V0IHtcbiAgICBjb25zdCBmaWxlID0gYC4vZGFzaGJvYXJkLyR7ZmlsZU5hbWV9Lm1kYDtcbiAgICBsZXQgbWFya2Rvd24gPSBgQ3JlYXRlIGEgZmlsZSBjYWxsZWQgJy4vZGFzaGJvYXJkLyR7ZmlsZU5hbWV9Lm1kJyB0byBkZXNjcmliZSB0aGlzIGRhc2hib2FyZGA7XG4gICAgaWYgKGV4aXN0c1N5bmMoZmlsZSkpIHtcbiAgICAgIG1hcmtkb3duID0gcmVhZEZpbGVTeW5jKGZpbGUpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IGNsb3Vkd2F0Y2guVGV4dFdpZGdldCh7XG4gICAgICBtYXJrZG93bixcbiAgICAgIGhlaWdodDogNixcbiAgICB9KTtcbiAgfVxufSJdfQ==