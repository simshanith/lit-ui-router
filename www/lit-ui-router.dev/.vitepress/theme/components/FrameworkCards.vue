<script setup lang="ts">
import { frameworks } from './frameworks';
import FrameworkCard from './FrameworkCard.vue';

const carded = frameworks.filter((f) => f.blurb);
</script>

<template>
  <!-- one named group: the cards are toggles over the shared highlight the
       spectrum above also writes, not a list of unrelated controls -->
  <div
    class="framework-cards"
    role="group"
    aria-label="Frameworks on the server-support spectrum — activate a card to highlight that tool in the spectrum above"
  >
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
