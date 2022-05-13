<template>
  <div class="container">
    <h1>HOME</h1>
    <div class="home">
      <!--<Editor></Editor>-->
      <NewEditor></NewEditor>
    </div>
  </div>
</template>

<script>
// @ is an alias to /src
//import Editor from "../../../src/components/Editor.vue";
import NewEditor from "../../../src/components/NewEditor.vue";

export default {
  name: "HomeView",
  components: {
    //Editor,
    NewEditor,
  },
  mounted() {},
};
</script>

<style lang="scss">
@import "@/assets/scss/simplemde.scss";
</style>
<style scoped lang="scss">
.container {
  display: flex;
  width: 100vw;
  height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.home {
  width: 80vw;
  height: 80vh;
  background: lavender;
  border-radius: 3rem;
  padding: 3rem;
}
</style>
