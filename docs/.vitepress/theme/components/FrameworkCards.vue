<template>
  <div class="framework-cards">
    <slot />
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
