<template>
  <Layout>
    <main id="index">
      <section>
        <div class="hero">
          <h1>
            Hi. I'm Willie.
          </h1>
        </div>
        <div>
          <p>
            This is sort of a mess right now, so check back in a bit, maybe 24-48 hours?
          </p>
          <p>
            Thanks so much. If you want to learn a little about me in the
            meantime, see the <g-link to="/about/">about</g-link> page.
          </p>
        </div>
      </section>
    </main>
  </Layout>
</template>

<script>
export default {
  metaInfo: {
    title: 'Home',
  },
};
</script>

<style lang="scss">
@import '../assets/main.scss';

main#index {
  text-align: center;
}

.hero {
  background-color: $background-main;
  text-color: $text-color-on-primary;
  height: 192px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

</style>
