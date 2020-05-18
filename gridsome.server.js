// eslint-disable-next-line no-unused-expressions
require('dotenv').config;
const axios = require('axios').default;

const WILLIECUBED_API = 'https://api.williecubed.me/v0';
const PROJECTS_ENDPOINT = 'projects';

module.exports = async function (api) {
  const instance = axios.create({
    baseURL: WILLIECUBED_API,
    headers: {
      Bearer: process.env.WILLIECUBED_API_KEY || 'test',
    },
  });
  try {
    const projects = (await instance.get(PROJECTS_ENDPOINT)).data;
    api.loadSource(({ addCollection }) => {
      const projectsCollection = addCollection('Projects');
      projects.forEach(projectsCollection.addNode);
      addCollection('MediaInitiatives');
    });
    api.createPages(({ createPage }) => {
      projects.forEach((project) => {
        createPage({
          path: `/projects/${project.id}`,
          component: './src/templates/Project.vue',
        });
      });
    });
  } catch (e) {
    console.error('Could not fetch information.', e);
  }
};
