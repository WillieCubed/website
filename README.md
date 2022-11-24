# Willie's Wonderful Website

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

### Architecture

This website is built using [Next.js], a React-based framework.

### Deployment

This website is deployed using Vercel. To deploy this yourself, use this magic
button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FWillieCubed%2Fwebsite)

### Addendum: Windows Notes

Note: the Git hooks for this project assume you are using a shell environment.
If you are on Windows, you will need to use Git Bash or WSL to run this project
or follow the steps below:

1. Delete the `.husky` folder.
2. In the `package.json`, remove the `"lint-staged"` object.

Then run the dev server as normal.

[website]: https://williecubed.me
