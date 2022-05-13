<template>
  <div class="remote-cursor">
    <div class="cursor" style="visibility: hidden">&nbsp;</div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      cursor: null,
    };
  },
  props: {
    lineHeight: {
      type: Number,
      required: true,
    },
  },
  methods: {
    repositionCursor(position) {
      this.cursor.style.visibility = 'initial';
      this.cursor.style.top = (10 + position.top) + 'px';
      this.cursor.style.left = (10 + position.left) + 'px';
    },
  },
  mounted() {
    this.cursor = document.getElementsByClassName('cursor')[0]; 
    this.cursor.style.height = (5 + this.lineHeight) + 'px';
    this.cursor.style.transform = `translateY(${-5}px)`;
    this.emitter.on("cursorMoved", (pos) => { 
      console.log("repositp", pos);
      this.repositionCursor(pos)
    });
  },
  watch: {
    lineHeight() {
      this.cursor.style.height = (3 + this.lineHeight) + 'px';
    },
  },
};
</script>

<style lang="scss" scoped>
.remote-cursor {
  z-index: 3;
}

.cursor {
  position: absolute;
  height: 25px;
  width: 1.5px;
  background: #175ED0;
  transform: translateY(-3px);
  &::after {
    content: "Partner";
    position: absolute;
    line-height: 10px;
    font-size: 10px;
    background: #175ED0;
    padding-inline: 5px;
    left: 0;
    padding-block: 1px;
    color: white;
  }
}

</style>
