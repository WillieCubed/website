<template>
  <div class="project-card">
    <div class="project-card--header">
      <div class="project-card--name"
        {{name}}
      </div>
      <div class="project-card--dates">
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'project-card',
  props: {
    id: String,
    name: String,
    description: String,
    technologies: Array,
    startDate: Date,
    endDate: Date,
  },
};
</script>

<style lang="scss">

</style>