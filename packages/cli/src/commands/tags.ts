import type {
  Tag,
} from '@karotto/core';
import type { Argv } from 'yargs';
import {
  context,
  resolveTagIds,
} from '@/context';
import type { Globals } from '@/context';
import {
  fail,
  print,
  shortId,
  table,
} from '@/output';

export function registerTags(parser: Argv<Globals>): Argv<Globals> {
  return parser
    .command(
      'tags',
      'Manage tags',
      (cmd) => cmd
        .command(
          'list',
          'List tags',
          () => undefined,
          async (argv) => {
            const ctx = context(argv);
            try {
              const tags = await ctx.api.get<Tag[]>('/tags');
              print(
                ctx.output,
                tags,
                () => (tags.length === 0
                  ? 'No tags'
                  : table(tags.map((tag) => [
                      shortId(tag.id),
                      tag.name,
                    ]))),
              );
            } catch (error) {
              fail(
                ctx.output,
                error,
              );
            }
          },
        )
        .command(
          'add <name>',
          'Create a tag',
          (sub) => sub.positional(
            'name',
            {
              type: 'string',
              demandOption: true,
            },
          ),
          async (argv) => {
            const ctx = context(argv);
            try {
              const tag = await ctx.api.post<Tag>(
                '/tags',
                { name: argv.name },
              );
              print(
                ctx.output,
                tag,
                () => `Created tag ${tag.name}`,
              );
            } catch (error) {
              fail(
                ctx.output,
                error,
              );
            }
          },
        )
        .command(
          'rename <name> <newName>',
          'Rename a tag',
          (sub) => sub
            .positional(
              'name',
              {
                type: 'string',
                demandOption: true,
              },
            )
            .positional(
              'newName',
              {
                type: 'string',
                demandOption: true,
              },
            ),
          async (argv) => {
            const ctx = context(argv);
            try {
              const [id] = await resolveTagIds(
                ctx.api,
                [argv.name],
                false,
              );
              const tag = await ctx.api.patch<Tag>(
                `/tags/${id}`,
                { name: argv.newName },
              );
              print(
                ctx.output,
                tag,
                () => `Renamed to ${tag.name}`,
              );
            } catch (error) {
              fail(
                ctx.output,
                error,
              );
            }
          },
        )
        .command(
          'rm <name>',
          'Delete a tag',
          (sub) => sub.positional(
            'name',
            {
              type: 'string',
              demandOption: true,
            },
          ),
          async (argv) => {
            const ctx = context(argv);
            try {
              const [id] = await resolveTagIds(
                ctx.api,
                [argv.name],
                false,
              );
              await ctx.api.delete(`/tags/${id}`);
              print(
                ctx.output,
                { deleted: id },
                () => `Deleted tag ${argv.name}`,
              );
            } catch (error) {
              fail(
                ctx.output,
                error,
              );
            }
          },
        )
        .demandCommand(1),
    );
}
