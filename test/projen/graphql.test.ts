import * as fs from 'fs';
import { AwsCdkTypeScriptApp } from 'projen/lib/awscdk';
import { synthSnapshot } from 'projen/lib/util/synth';
import { GraphQlApi } from '../../src/projen';

describe('A GraphQL projen component instance', () => {
  describe('when created on a project', () => {
    test('should synthesize its files in one go with its project from an empty base directory', () => {
      const project = new AwsCdkTypeScriptApp({
        name: 'TestProject',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      new GraphQlApi(project, {
        apiName: 'TestGraphQL',
        definitionFile: `${project.outdir}/testapi.graphql`,
      });

      const snap = synthSnapshot(project);

      expect(Object.keys(snap)).toContain('testapi.graphql');
      expect(Object.keys(snap)).toContain('graphql-codegen.testgraphql.yml');
      expect(Object.keys(snap)).toContain('src/generated/graphql.testgraphql-api.generated.ts');
    });

    test('should not overwrite an existing GraphQL schema definition', () => {
      const project = new AwsCdkTypeScriptApp({
        name: 'TestProject',
        cdkVersion: '2.1.0',
        defaultReleaseBranch: 'main',
      });

      new GraphQlApi(project, {
        apiName: 'ExistingGraphQl',
        definitionFile: `${project.outdir}/existingapi.graphql`,
      });

      const existingGraphQl = `type Query {
   existing: [ExistingUser]
}

type ExistingUser {
   id: ID!
   name: String
}`;
      fs.writeFileSync(`${project.outdir}/existingapi.graphql`, existingGraphQl);

      const snap = synthSnapshot(project);

      console.log(Object.keys(snap));

      expect(Object.keys(snap)).toContain('existingapi.graphql');
      expect(Object.keys(snap)).toContain('graphql-codegen.existinggraphql.yml');
      expect(Object.keys(snap)).toContain('src/generated/graphql.existinggraphql-api.generated.ts');

      expect(snap['existingapi.graphql']).toEqual(existingGraphQl);
    });
  });
});