<script setup lang="ts">
import { frameworks } from './frameworks';
import FrameworkCard from './FrameworkCard.vue';

const carded = frameworks.filter((f) => f.blurb);
</script>

<template>
  <div class="framework-cards">
    <FrameworkCard v-for="f in carded" :key="f.id" :entry="f" />
  </div>
</template>

<style scoped>
.framework-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
  margin: 20px 0;
}
</style>
