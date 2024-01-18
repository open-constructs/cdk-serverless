import * as fs from 'fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { Project } from 'projen';

interface OpenApiDefinitionSnapshot {
  definitionFile: string;
  content: string;
}

export function createOpenApiDefinitionFile(project: Project, obj: any, filename?: string): OpenApiDefinitionSnapshot {
  const spec = yaml.dump(obj);
  const outputFileName = filename ?? 'openapi.yaml';
  fs.writeFileSync(path.join(project.outdir, outputFileName), spec);
  return { definitionFile: outputFileName, content: spec };
}