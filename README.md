# Dataview Pagination

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/mnaoumov) [![GitHub release](https://img.shields.io/github/v/release/mnaoumov/obsidian-dataview-pagination)](https://github.com/mnaoumov/obsidian-dataview-pagination/releases) [![GitHub downloads](https://img.shields.io/github/downloads/mnaoumov/obsidian-dataview-pagination/total)](https://github.com/mnaoumov/obsidian-dataview-pagination/releases)

Adds pagination to [Dataview](https://community.obsidian.md/plugins/dataview) tables and lists, so a query with thousands of results stays fast and readable.

It needs `Dataview` installed and enabled.

## What it does

1. Pages every DQL `TABLE` and `LIST` and every `dv.table` and `dv.list` view.
2. Adds First, Previous, page numbers, Next and Last, a page-size dropdown, a jump-to-page box and the total count.
3. Keeps your place when the vault changes and the view refreshes.
4. Leaves `TASK` and `CALENDAR` queries, and results that fit on one page, exactly as they were.

## Demo vault

**The documentation is a demo vault.** Every feature has a note that explains what it does and why you would want it, with a button you can press to watch it happen.

**[Start reading here](<./demo-vault/00 Start.md>)** — it is plain markdown, so it works on `GitHub` with nothing installed.

A copy of the vault ships with every release. You can access it via any of the following:

1. Running the **`Dataview Pagination`: Open demo vault** command.
2. Downloading `dataview-pagination-demo-vault.zip` from the [Releases](https://github.com/mnaoumov/obsidian-dataview-pagination/releases). It unzips into a single `dataview-pagination-demo-vault-<version>` folder.
3. Browsing its source in [`demo-vault/`](./demo-vault/README.md) in this repository.

## See also

[My other Obsidian resources](https://mnaoumov.dev/obsidian/)

| Plugin | Features | How `Dataview Pagination` differs |
| --- | --- | --- |
| [Bases Paginator](https://community.obsidian.md/plugins/bases-paginator) | Paginated table view for Bases; quick filtering | Different renderer; pages `Dataview`, not Bases |
| [Bases Utilities](https://community.obsidian.md/plugins/bases-utilities) | Pagination and column search for Bases | Different renderer; pages `Dataview`, not Bases |
| [Datacore](https://community.obsidian.md/plugins/datacore) | `Dataview`'s successor, with paging built in | Same goal for existing `Dataview` queries; no rewrite needed |
| [QueryDash](https://community.obsidian.md/plugins/querydash) | New Bases views with search, sorting and pagination | Different renderer; pages `Dataview`, not Bases |

Last searched for similar plugins on 2026-11-08.

## Installation

The plugin is not available in [the official Community Plugins repository](https://community.obsidian.md) yet.

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://community.obsidian.md) or not), follow these steps:

1. Ensure you have the [BRAT plugin](https://community.obsidian.md/plugins/obsidian42-brat) installed and enabled.
2. Click [Install via BRAT](https://intradeus.github.io/http-protocol-redirector?r=obsidian://brat?plugin=https://github.com/mnaoumov/obsidian-dataview-pagination).
3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Development checks

Run `npm run check` to run release checks and reproduce the Community directory scanner's findings locally with `check-plugin --scanner`. See [CONTRIBUTING](./CONTRIBUTING.md) for setup. The scanner needs network access and installs its linters on each run, which can take a few minutes.

## Debugging

By default, debug messages for this plugin (id: `dataview-pagination`) are hidden.

If you need to enable them refer to the [documentation](https://mnaoumov.dev/obsidian-lib/guides/debugging/).

## Contributing

Contributions are welcome — see [CONTRIBUTING](./CONTRIBUTING.md) to get set up.

## Support

<!-- markdownlint-disable MD033 -->

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank">Support this plugin</a>

<!-- markdownlint-enable MD033 -->

### Filing an issue (for AI agents and humans)

Open issues through the [issue forms](https://github.com/mnaoumov/obsidian-dataview-pagination/issues/new/choose), not as blank issues.

To report a bug from inside Obsidian, run the **`Dataview Pagination`: Report a bug** command. It opens the bug form with the plugin version, the Obsidian version and your operating system already filled in.

Filing from the CLI or the API (`gh issue create --body`, or an AI agent filing for you) skips the form, and `gh issue create --template` cannot load an issue form. In that case, open the matching form in [`.github/ISSUE_TEMPLATE/`](https://github.com/mnaoumov/obsidian-dataview-pagination/tree/HEAD/.github/ISSUE_TEMPLATE), copy every field as a `### <label>` heading in the form's order, and fill in each one. Always state the plugin version, the Obsidian version and your operating system.

## License

© [mnaoumov](https://github.com/mnaoumov/)
