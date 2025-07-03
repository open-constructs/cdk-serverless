import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Metric, MetricOptions } from 'aws-cdk-lib/aws-cloudwatch';
import { Permission } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { OpenAPI3 } from 'openapi-typescript';
import { LambdaFunction, LambdaFunctionProps, RestApi } from '../../src/constructs';
import { loadYaml } from '../../src/constructs/load-yaml';

jest.mock('../../src/constructs/load-yaml');
jest.mock('../../src/constructs/func');


describe('A generated RestApi', () => {

  describe('when instantiated with monitoring active', () =>{
    let stack: Stack;
    beforeEach(() => {
      const app = new App();
      stack = new Stack(app);
    });

    test('should create a Cloudwatch Dashboard', () => {
      interface Operations {
        testEndpoint: {
          responses: {
            200: {};
          };
        };
      }

      interface Paths {
        '/test': {
          get: Operations['testEndpoint'];
        };
      }

      const buffer = {
        openapi: '3.0.1',
        paths: {
          '/test': {
            get: {
              operationId: 'testEndpoint',
              responses: {
                200: {
                  content: {
                    'application/json': {},
                  },
                  description: '',
                  summary: '',
                },
              },
            },
          },
        },
        info: {
          title: 'Existing API definition',
          version: '1.0',
        },
      } as OpenAPI3;

      jest.mocked(loadYaml).mockReturnValue(buffer);
      jest.mocked(LambdaFunction).mockImplementation((_scope: Construct, _id: string, _mockProps: LambdaFunctionProps) => {
        return {
          metricDuration(_props?: MetricOptions): Metric {
            return new Metric({
              metricName: 'Duration',
              namespace: 'TestNamespace',
            });
          },
          metricInvocations(_props?: MetricOptions): Metric {
            return new Metric({
              metricName: 'Invocations',
              namespace: 'TestNamespace',
            });
          },
          metricErrors(_props?: MetricOptions): Metric {
            return new Metric({
              metricName: 'Errors',
              namespace: 'TestNamespace',
            });
          },
          metricThrottles(_props?: MetricOptions): Metric {
            return new Metric({
              metricName: 'Invocations',
              namespace: 'TestNamespace',
            });
          },
          addPermission(__id: string, __permission: Permission) {
          },
        } as LambdaFunction;
      });

      new RestApi<Paths, Operations>(stack, 'TestSubject', {
        monitoring: true,
        apiName: 'TestSubjectApi',
        definitionFileName: 'someFile',
        cors: true,
        stageName: 'test',
      });

      const template = Template.fromStack(stack);

      expect(template.findResources('AWS::CloudWatch::Dashboard')).toMatchSnapshot();

    });
  });

});