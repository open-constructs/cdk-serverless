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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtY2RuLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvbnN0cnVjdHMvYXNzZXQtY2RuLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxvRkFBc0U7QUFDdEUsb0VBQXNEO0FBQ3RELDhEQUFnRDtBQUNoRCw2RUFBK0Q7QUFDL0Qsb0RBQXNDO0FBQ3RDLG1EQUFxQztBQWNyQyxNQUFhLFFBQVMsU0FBUSxHQUFHLENBQUMsU0FBUztJQU16QyxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQW9CO1FBQ2hFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQzVELFVBQVUsRUFBRSxLQUFLLENBQUMsVUFBVTtTQUM3QixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3BELGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1NBQ2xELENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDO1lBQzNCLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQztZQUNyQixjQUFjLEVBQUUsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQztZQUNwQyxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDdEIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGVBQWUsR0FBRyxHQUFHLEtBQUssQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBRS9ELE1BQU0sSUFBSSxHQUFHLElBQUksa0JBQWtCLENBQUMsdUJBQXVCLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUMvRSxVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDckIsVUFBVSxFQUFFLElBQUksQ0FBQyxlQUFlO1lBQ2hDLE1BQU0sRUFBRSxXQUFXO1NBQ3BCLENBQUMsQ0FBQztRQUVILE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxVQUFVLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLE9BQU8sRUFBRSxlQUFlLElBQUksQ0FBQyxlQUFlLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbEksSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUVqRCxNQUFNLFlBQVksR0FBRyxJQUFJLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ2xGLGFBQWEsRUFBRTtnQkFDYjtvQkFDRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxDQUFDO29CQUN4QyxjQUFjLEVBQUU7d0JBQ2QsY0FBYyxFQUFFLElBQUksQ0FBQyxXQUFXO3dCQUNoQyxvQkFBb0I7cUJBQ3JCO2lCQUNGO2FBQ0Y7WUFDRCxpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFO2dCQUN2RSxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDO2FBQ2hDLENBQUM7WUFDRixPQUFPLEVBQUUsc0JBQXNCLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFDckQsVUFBVSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsZUFBZTtZQUNqRCxvQkFBb0IsRUFBRSxVQUFVLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCO1NBQ3hFLENBQUMsQ0FBQztRQUVILElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3ZDLFVBQVUsRUFBRSxJQUFJLENBQUMsZUFBZTtZQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixNQUFNLEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxjQUFjLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDMUYsQ0FBQyxDQUFDO0lBRUwsQ0FBQztDQUNGO0FBMURELDRCQTBEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNlcnRpZmljYXRlbWFuYWdlciBmcm9tICdAYXdzLWNkay9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnQGF3cy1jZGsvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgcm91dGU1MyBmcm9tICdAYXdzLWNkay9hd3Mtcm91dGU1Myc7XG5pbXBvcnQgKiBhcyByb3V0ZTUzVGFyZ2V0cyBmcm9tICdAYXdzLWNkay9hd3Mtcm91dGU1My10YXJnZXRzJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ0Bhd3MtY2RrL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXNzZXRDZG5Qcm9wcyB7XG4gIC8qKlxuICAgKiBEb21haW4gbmFtZSBvZiB0aGUgYXNzZXQgY29udGVudCBkZWxpdmVyeSBuZXR3b3JrIChlLmcuIGV4YW1wbGUuY29tKVxuICAgKi9cbiAgZG9tYWluTmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBIb3N0bmFtZSBvZiB0aGUgYXNzZXQgY29udGVudCBkZWxpdmVyeSBuZXR3b3JrIChlLmcuIGNkbilcbiAgICovXG4gIGhvc3ROYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBBc3NldENkbiBleHRlbmRzIGNkay5Db25zdHJ1Y3Qge1xuXG4gIHB1YmxpYyByZWFkb25seSB6b25lOiByb3V0ZTUzLklIb3N0ZWRab25lO1xuICBwdWJsaWMgcmVhZG9ubHkgYXNzZXRCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGFzc2V0RG9tYWluTmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXNzZXRDZG5Qcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICB0aGlzLnpvbmUgPSByb3V0ZTUzLkhvc3RlZFpvbmUuZnJvbUxvb2t1cCh0aGlzLCAnSG9zdGVkWm9uZScsIHtcbiAgICAgIGRvbWFpbk5hbWU6IHByb3BzLmRvbWFpbk5hbWUsXG4gICAgfSk7XG5cbiAgICB0aGlzLmFzc2V0QnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQXNzZXRCdWNrZXQnLCB7XG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgIH0pO1xuICAgIHRoaXMuYXNzZXRCdWNrZXQuYWRkQ29yc1J1bGUoe1xuICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5QVVRdLFxuICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgIH0pO1xuXG4gICAgdGhpcy5hc3NldERvbWFpbk5hbWUgPSBgJHtwcm9wcy5ob3N0TmFtZX0uJHtwcm9wcy5kb21haW5OYW1lfWA7XG5cbiAgICBjb25zdCBjZXJ0ID0gbmV3IGNlcnRpZmljYXRlbWFuYWdlci5EbnNWYWxpZGF0ZWRDZXJ0aWZpY2F0ZSh0aGlzLCAnQ2VydGlmaWNhdGUnLCB7XG4gICAgICBob3N0ZWRab25lOiB0aGlzLnpvbmUsXG4gICAgICBkb21haW5OYW1lOiB0aGlzLmFzc2V0RG9tYWluTmFtZSxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgfSk7XG5cbiAgICBjb25zdCBvcmlnaW5BY2Nlc3NJZGVudGl0eSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KHRoaXMsICdPQUknLCB7IGNvbW1lbnQ6IGBTMyBGcm9udGVuZCAke3RoaXMuYXNzZXREb21haW5OYW1lfWAgfSk7XG4gICAgdGhpcy5hc3NldEJ1Y2tldC5ncmFudFJlYWQob3JpZ2luQWNjZXNzSWRlbnRpdHkpO1xuXG4gICAgY29uc3QgZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuQ2xvdWRGcm9udFdlYkRpc3RyaWJ1dGlvbih0aGlzLCAnRGlzdHJpYnV0aW9uJywge1xuICAgICAgb3JpZ2luQ29uZmlnczogW1xuICAgICAgICB7XG4gICAgICAgICAgYmVoYXZpb3JzOiBbeyBpc0RlZmF1bHRCZWhhdmlvcjogdHJ1ZSB9XSxcbiAgICAgICAgICBzM09yaWdpblNvdXJjZToge1xuICAgICAgICAgICAgczNCdWNrZXRTb3VyY2U6IHRoaXMuYXNzZXRCdWNrZXQsXG4gICAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHZpZXdlckNlcnRpZmljYXRlOiBjbG91ZGZyb250LlZpZXdlckNlcnRpZmljYXRlLmZyb21BY21DZXJ0aWZpY2F0ZShjZXJ0LCB7XG4gICAgICAgIGFsaWFzZXM6IFt0aGlzLmFzc2V0RG9tYWluTmFtZV0sXG4gICAgICB9KSxcbiAgICAgIGNvbW1lbnQ6IGBBc3NldCBlbmRwb2ludCBmb3IgJHt0aGlzLmFzc2V0RG9tYWluTmFtZX1gLFxuICAgICAgcHJpY2VDbGFzczogY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTX0FMTCxcbiAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgIH0pO1xuXG4gICAgbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnQWxpYXNSZWNvcmQnLCB7XG4gICAgICByZWNvcmROYW1lOiB0aGlzLmFzc2V0RG9tYWluTmFtZSxcbiAgICAgIHpvbmU6IHRoaXMuem9uZSxcbiAgICAgIHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKG5ldyByb3V0ZTUzVGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KGRpc3RyaWJ1dGlvbikpLFxuICAgIH0pO1xuXG4gIH1cbn0iXX0=