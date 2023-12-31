import fs from 'fs';
import path from 'path';
import { Component, Project } from 'projen';

/**
 * SampleDir options
 */
export interface LazySampleDirOptions {
  /**
   * The files to render into the directory.
   */
  readonly fileGenerator: () => {
    [fileName: string]: () => string;
  };
}

/**
 * Renders the given files into the directory if the files do not exist. Use this to create sample code files
 */
export class LazySampleDir extends Component {
  private readonly dir: string;
  private readonly options: LazySampleDirOptions;

  /**
   * Create sample files in the given directory if the given directory does not exist
   * @param project Parent project to add files to.
   * @param dir directory to add files to. If directory already exists, nothing is added.
   * @param options options for which files to create.
   */
  constructor(project: Project, dir: string, options: LazySampleDirOptions) {
    super(project);
    this.dir = dir;
    this.options = options;
  }

  public synthesize() {
    const fullOutdir = path.join(this.project.outdir, this.dir);

    // previously creating the directory to allow empty dirs to be created
    fs.mkdirSync(fullOutdir, { recursive: true });

    const files = this.options.fileGenerator();
    for (const filename in files) {
      writeFile(path.join(fullOutdir, filename), files[filename]);
    }
  }
}

function writeFile(filePath: string, contentGenerator: (() => string)) {
  if (fs.existsSync(filePath)) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contentGenerator());
}