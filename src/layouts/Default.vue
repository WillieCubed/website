<template>
  <div class="layout">
    <header class="header">
      <div class="center-flex">
        <div class="header-inside">
          <strong>
            <g-link to="/">{{ $static.metadata.siteName }}</g-link>
          </strong>
          <nav class="nav">
            <g-link class="nav__link" to="/">Home</g-link>
            <g-link class="nav__link" to="/about/">About</g-link>
            <a class="nav__link" href="https://github.com/WillieCubed">GitHub</a>
          </nav>
        </div>
      </div>
    </header>
    <slot class="contents"></slot>
  </div>
</template>

<static-query>
query {
  metadata {
    siteName
  }
}
</static-query>

<style lang="scss">
@import '../assets/main.scss';

body {
  font-family: Roboto, "Segoe UI","Helvetica Neue",Arial,sans-serif;
  margin:0;
  padding:0;
  line-height: 1.5;
}

.layout {
}

.contents {
  max-width: 768px;
  margin: 0 auto;
  padding-left: 16px;
  padding-right: 16px;
}

header {
  width: 100%;
  display: flex;
  justify-content: center;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
  -webkit-flex-direction: column;
  -ms-flex-direction: column;
  flex-direction: column;
  position: relative;
  z-index: 2;
  font-size: 1.3em;
  min-height: 64px;
  width: 100%;
  box-shadow: 0 2px 5px 0 rgba(0,0,0,.26);
  height: 72px;
  background-color: $accent-color;
  text-color: $text-color-on-primary;
}

.center-flex {
  display: flex;
  justify-content: center;
}

.header-inside {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 768px;
}

.nav__link {
  margin-left: 20px;
}
</style>
