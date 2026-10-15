import type { Linter } from 'eslint';
import postcss from 'postcss';

const blank = (source: string) => source.replace(/[^\r\n]/g, ' ');

/** Preserve positions while exposing only stylesheet comments to the lint rule. */
export const stylesheetComments: Linter.Processor<string> = {
  preprocess(source) {
    const comments: [number, number][] = [];
    postcss.parse(source).walkComments((comment) => {
      const start = comment.source!.start!.offset!;
      const end = source.indexOf('*/', start) + 2;
      comments.push([start, end]);
    });
    let cursor = 0;
    let result = '';
    for (const [start, end] of comments) {
      result += blank(source.slice(cursor, start)) + source.slice(start, end);
      cursor = end;
    }
    return [result + blank(source.slice(cursor))];
  },
  postprocess(messages) {
    return messages.flat();
  },
};

/** Expose hash comments without inspecting quoted values or heredoc bodies. */
export const hashComments: Linter.Processor<string> = {
  preprocess(source) {
    const scanner = new HashCommentScanner();
    return [
      source
        .split('\n')
        .map((line) => scanner.line(line))
        .join('\n'),
    ];
  },
  postprocess(messages) {
    return messages.flat().map((message) => ({
      ...message,
      column: Math.max(1, message.column - 1),
      ...(message.endColumn ? { endColumn: message.endColumn - 1 } : {}),
    }));
  },
};

class HashCommentScanner {
  quote: '"' | "'" | undefined;
  heredocs: { delimiter: string; tabs: boolean }[] = [];

  line(line: string) {
    if (this.heredocs.length) {
      const { delimiter, tabs } = this.heredocs[0];
      if (
        (tabs ? line.replace(/^\t+/, '') : line).replace(/\r$/, '') ===
        delimiter
      )
        this.heredocs.shift();
      return blank(line);
    }
    for (let index = 0; index < line.length; index++) {
      const quoted = this.consumeQuoted(line[index]);
      if (quoted === 'escape') index++;
      if (quoted) continue;
      const comment = this.commentSuffix(line, index);
      if (comment !== null) return comment;
      index += this.consumeHeredoc(line, index);
    }
    return blank(line);
  }

  consumeQuoted(character: string) {
    if (character === '\\' && this.quote !== "'") return 'escape';
    if (this.quote) {
      if (character === this.quote) this.quote = undefined;
      return 'quoted';
    }
    if (character === "'" || character === '"') {
      this.quote = character;
      return 'quoted';
    }
    return null;
  }

  commentSuffix(line: string, index: number) {
    if (
      line[index] !== '#' ||
      !(index === 0 || /[\s;|&()]/.test(line[index - 1]))
    )
      return null;
    if (index === 0 && line.startsWith('#!')) return blank(line);
    return blank(line.slice(0, index)) + '//' + line.slice(index + 1);
  }

  consumeHeredoc(line: string, index: number) {
    const heredoc = /^<<(-?)\s*(?:'([^']+)'|"([^"]+)"|([\w-]+))/.exec(
      line.slice(index)
    );
    if (!heredoc) return 0;
    this.heredocs.push({
      delimiter: heredoc[2] ?? heredoc[3] ?? heredoc[4],
      tabs: Boolean(heredoc[1]),
    });
    return heredoc[0].length - 1;
  }
}
