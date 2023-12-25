import * as fs from 'fs';
import { AwsCdkTypeScriptApp } from 'projen/lib/awscdk';
import { synthSnapshot } from 'projen/lib/util/synth';
import { Workflow } from '../../src/projen';

describe('A Step Function Workflow projen component instance', () => {
  describe('when created on a project', () => {
    test('should synthesize its files in one go with its project from an empty base directory', () => {
      const project = new AwsCdkTypeScriptApp({
        name: 'TestProject',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      new Workflow(project, {
        workflowName: 'TestWorkflow',
        definitionFile: `${project.outdir}/testmachine.json`,
      });

      const snap = synthSnapshot(project);

      expect(Object.keys(snap)).toContain('testmachine.json');
      expect(Object.keys(snap)).toContain('src/generated/workflow.testworkflow.generated.ts');

    });

    test('should not overwrite an existing ASL JSON file', () => {
      const project = new AwsCdkTypeScriptApp({
        name: 'TestProject',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      new Workflow(project, {
        workflowName: 'ExistingWorkflow',
        definitionFile: `${project.outdir}/existingworkflow.json`,
      });

      const asl = {
        StartAt: 'Already here',
        States: {
          'Already here': {
            Type: 'Pass',
            Result: {
              Exists: true,
              Value: '${someVariable}',
            },
            End: true,
          },
        },
      };

      fs.writeFileSync(`${project.outdir}/existingworkflow.json`, JSON.stringify(asl));

      const snap = synthSnapshot(project);

      expect(Object.keys(snap)).toContain('existingworkflow.json');
      expect(Object.keys(snap)).toContain('src/generated/workflow.existingworkflow.generated.ts');
      expect(snap['existingworkflow.json']).toEqual(asl);
    });
  });
});