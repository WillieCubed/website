# The WillieCubed Website

_It's my personal [website][website]._

## Development

### Quickstart

To clone the repository and start the dev server:

```shell
git clone git@github.com:WillieCubed/website.git
cd website
npm install
npm run dev
```

### Setting up

Some functionality, requires additional set-up. Create a `.env.local` file at
the root of the project with the following variables:

```
NEXT_PUBLIC_GTAG_ID=
```

#### Google Analytics

To use Google Analytics, obtain a gtag ID from the Google Anlytics console, and
use the following value for the `NEXT_PUBLIC_GTAG_ID` variable.

### Architecture

This website is built using [Next.js], a React-based framework. It uses the app directory.

The website supports the following user-facing routes:

- /
  - Landing (index) page
- /about
  - A biography snippet and more
- /hi
  - A more intimate page used for quick links and contact information
  - The "link in bio"
- /media
  - An overview of my media (art) initiatives
- /projects
  - An overview of all projects
- /projects/[codename]
  - Information about a specific project
- /research
  - An overview of research activities

### Deployment

This website is [deployed][website] using [Vercel](https://vercel.com). To
deploy this yourself, use this magic button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FWillieCubed%2Fwebsite)

### Addendum: Windows Notes

Note: the Git hooks for this project assume you are using a shell environment.
If you are on Windows, you will need to use Git Bash or WSL to run this project
or follow the steps below:

1. Delete the `.husky` folder.
2. In the `package.json`, remove the `"lint-staged"` object.

Then run the dev server as normal.

[website]: https://williecubed.me
