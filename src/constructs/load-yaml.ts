import fs from 'fs';
import * as yaml from 'js-yaml';
import { OpenAPI3 } from 'openapi-typescript';

export const loadYaml = (filename: string) => yaml.load(fs.readFileSync(filename).toString()) as OpenAPI3;
