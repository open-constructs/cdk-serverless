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
exports.AssetCdn = void 0;
const certificatemanager = __importStar(require("@aws-cdk/aws-certificatemanager"));
const cloudfront = __importStar(require("@aws-cdk/aws-cloudfront"));
const route53 = __importStar(require("@aws-cdk/aws-route53"));
const route53Targets = __importStar(require("@aws-cdk/aws-route53-targets"));
const s3 = __importStar(require("@aws-cdk/aws-s3"));
const cdk = __importStar(require("@aws-cdk/core"));
class AssetCdn extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        this.zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
            domainName: props.domainName,
        });
        this.assetBucket = new s3.Bucket(this, 'AssetBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });
        this.assetBucket.addCorsRule({
            allowedHeaders: ['*'],
            allowedMethods: [s3.HttpMethods.PUT],
            allowedOrigins: ['*'],
        });
        this.assetDomainName = `${props.hostName}.${props.domainName}`;
        const cert = new certificatemanager.DnsValidatedCertificate(this, 'Certificate', {
            hostedZone: this.zone,
            domainName: this.assetDomainName,
            region: 'us-east-1',
        });
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', { comment: `S3 Frontend ${this.assetDomainName}` });
        this.assetBucket.grantRead(originAccessIdentity);
        const distribution = new cloudfront.CloudFrontWebDistribution(this, 'Distribution', {
            originConfigs: [
                {
                    behaviors: [{ isDefaultBehavior: true }],
                    s3OriginSource: {
                        s3BucketSource: this.assetBucket,
                        originAccessIdentity,
                    },
                },
            ],
            viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(cert, {
                aliases: [this.assetDomainName],
            }),
            comment: `Asset endpoint for ${this.assetDomainName}`,
            priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        });
        new route53.ARecord(this, 'AliasRecord', {
            recordName: this.assetDomainName,
            zone: this.zone,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
        });
    }
}
exports.AssetCdn = AssetCdn;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtY2RuLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnN0cnVjdHMvYXNzZXQtY2RuLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxvRkFBc0U7QUFDdEUsb0VBQXNEO0FBQ3RELDhEQUFnRDtBQUNoRCw2RUFBK0Q7QUFDL0Qsb0RBQXNDO0FBQ3RDLG1EQUFxQztBQU9yQyxNQUFhLFFBQVMsU0FBUSxHQUFHLENBQUMsU0FBUztJQU16QyxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQW9CO1FBQ2hFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQzVELFVBQVUsRUFBRSxLQUFLLENBQUMsVUFBVTtTQUM3QixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3BELGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1NBQ2xELENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDO1lBQzNCLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQztZQUNyQixjQUFjLEVBQUUsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQztZQUNwQyxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDdEIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGVBQWUsR0FBRyxHQUFHLEtBQUssQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBRS9ELE1BQU0sSUFBSSxHQUFHLElBQUksa0JBQWtCLENBQUMsdUJBQXVCLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUMvRSxVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDckIsVUFBVSxFQUFFLElBQUksQ0FBQyxlQUFlO1lBQ2hDLE1BQU0sRUFBRSxXQUFXO1NBQ3BCLENBQUMsQ0FBQztRQUVILE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxVQUFVLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLE9BQU8sRUFBRSxlQUFlLElBQUksQ0FBQyxlQUFlLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbEksSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUVqRCxNQUFNLFlBQVksR0FBRyxJQUFJLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ2xGLGFBQWEsRUFBRTtnQkFDYjtvQkFDRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxDQUFDO29CQUN4QyxjQUFjLEVBQUU7d0JBQ2QsY0FBYyxFQUFFLElBQUksQ0FBQyxXQUFXO3dCQUNoQyxvQkFBb0I7cUJBQ3JCO2lCQUNGO2FBQ0Y7WUFDRCxpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFO2dCQUN2RSxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDO2FBQ2hDLENBQUM7WUFDRixPQUFPLEVBQUUsc0JBQXNCLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFDckQsVUFBVSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsZUFBZTtZQUNqRCxvQkFBb0IsRUFBRSxVQUFVLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCO1NBQ3hFLENBQUMsQ0FBQztRQUVILElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3ZDLFVBQVUsRUFBRSxJQUFJLENBQUMsZUFBZTtZQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxjQUFjLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDMUYsQ0FBQyxDQUFDO0lBRUwsQ0FBQztDQUNGO0FBMURELDRCQTBEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNlcnRpZmljYXRlbWFuYWdlciBmcm9tICdAYXdzLWNkay9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnQGF3cy1jZGsvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgcm91dGU1MyBmcm9tICdAYXdzLWNkay9hd3Mtcm91dGU1Myc7XG5pbXBvcnQgKiBhcyByb3V0ZTUzVGFyZ2V0cyBmcm9tICdAYXdzLWNkay9hd3Mtcm91dGU1My10YXJnZXRzJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ0Bhd3MtY2RrL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXNzZXRDZG5Qcm9wcyB7XG4gIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgaG9zdE5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEFzc2V0Q2RuIGV4dGVuZHMgY2RrLkNvbnN0cnVjdCB7XG5cbiAgcHVibGljIHJlYWRvbmx5IHpvbmU6IHJvdXRlNTMuSUhvc3RlZFpvbmU7XG4gIHB1YmxpYyByZWFkb25seSBhc3NldEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYXNzZXREb21haW5OYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBc3NldENkblByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIHRoaXMuem9uZSA9IHJvdXRlNTMuSG9zdGVkWm9uZS5mcm9tTG9va3VwKHRoaXMsICdIb3N0ZWRab25lJywge1xuICAgICAgZG9tYWluTmFtZTogcHJvcHMuZG9tYWluTmFtZSxcbiAgICB9KTtcblxuICAgIHRoaXMuYXNzZXRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdBc3NldEJ1Y2tldCcsIHtcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgfSk7XG4gICAgdGhpcy5hc3NldEJ1Y2tldC5hZGRDb3JzUnVsZSh7XG4gICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLlBVVF0sXG4gICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFzc2V0RG9tYWluTmFtZSA9IGAke3Byb3BzLmhvc3ROYW1lfS4ke3Byb3BzLmRvbWFpbk5hbWV9YDtcblxuICAgIGNvbnN0IGNlcnQgPSBuZXcgY2VydGlmaWNhdGVtYW5hZ2VyLkRuc1ZhbGlkYXRlZENlcnRpZmljYXRlKHRoaXMsICdDZXJ0aWZpY2F0ZScsIHtcbiAgICAgIGhvc3RlZFpvbmU6IHRoaXMuem9uZSxcbiAgICAgIGRvbWFpbk5hbWU6IHRoaXMuYXNzZXREb21haW5OYW1lLFxuICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IG9yaWdpbkFjY2Vzc0lkZW50aXR5ID0gbmV3IGNsb3VkZnJvbnQuT3JpZ2luQWNjZXNzSWRlbnRpdHkodGhpcywgJ09BSScsIHsgY29tbWVudDogYFMzIEZyb250ZW5kICR7dGhpcy5hc3NldERvbWFpbk5hbWV9YCB9KTtcbiAgICB0aGlzLmFzc2V0QnVja2V0LmdyYW50UmVhZChvcmlnaW5BY2Nlc3NJZGVudGl0eSk7XG5cbiAgICBjb25zdCBkaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5DbG91ZEZyb250V2ViRGlzdHJpYnV0aW9uKHRoaXMsICdEaXN0cmlidXRpb24nLCB7XG4gICAgICBvcmlnaW5Db25maWdzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBiZWhhdmlvcnM6IFt7IGlzRGVmYXVsdEJlaGF2aW9yOiB0cnVlIH1dLFxuICAgICAgICAgIHMzT3JpZ2luU291cmNlOiB7XG4gICAgICAgICAgICBzM0J1Y2tldFNvdXJjZTogdGhpcy5hc3NldEJ1Y2tldCxcbiAgICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgdmlld2VyQ2VydGlmaWNhdGU6IGNsb3VkZnJvbnQuVmlld2VyQ2VydGlmaWNhdGUuZnJvbUFjbUNlcnRpZmljYXRlKGNlcnQsIHtcbiAgICAgICAgYWxpYXNlczogW3RoaXMuYXNzZXREb21haW5OYW1lXSxcbiAgICAgIH0pLFxuICAgICAgY29tbWVudDogYEFzc2V0IGVuZHBvaW50IGZvciAke3RoaXMuYXNzZXREb21haW5OYW1lfWAsXG4gICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfQUxMLFxuICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgfSk7XG5cbiAgICBuZXcgcm91dGU1My5BUmVjb3JkKHRoaXMsICdBbGlhc1JlY29yZCcsIHtcbiAgICAgIHJlY29yZE5hbWU6IHRoaXMuYXNzZXREb21haW5OYW1lLFxuICAgICAgem9uZTogdGhpcy56b25lLFxuICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMobmV3IHJvdXRlNTNUYXJnZXRzLkNsb3VkRnJvbnRUYXJnZXQoZGlzdHJpYnV0aW9uKSksXG4gICAgfSk7XG5cbiAgfVxufSJdfQ==