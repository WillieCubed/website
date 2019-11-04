# WillieCubed Website
*Much more than a project portfolio.*

TODO(docs): Actually finish this.

## About
The WillieCubed personal website showcases everything I've done, including
everything from software development to media production.

Think of this as a portfolio of portfolios.

But wait! There's more. This website not only displays past projects but also
contains live dashboards containing statuses for current and future projects
including breakdowns for project component ETAs.

## Development
This project requires Node.js and [NPM](https://www.npmjs.com/) for development.

In addition, this project uses SASS for styles. You might want that.

If you're just testing this out, start the local development server by running:
```bash
npx run gridsome develop
```

The website should be viewable at `http://localhost:8080`.

If you want to extend this, you might want to install the Gridsome CLI by
running:
```bash
npm install --global @gridsome/cli
```

Running `gridsome develop` will also start the local development server.

## Deployment
This site is deployed with Firebase Hosting, but you can use whatever static
hosting provider you want.

Run `gridsome build` then `firebase deploy` to deploy this.