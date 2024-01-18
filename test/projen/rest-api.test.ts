import { AwsCdkTypeScriptApp } from 'projen/lib/awscdk';
import { synthSnapshot } from 'projen/lib/util/synth';
import { RestApi } from '../../src/projen';
import { createOpenApiDefinitionFile } from '../util/synth';

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
        definitionFile: 'testapi.yaml',
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

      const { definitionFile, content } = createOpenApiDefinitionFile(project, {
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
      }, 'existingapi.yaml');

      new RestApi(project, {
        apiName: 'TestApi',
        definitionFile,
      });

      const snap = synthSnapshot(project);

      expect(Object.keys(snap)).toContain('existingapi.yaml');
      expect(Object.keys(snap)).toContain('src/lambda/rest.testapi.existingHello.ts');
      expect(snap['existingapi.yaml']).toEqual(content);
    });
  });
});

describe('An OpenAPI3 definition with a path item declared as a reference to another path item', () => {

  describe('when synthesized', () => {

    test('should not generate a second lambda template for a path item reference', () => {

      const testApp = new AwsCdkTypeScriptApp({
        name: 'testRestApiWithPathRefs',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      const { definitionFile } = createOpenApiDefinitionFile(testApp, {
        openapi: '3.0.1',
        paths: {
          '/hello': {
            get: {
              operationId: 'helloWorld',
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
          '/helloref': {
            $ref: '#/paths/~1hello',
          },
        },
        info: {
          title: 'API with valid ref in paths',
          version: '1.0',
        },
      }, 'test-paths-with-ref.yaml');

      new RestApi(testApp, {
        apiName: 'test-paths-with-ref',
        definitionFile,
      });

      const result = synthSnapshot(testApp);

      const generatedLambdaTemplates = Object.keys(result).filter((fname) => fname.startsWith('src/lambda/rest.test-paths-with-ref'));
      expect(generatedLambdaTemplates).toHaveLength(1);
      expect(Object.keys(result)).toContain('src/lambda/rest.test-paths-with-ref.helloWorld.ts');

    });

    test('should throw when a nonexistent path item is referenced', () => {

      const testApp = new AwsCdkTypeScriptApp({
        name: 'testRestApiWithInvalidPathRefs',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      const { definitionFile } = createOpenApiDefinitionFile(testApp, {
        openapi: '3.0.1',
        paths: {
          '/hello': {
            get: {
              operationId: 'helloWorld',
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
          '/failref': {
            $ref: '#/paths/~1fail',
          },
        },
        info: {
          title: 'API with invalid ref in paths',
          version: '1.0',
        },
      }, 'test-paths-with-invalid-ref.yaml');

      new RestApi(testApp, {
        apiName: 'test-paths-with-invalid-ref',
        definitionFile,
      });

      const shouldThrow = () => {
        synthSnapshot(testApp);
      };

      expect(shouldThrow).toThrow("Path '/failref' references '#/paths/~1fail', which does not exist in this API specification");
    });

    test('should throw if a path item reference is cyclical', () => {

      const testApp = new AwsCdkTypeScriptApp({
        name: 'testRestApiWithCyclicalPathRefs',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      const { definitionFile } = createOpenApiDefinitionFile(testApp, {
        openapi: '3.0.1',
        paths: {
          '/cycle1': {
            $ref: '#/paths/~1cycle2',
          },
          '/cycle2': {
            $ref: '#/paths/~1cycle1',
          },
        },
        info: {
          title: 'API with cyclical refs in paths',
          version: '1.0',
        },
      }, 'cycles.yaml');

      new RestApi(testApp, {
        apiName: 'cycles',
        definitionFile,
      });

      const shouldThrow = () => {
        synthSnapshot(testApp);
      };

      expect(shouldThrow).toThrow('Cyclical reference exists between paths: /cycle2, /cycle1');
    });
  });

  test('should generate a RestAPI class and a data model definition within specified paths inside the project', () => {
    const testApp = new AwsCdkTypeScriptApp({
      name: 'testRestApiGeneratedFiles',
      cdkVersion: '2.1.0',
      defaultReleaseBranch: 'main',
    });

    const { definitionFile } = createOpenApiDefinitionFile(testApp, {
      openapi: '3.0.1',
      paths: {
        '/hello': {
          get: {
            operationId: 'helloWorld',
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
        title: 'Basic Hello World API',
        version: '1.0',
      },
    }, 'test-basic-file-creation.yaml');

    new RestApi(testApp, {
      apiName: 'test-basic-file-creation',
      definitionFile,
    });

    const snap = synthSnapshot(testApp);

    console.log(JSON.stringify(Object.keys(snap), undefined, 2));

    expect(Object.keys(snap)).toContain('test-basic-file-creation.yaml');
    expect(Object.keys(snap)).toContain('src/generated/rest.test-basic-file-creation-api.generated.ts');


  });
});