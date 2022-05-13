<template>
  <div id="editor-container">
    <textarea id="editor-super"></textarea>
    <RemoteCursor :lineHeight="lineHeight"></RemoteCursor>
    <div id="text-meta">
      <span>{{cursorPosition.row}}:{{cursorPosition.column}}</span>
      <span class="text-length">{{ treeString.length }}</span>
      <span>words: {{ wordCount }}</span>
    </div>
  </div>
</template>

<script>
import SimpleMDE from "simplemde";
const HLCClient = require('../utils/HLCClient');
const LSEQTree = require('../utils/LSEQTree');
const HybridTimestamp = require('../utils/HybridTimestamp');
import RemoteCursor from './RemoteCursor.vue';
const { v4: uuidv4 } = require('uuid');
let editor = null;

export default {
  name: 'Editor',
  components: {
    RemoteCursor,
  },
  data() {
    return {
      remoteCursorPosition: null,
      lineHeight: 0,
      uuid: uuidv4(),
      siteCounter: 0,
      webSocket: null,
      clockClient: null,
      insertSet: [],
      deleteSet: [],
      listHead: null,
      listTail: null,
      textContainer: null,
      contentElement: null,
      textArea: null,
      textLines: null,
      startLimiter: null,
      endLimiter: null,
      letterWidth: null,
      letterHeight: null,
      //currentNode: null,
      cursorPosition: {
        row: 0,
        column: 0,
      },
      showCursor: false,
      blinkTime: 700,
      INSERT_CODE: 0,
      DELETE_CODE: 1,
      MANUAL_EDIT: 0,
      REMOTE_EDIT: 1,
      tree: new LSEQTree(),
      beforeIdentifier: [],
      afterIdentifier: [],
      treeString: [''],
      hideCursorInterval: null,
      textSelection: null,
    };
  },
  computed: {
    wordCount() {
      return this.treeString.reduce((a, b) => 
        a + b.split(' ').filter(el => el !== '').length, 0);
    },
    //content() {
    //  if (this.listHead.next === this.listTail) return '';
    //  let content = '';
    //  let node = this.listHead.next;
    //  do {
    //    content += node.char;
    //    node = node.next
    //  } while (node !== this.listTail);
    //  return content;
    //},
    cursorOffsetX() {
      return this.cursorPosition.column * this.letterWidth;
    },
    cursorOffsetY() {
      return this.cursorPosition.row * this.letterHeight;
    },
    cursorStyle() {
      return {
        left: this.cursorOffsetX + 'px',
        top: this.cursorOffsetY + 'px',
      };
    },
    lineLengths() {
      return this.treeString.map((el) => el.length);
    }
  },
  methods: {
    handleEnter() {
      let currentCounter = this.siteCounter++;
      let uniqueID = this.uuid + '#' + currentCounter;
      this.tree.insert(
        this.beforeIdentifier,
        {char: '\n', uniqueID},
        this.afterIdentifier
      );
      this.cursorPosition.row++;
      this.cursorPosition.column = 0; 
      [this.beforeIdentifier, this.afterIdentifier] = 
        this.tree.getBeforeAfterIdentifiers(this.cursorPosition);
    },
    insertChar(change) {
      let pos = {row: change.from.line, column: change.from.ch};
      let [beforeId, afterId] = this.tree.getBeforeAfterIdentifiers(pos);
      let stringToAdd = change.text.join('\n');
      let textLen = stringToAdd.length;
      let changes = [];
      for (let i = 0; i < textLen; i++) {
        let char = stringToAdd.charAt(i);
        let currentCounter = this.siteCounter++;
        let uniqueID = this.uuid + '#' + currentCounter;
        beforeId = this.tree.insert(
          beforeId,
          {char: char, uniqueID},
          afterId
        );
        if (char === '\n') {
          pos.row++;
          pos.column = 0;
        }
        else {
          pos.column++;
        }
        changes.push({code: this.INSERT_CODE, char, uniqueID, identifier: [...beforeId]});
      }
      return changes;
    },
    deleteChar(change) {
      let pos = {row: change.to.line, column: change.to.ch};
      let [identifier, ] = this.tree.getBeforeAfterIdentifiers(pos);

      let stringToDelete = change.removed.join('\n');
      let textLen = stringToDelete.length;
      let changes = [];
      for (let i = 0; i < textLen; i++) {
        let uniqueID = this.tree.getNodeAt(identifier).uniqueID;
        this.tree.delete(identifier);
        let deletedIdentifier = [...identifier];
        identifier = this.tree.getPrevIdentifier(identifier);
        changes.push({
          code: this.DELETE_CODE,
          char: stringToDelete[textLen - 1],
          uniqueID,
          identifier: deletedIdentifier,
        });
      }
      return changes;
    },
    getTextMetrices() {
      const canvas = this.getTextMetrices.canvas || (this.getTextMetrices.canvas = document.createElement("canvas"));
      const context = canvas.getContext("2d");
      context.font = '1rem monospace';
      const metrics = context.measureText('0');
      console.log({ width: metrics.width, height: this.contentElement[0].getBoundingClientRect().height});
      return { width: metrics.width, height: this.contentElement[0].getBoundingClientRect().height};
    },
    findNode(pos) {
      let node = this.listHead.next;
      for (let i = 0; i < pos; i++) {
        if (node === this.listTail) break;
        node = node.next;
      }
      return node;
    },
    handleFocusIn() {
      console.log('focusin');
      this.textContainer.classList.add('text-container-focus');
      this.restartCursor();
    },
    handleFocusOut() {
      console.log('focusout');
      this.textContainer.classList.remove('text-container-focus');
      this.disableCursor();
    },
    handleMouseUp(event) {
      if (this.textSelection.isCollapsed) {
        this.restartCursor();
        this.textSelection = null;
      }
      else {
        this.disableCursor();
      }

      console.log(event, event.layerX / this.letterWidth, Math.round(event.layerX / this.letterWidth));
      const position = Math.round((event.layerX + this.textArea.scrollLeft) / this.letterWidth);
      console.log({position, len: this.listLength});
      if (position > this.listLength) {
        this.cursorPosition.column = this.listLength;
        //this.currentNode = this.listTail.prev;
        return;
      }
      this.cursorPosition.column = position;
      //console.log({pos: position, node: this.findNode(this.cursorPosition - 1)});
      //this.currentNode = position === 0 ? this.listHead : this.findNode(this.cursorPosition - 1);
      [this.beforeIdentifier, this.afterIdentifier] =
        this.tree.getBeforeAfterIdentifiers(this.cursorPosition);
      console.log("New before after", this.beforeIdentifier, this.afterIdentifier);
    },
    getNodeAt(uuid, siteCounter) {
      let node = this.listHead;
      while (node.next !== this.listTail) {
        if (node.uuid === uuid && node.siteCounter === siteCounter)
        return node;
        node = node.next;
      }
      console.log('final (at)', node);
      return node;
    },
    getNodeBefore(pos) {
      console.log('get before', pos);
      let node = this.listHead;
      while (node.next !== this.listTail) {
        if (node === this.listHead) {
          if (node.next.pos >= pos) {
            console.log('saaaame');
            return node;
         }
          if (node.next.pos > pos) {
            return node;
          }
        }
        else {
          if (node.pos < pos && node.next.pos > pos) {
            return node;
          }
          if (node.pos <= pos && node.next.pos > pos) {
            console.log('same not head');
            return node;
          }
        }
        node = node.next;
      }
      console.log('final (before)', node, 'pos', pos);
      return node;
    },
    handleRemoteInsert({ char, uniqueID, identifier }) {
      console.log(`Insert ${char} at ${identifier}, from ${uniqueID}`);
      let pos = this.tree.remoteInsert(char, uniqueID, identifier);
      console.log("CHANGING", pos);
      pos.sticky = "null";
      editor.codemirror.getDoc().replaceRange(char, pos, pos, 'remote');

      let coords = editor.codemirror.cursorCoords(this.remoteCursorPosition, 'local');
      console.log(this.remoteCursorPosition, coords);
      this.emitter.emit("cursorMoved", coords);
    },
    handleRemoteDelete({ char, uniqueID, identifier }) {
      console.log(`Delete ${char} at ${identifier}, from ${uniqueID}`);
      let {changed, pos} = this.tree.remoteDelete(char, uniqueID, identifier);
      if (!changed) return
      console.log("CHANGING", pos);
      if (pos.ch !== 0)
        editor.codemirror.getDoc().replaceRange('',
          {line: pos.line, ch: pos.ch - 1},
          pos,
          'remote');
      else {
        // char is newline
        if (char !== '\n') console.error("How is column 0 but not a newline", char, uniqueID, identifier);
        let prevLineLen = editor.codemirror.getDoc().getLine(pos.line - 1).length;
        editor.codemirror.getDoc().replaceRange('',
          {line: pos.line - 1, ch: prevLineLen},
          pos,
          'remote');
      }
      let coords = editor.codemirror.cursorCoords(this.remoteCursorPosition, 'local');
      console.log(this.remoteCursorPosition, coords);
      this.emitter.emit("cursorMoved", coords);

      //let node = this.getNodeAt(uuid, siteCounter);
      //console.log('prev', node, node === this.listHead, node === this.listTail);
      //if (node === this.listHead || node === this.listTail)
      //  return console.error('matched head or tail to remove??');

      //this.listLength -= 1;
      //console.log({uuid, siteCounter, pos, nodePos: node.pos});
      //if (this.currentNode.pos >= pos) {
      //  this.cursorPosition -= 1;
      //}
      //if (node === this.currentNode) {
      //  this.currentNode = this.currentNode.prev;
      //}
      //console.log(node === this.currentNode, this.currentNode.pos, pos);
      //node.prev.next = node.next;
      //node.next.prev = node.prev;
      //node.next = null;
      //node.prev = null;
    },
    handleWSMessage(message) {
      //console.log("ws message", message);
      try {
        let parsed = JSON.parse(message.data);
        if ('cursor' in parsed) {
          this.handleRemoteCursor(parsed.cursor);
          return;
        }
        let { data, time } = parsed;
        let write1Stamp = new HybridTimestamp(
          time.systemTime,
          time.ticks
        );
        console.log('new data at', {data, write1Stamp});

        //this.clockClient.tick(write1Stamp);
        //data.editType = this.REMOTE_EDIT;
        data.forEach(change => {
          switch(change.code) {
            case (this.INSERT_CODE):
              //this.addToInsertSet(data);
              this.handleRemoteInsert(change);
              break;
            case (this.DELETE_CODE):
              //this.addToDeleteSet(data);
              this.handleRemoteDelete(change);
              break;
            default:
            console.error('Unknown op-code', data.code);
          }
        });
      } catch (e) {
        console.log("Error while parsing message", e);
      }
    },
    sendCursor(pos) {
      let content = JSON.stringify({
        cursor: pos,
      });
      console.log("CURSOR", content);
      this.webSocket.send(content);
    },
    sendChange(changes) {
      let content = JSON.stringify({
        data: changes,
        time: this.clockClient.nowToJSON(),
      });
      //console.log("content sent", content);
      this.webSocket.send(content);
    },
    addToInsertSet(dataWithCode) {
      let data = (({ code, ...rest }) => rest)(dataWithCode);
      let uniqueID = data.uuid + '#' + data.siteCounter;
      this.beforeIdentifier = this.tree.insert(
        this.beforeIdentifier,
        {char: data.char, uniqueID},
        this.afterIdentifier
      );
      this.insertSet.push(data);
      let prevNode = this.getNodeBefore(data.pos);
      let newNode = {
        prev: prevNode,
        next: prevNode.next,
        char: data.char,
        siteCounter: data.siteCounter,
        uuid: data.uuid,
        pos: data.pos,
      }
      if (newNode.next)
      newNode.next.prev = newNode;
      prevNode.next = newNode;
      if (dataWithCode.editType === this.MANUAL_EDIT) {
        this.currentNode = newNode;
        this.cursorPosition += 1;
      }
      else if (this.currentNode.pos >= data.pos) {
        this.cursorPosition += 1;
      }
    },
    addToDeleteSet(dataWithCode) {
      let data = (({ code, editType, ...rest }) => rest)(dataWithCode);
      let uniqueID = data.uuid + '#' + data.siteCounter;
      let [identifier, ] = this.tree.getBeforeAfterIdentifiers(this.cursorPosition);
      console.log('id', identifier);
      this.tree.delete(identifier, uniqueID);
      this.deleteSet.push(data);

      let node = this.getNodeAt(data.uuid, data.siteCounter);
      if (node.uuid !== data.uuid || node.siteCounter !== data.siteCounter) {
        console.log("Node not present for", dataWithCode);
        return;
      }
      if (dataWithCode.editType === this.MANUAL_EDIT) {
        this.currentNode = node.prev;
        this.cursorPosition -= 1;
      } else { 
        if (this.currentNode.pos >= data.pos) this.cursorPosition -= 1;
        if (node === this.currentNode) this.currentNode = this.currentNode.prev;
      }
      node.prev.next = node.next;
      node.next.prev = node.prev;
      node.next = null;
      node.prev = null;
    },
    disableCursor() {
      this.showCursor = false;
      clearInterval(this.hideCursorInterval);
    },
    restartCursor() {
      this.showCursor = true;
      clearInterval(this.hideCursorInterval);
      this.hideCursor();
    },
    hideCursor() {
      this.hideCursorInterval = setInterval(() => {
        this.showCursor = !this.showCursor;
        //setTimeout(() => this.restartCursor(), this.blinkTime);
      }, this.blinkTime);
    },
    handleRemoteCursor(position) {
      console.log("New remote cursor", position, editor.codemirror.cursorCoords(position, 'local'));
      this.remoteCursorPosition = position;
      let coords = editor.codemirror.cursorCoords(position, 'local');
      console.log(this.remoteCursorPosition, coords);
      this.emitter.emit("cursorMoved", coords);
    }
  },
  watch: {
    cursorPosition() {
      let scrollLeft = this.textArea.scrollLeft;
      let leftDistance = this.cursorOffsetX - 2 * this.letterWidth - scrollLeft;
      let rightDistance = scrollLeft + this.textArea.offsetWidth - 2 * this.letterWidth - this.cursorOffsetX;
      this.$nextTick(() => {
        if (leftDistance < 0)
        this.textArea.scroll({ left: scrollLeft + leftDistance, behavior: 'smooth' })
        else if (rightDistance < 0)
        this.textArea.scroll({
          left: scrollLeft - rightDistance,
          behavior: 'smooth'
        });
      });
    }
  },

  // TODO retrieve uuid and site counter from server
  created() {
    this.beforeIdentifier = [0];
    this.afterIdentifier = [this.tree.base - 1];
    //this.listHead = {
    //  prev: null,
    //  next: null,
    //  char: null,
    //  siteCounter: null,
    //  uuid: null,
    //  pos: 0,
    //};
    //this.listTail = {
    //  prev: null,
    //  next: null,
    //  char: null,
    //  siteCounter: null,
    //  uuid: null,
    //  pos: null,
    //};
    //this.listHead.next = this.listTail;
    //this.listTail.prev = this.listHead;
    //this.currentNode = this.listHead;
    this.webSocket = new WebSocket('ws://localhost:8001');
    this.webSocket.onopen = () => {
      console.log('Connection with websocket established');
      this.webSocket.send(JSON.stringify({ uuid: this.uuid }));
    };
    this.webSocket.onmessage = this.handleWSMessage;
  },
  async mounted() {
    editor = new SimpleMDE({
      placeholder: "Please type in the summary here...",
      spellChecker: false,
      toolbar: false,
      autofocus: false,
      indentWithTabs: true,
      tabSize: 4,
      indentUnit: 4,
      lineWrapping: false,
      shortCuts: [],
      status: false,
      //element: document.getElementById("editor-super"),
    });
    this.lineHeight = editor.codemirror.defaultTextHeight();
    editor.codemirror.on("cursorActivity", (cm) => {
      let cursor = cm.getDoc().getCursor();
      this.sendCursor(cursor);
      this.cursorPosition.row = cursor.line;
      this.cursorPosition.column = cursor.ch;
    });
    editor.codemirror.on("change", (_, change) => {
      console.log(change, editor.codemirror.getValue());
      // +input, paste, undo, +delete, cut
      if (change.origin === 'remote') return;
     if (change.text.length > 1 || 
        (change.text.length === 1 && change.text[0] !== '')) {
       let changes = this.insertChar(change);
       this.sendChange(changes);
     }
     if (change.removed.length > 1 || 
        (change.removed.length === 1 && change.removed[0] !== '')) {
       let changes = this.deleteChar(change);
       this.sendChange(changes);
     }
    });
    document.addEventListener('updateContent', (e) => this.treeString = e.data);
    this.clockClient = new HLCClient();
  },
};
</script>

<style scoped lang="scss">
#editor-container {
  background-color: transparent;
  width: 100%;
  height: 100%;
  text-align: justify;
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  line-height: 25px;
}
.content {
  width: 100%;
  height: 100%;
  scroll-behavior: smooth;
  min-height: 1.3rem;
  line-height: 1.3rem;
}
.cursor-container {
  position: relative;
  width: 0;
}
#cursor {
  border-left: 1.5px solid #111;
  border-right: none;
  width: 0;
  height: 1.3rem;
  position: absolute;
  -webkit-user-select: none; /* Safari */        
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE10+/Edge */
  user-select: none; /* Standard */
  z-index: 3;
}

pre {
  margin: 0;
  padding: 0;
  font-family: monospace;
  font-size: 1rem;
  z-index: 2;
}

#text-area {
  height: 100%;
  box-sizing: border-box;
  position: relative;
  overflow: scroll;
}

#text-container {
  height: 100%;
  box-sizing: border-box;
  padding: 8px;
  position: relative;
  border-radius: 0.7rem;
  box-shadow: 0 0 3px 2px #00000030;
  transition: box-shadow 150ms ease-in-out;
  &:focus-visible {
    outline: none;
  }
}
#text-container.text-container-focus {
  outline: none;
  //box-shadow: 0 0 10px 3px #000;
  box-shadow: 0 0 10px 3px #00005530;
  //TODO add before el with same size and drop shadow
  //mix-blend-mode: overlay;
}

#text-meta {
  top: 2rem;
  left: 2rem;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-inline: 0.5rem;
  color: #00000088;
  font-size: 0.8rem;
}

.text-length:before {
  content: 'lines: ';
}

.selection-limiter {
  position: fixed;
  opacity: 0;
  user-select: auto;
  &::after {
    content: '\200b';
  }
}
</style>
