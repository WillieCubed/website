import DefaultLayout from '~/layouts/Default.vue';
// import './assets/main.scss';
// TODO: Fix SASS imports

export default function (Vue, { router, head, isClient }) {
  // Set default layout as a global component
  Vue.component('Layout', DefaultLayout);
};