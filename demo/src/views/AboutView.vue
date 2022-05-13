<template>
  <div class="about">
    <section class="main-content">
      <textarea></textarea>
    </section>
  </div>
</template>

<script>
import SimpleMDE from "simplemde";

export default {
  name: "AboutView",
  mounted() {
    let editor = new SimpleMDE({
      placeholder: "Please type in the summary here...",
      spellChecker: false,
      toolbar: false,
      autofocus: false,
      indentWithTabs: true,
      tabSize: 4,
      indentUnit: 4,
      lineWrapping: false,
      shortCuts: [],
    });
    editor.codemirror.on("change", (_, change) => {
      console.log(change, editor.codemirror.getValue());
    });
    let str = "ciao\n\n";
    for (let i = 0; i < 5; i++) {
      editor.codemirror
        .getDoc()
        .replaceRange(str[i], { line: 0, ch: i }, { line: 0, ch: i }, "remote");
    }
    editor.codemirror
      .getDoc()
      .replaceRange(str[5], { line: 1, ch: 0 }, { line: 1, ch: 0 }, "remote");
  },
};
</script>

<style lang="scss">
@import "@/assets/scss/simplemde.scss";

.main-content {
  max-width: 64rem;
  padding: 2rem 6rem;
  margin: 0 auto;
  font-size: 1.1rem;
  text-align: justify;
}
</style>
