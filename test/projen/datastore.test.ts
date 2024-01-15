import fs from 'fs';
import { AwsCdkTypeScriptApp } from 'projen/lib/awscdk';
import { synthSnapshot } from 'projen/lib/util/synth';
import { Datastore } from '../../src/projen';

describe('A Datastore projen component instance', () => {
  describe('when created on a project', () => {
    test('should synthesize its files in one go with its project from an empty base directory', () => {
      const project = new AwsCdkTypeScriptApp({
        name: 'TestProject',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      new Datastore(project, {
        modelName: 'TestModel',
        definitionFile: 'testmodel.json',
      });

      const snap = synthSnapshot(project);

      expect(Object.keys(snap)).toContain('src/generated/datastore.testmodel-model.generated.ts');
      expect(Object.keys(snap)).toContain('src/generated/datastore.testmodel-construct.generated.ts');
    });

    test('should not overwrite an existing Onetable schema definition', () => {
      const project = new AwsCdkTypeScriptApp({
        name: 'TestProject',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      new Datastore(project, {
        modelName: 'TestModel',
        definitionFile: 'existingmodel.json',
      });

      const existingOneTableSchema = {
        format: 'onetable:1.0.0',
        version: '0.1.0',
        indexes: {
          primary: {
            hash: 'PK',
            sort: 'SK',
          },
        },
        models: {
          ExistingUser: {
            PK: {
              type: 'string',
              required: true,
              value: 'ExistingUser#${name}',
            },
            SK: {
              type: 'string',
              required: true,
              value: 'ExistingUser#${name}',
            },
            name: {
              type: 'string',
              required: true,
            },
          },
        },
      };
      fs.writeFileSync(`${project.outdir}/existingmodel.json`, JSON.stringify(existingOneTableSchema));

      const snap = synthSnapshot(project);

      expect(Object.keys(snap)).toContain('existingmodel.json');
      expect(snap['existingmodel.json']).toEqual(existingOneTableSchema);
    });
  });
});