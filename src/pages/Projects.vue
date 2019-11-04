<template>
  <Layout>
    <main>
      <p>Coming soon!</p>
      <div class="projects-list">
        <project-card v-for="project in project" :key="project.id", :project="project">
        </project-card>
      </div>
    </main>
  </Layout>
</template>

<script>
import ProjectCard from '../components/ProjectCard.vue';

export default {
  components: {
    'project-card': ProjectCard,
  },
  metaInfo: {
    title: 'Willie\'s Projects',
    description: 'All the major projects that Willie Chalmers III has built.',
  },
  data() {
    return {
      projects: [],
    };
  },
};
</script>
