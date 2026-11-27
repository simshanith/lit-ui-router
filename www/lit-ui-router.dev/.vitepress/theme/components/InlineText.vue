<script setup lang="ts">
import { splitInlineCode } from './faceted-index';

defineProps<{
  /** Text whose backtick spans render as code. */
  text: string;
}>();
</script>

<template>
  <template v-for="(seg, idx) in splitInlineCode(text)" :key="idx">
    <code v-if="seg.code">{{ seg.text }}</code>
    <template v-else>{{ seg.text }}</template>
  </template>
</template>
