import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { AwsCdkTypeScriptApp } from 'projen/lib/awscdk';
import { synthSnapshot } from 'projen/lib/util/synth';
import { RestApi } from '../../src/projen';

describe('A RestApi Projen component instance', () => {
  describe('when created on a project', () => {

    test('should synthesize its files in one go with its project from an empty base directory', () => {

      const project = new AwsCdkTypeScriptApp({
        name: 'TestProject',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      new RestApi(project, {
        apiName: 'TestApi',
        definitionFile: `${project.outdir}/testapi.yaml`,
      });

      const snap = synthSnapshot(project);

      expect(Object.keys(snap)).toContain('testapi.yaml');
      expect(Object.keys(snap)).toContain('src/lambda/rest.testapi.helloWorld.ts');
    });

    test('should not overwrite an existing openapi.yaml file', () => {
      const project = new AwsCdkTypeScriptApp({
        name: 'TestProject',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      new RestApi(project, {
        apiName: 'TestApi',
        definitionFile: `${project.outdir}/existingapi.yaml`,
      });

      const existingApiSpec = yaml.dump({
        openapi: '3.0.1',
        paths: {
          '/hello': {
            get: {
              operationId: 'existingHello',
              responses: {
                200: {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        info: {
          title: 'Existing API definition',
          version: '1.0',
        },
      });
      fs.writeFileSync(`${project.outdir}/existingapi.yaml`, existingApiSpec);

      const snap = synthSnapshot(project);

      expect(Object.keys(snap)).toContain('existingapi.yaml');
      expect(Object.keys(snap)).toContain('src/lambda/rest.testapi.existingHello.ts');
      expect(snap['existingapi.yaml']).toEqual(existingApiSpec);
    });
  });
});