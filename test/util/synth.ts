import * as fs from 'fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { Project } from 'projen';

export function createOpenApiDefinitionFile(project: Project, obj: any): string {
  const spec = yaml.dump(obj);
  const outputFileName = 'valid-ref.yaml';
  fs.writeFileSync(path.join(project.outdir, outputFileName), spec);
  return outputFileName;
}