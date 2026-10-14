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
    let quote: '"' | "'" | undefined;
    const heredocs: { delimiter: string; tabs: boolean }[] = [];
    return [
      source
        .split('\n')
        .map((line) => {
          if (heredocs.length) {
            const { delimiter, tabs } = heredocs[0];
            if (
              (tabs ? line.replace(/^\t+/, '') : line).replace(/\r$/, '') ===
              delimiter
            )
              heredocs.shift();
            return blank(line);
          }
          for (let index = 0; index < line.length; index++) {
            const character = line[index];
            if (character === '\\' && quote !== "'") {
              index++;
              continue;
            }
            if (quote) {
              if (character === quote) quote = undefined;
              continue;
            }
            if (character === "'" || character === '"') {
              quote = character;
              continue;
            }
            if (
              character === '#' &&
              (index === 0 || /[\s;|&()]/.test(line[index - 1]))
            ) {
              if (index === 0 && line.startsWith('#!')) return blank(line);
              return blank(line.slice(0, index)) + '//' + line.slice(index + 1);
            }
            if (line.startsWith('<<', index)) {
              const heredoc = /^<<(-?)\s*(?:'([^']+)'|"([^"]+)"|([\w-]+))/.exec(
                line.slice(index)
              );
              if (heredoc) {
                heredocs.push({
                  delimiter: heredoc[2] ?? heredoc[3] ?? heredoc[4],
                  tabs: Boolean(heredoc[1]),
                });
                index += heredoc[0].length - 1;
              }
            }
          }
          return blank(line);
        })
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
