import { FileBase, FileBaseOptions, IResolver, Project, TextFile } from 'projen';

export interface LazyTextFileOptions extends FileBaseOptions {
  /**
   * The content provider for the file.
   */
  readonly content: (file: FileBase) => string;
}

export class LazyTextFile extends TextFile {

  private readonly content: (file: FileBase) => string;

  /**
   * Defines a text file.
   *
   * @param project The project
   * @param filePath File path
   * @param options Options
   */
  constructor(project: Project, filePath: string, options?: LazyTextFileOptions) {
    super(project, filePath, options);
    this.content = options?.content ?? (() => '');
  }

  protected synthesizeContent(_: IResolver): string | undefined {
    return this.content(this);
  }
}