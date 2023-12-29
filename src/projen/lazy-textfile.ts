import { IConstruct } from 'constructs';
import { FileBaseOptions, IResolver, TextFile } from 'projen';

export interface LazyTextFileOptions extends FileBaseOptions {
  /**
   * The content provider for the file.
   */
  readonly content: () => string;
}

export class LazyTextFile extends TextFile {

  private readonly content: () => string;

  /**
   * Defines a text file.
   *
   * @param project The project
   * @param filePath File path
   * @param options Options
   */
  constructor(scope: IConstruct, filePath: string, options?: LazyTextFileOptions) {
    super(scope, filePath, options);
    this.content = options?.content ?? (() => '');
  }

  protected synthesizeContent(_: IResolver): string | undefined {
    return this.content();
  }
}