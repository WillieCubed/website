<template>
  <Layout>
    <main id="about">
      <div class="container">
        <h1>About me</h1>
        <p>
          I am currently pursing a Bachelor of Science in Computer Science at
          <a href="https://utdallas.edu/">The University of Texas at Dallas.</a>
        </p>
        <p>
          I started coding when I was in sophomore year of high school. Soon I built Android apps
          to feel less alone. Now I can't stop reading papers about machine learning, including
          everything from how sometimes all you need is attention to observational dropout being
          a real thing.
        </p>
        <p>
          Fun fact: I wanted to pursue a double major in computer science and cognitive science.
          I chose just computer science instead because I wanted more time for research. I'm
          exploring the idea of pursing a master's degree in cognitive science, though!
        </p>
      </div>
    </main>
  </Layout>
</template>

<script>
export default {
  metaInfo: {
    title: 'About WillieCubed',
    description: 'Willie Chalmers III is a computer science student at The University of Texas at Dallas' +
    'who really enjoys reading about and playing with machine learning and artificial intelligence.',
  },
};
</script>

<style lang="scss" scoped>
@import '../assets/main.scss';

main#about {
  display: flex;
  justify-content: center;
}
.container {
  width: 768px;
  padding: auto 0;
}
</style>