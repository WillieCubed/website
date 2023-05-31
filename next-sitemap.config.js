// See https://www.npmjs.com/package/next-sitemap
/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://williecubed.me',
  // Not using process.env.VERCEL_URL here because it's not available during local build time
  generateRobotsTxt: true, // (optional)
  // ...other options
};
