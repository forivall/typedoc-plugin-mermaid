import { Converter } from 'typedoc/dist/lib/converter';
import { Component, ConverterComponent } from 'typedoc/dist/lib/converter/components';
import { Context } from 'typedoc/dist/lib/converter/context';
import { Comment, CommentTag } from 'typedoc/dist/lib/models/comments';
import { PageEvent } from 'typedoc/dist/lib/output/events';

/**
 * Mermaid plugin component.
 */
@Component({ name: 'mermaid' })
export class MermaidPlugin extends ConverterComponent {
  /**
   * 1. Load mermaid.js library.
   * 2. Initialize mermaid.
   * 3. Close body tag.
   */
  private static customScriptsAndBodyClosingTag = `
    <script
      src="https://unpkg.com/mermaid/dist/mermaid.min.js"
    ></script>
    <script>
    mermaid.initialize({
      startOnLoad: true,
    });
    </script>
    </body>
  `;

  /**
   * filter logic for Comment exist
   */
  private static filterComment(comment: undefined | Comment): comment is Comment {
    return comment !== undefined && !!comment;
  }

  /**
   * filter logic for CommentTags exist
   */
  private static filterCommentTags(tags: CommentTag[] | undefined): tags is CommentTag[] {
    return tags !== undefined && !!tags;
  }

  /**
   * return turn when tag's paramName is 'mermaid'
   */
  private static isMermaidCommentTag(tag: CommentTag): boolean {
    return tag.tagName === 'mermaid';
  }

  /**
   * get CommentTags for using `@mermaid` annotation from Context.
   */
  private static mermaidTags(context: Context): CommentTag[] {
    return Object.values(context.project.reflections) // get reflection from context
      .map(reflection => reflection.comment) // get Comment from Reflection
      .filter(this.filterComment) // filter only comment exist
      .map(comment => comment.tags) // get CommentTags from Comment
      .filter(this.filterCommentTags) // filter only CommentTags exist
      .reduce((a, b) => a.concat(b), []) // merge all CommentTags
      .filter(this.isMermaidCommentTag); // filter tag that paramName is 'mermaid'
  }

  /**
   * Regex literal that matches body closing tag.
   */
  private readonly BODY_CLOSING_TAG = /<\/body>/;

  /**
   * The first line of text wraps h4.
   * The other wraps by div classed mermaid.
   */
  public convertCommentTagText(tagText: string): string {
    const texts = tagText.split('\n');
    // take first line
    const title = texts.shift();
    // the other
    const mermaid = texts.join('\n');
    return `#### ${title} \n\n <div class="mermaid">${mermaid}</div>`;
  }

  /**
   * Insert custom script before closing body tag.
   */
  public convertPageContents(contents: string): string {
    if (this.BODY_CLOSING_TAG.test(contents)) {
      return contents.replace(this.BODY_CLOSING_TAG, MermaidPlugin.customScriptsAndBodyClosingTag);
    }
    return contents;
  }

  /**
   * listen to event on initialization
   */
  public initialize() {
    this.listenTo(this.owner, {
      [Converter.EVENT_RESOLVE_BEGIN]: this.onResolveBegin,
    }).listenTo(this.application.renderer, {
      [PageEvent.END]: this.onPageEnd,
    });
  }

  /**
   * Triggered when the converter begins converting a project.
   */
  public onResolveBegin(context: Context) {
    MermaidPlugin.mermaidTags(context).forEach(tag => {
      // convert
      tag.text = this.convertCommentTagText(tag.text);
    });
  }

  /**
   * Triggered after a document has been rendered, just before it is written to disc.
   * Remove duplicate lines to tidy up output
   */
  public onPageEnd(page: PageEvent) {
    if (page.contents !== undefined) {
      // convert
      page.contents = this.convertPageContents(page.contents);
    }
  }
}
