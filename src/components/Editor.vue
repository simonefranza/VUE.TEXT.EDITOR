<template>
  <div id="editor-container">
    <div id="text-container" @click="focus" tabindex="0">
      <div class="selection-limiter start-limiter"></div>
      <div id="text-area">
        <div style="overflow: hidden;
          position: relative;
          width: 3px;
          height: 0px;
          top: 62.5px;
          left: 73.0078px;"
        >
        </div>
        <div class="cursor-container" :style="{'visibility' : (this.showCursor ? 'initial' : 'hidden')}">
          <div id="cursor" :style="cursorStyle">&nbsp;</div>
        </div>
        <div class="text-lines">
          <pre v-for="(el,idx) in this.treeString"
            :key="idx + '#' + el"
            class="content">{{ el }}</pre>
        </div>
      </div>
      <div class="selection-limiter end-limiter"></div>
    </div>
    <!--<div id="cursor-pos">pos :{{cursorPosition}}<br/> len: {{ listLength }}<br/> currentNode: {{currentNode.pos}} {{currentNode.char}} <br/> {{ treeString }}</div>-->
    <div id="text-meta">
      <span>{{cursorPosition.row}}:{{cursorPosition.column}}</span>
      <span class="text-length">{{ lineLengths }}</span>
      <span>words: {{ wordCount }}</span>
    </div>
    {{ treeString}}
    {{ beforeIdentifier.join('-')}}
    {{ afterIdentifier.join('-')}}
  </div>
</template>

<script>
const HLCClient = require('../utils/HLCClient');
const LSEQTree = require('../utils/LSEQTree');
const HybridTimestamp = require('../utils/HybridTimestamp');
const { v4: uuidv4 } = require('uuid');

export default {
  name: 'Editor',
  data() {
    return {
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
    handleArrowLeft() {
      if (this.cursorPosition.column === 0 && this.cursorPosition.row === 0)
        return false;
      if (this.cursorPosition.column === 0 && this.cursorPosition.row > 0) {
        this.cursorPosition.row--;
        this.cursorPosition.column =
          this.treeString[this.cursorPosition.row].length;
      }
      else if (this.cursorPosition.column > 0) {
        this.cursorPosition.column -= 1;
      }
      return true;
    },
    handleArrowUp() {},
    handleArrowRight() {
      if (this.cursorPosition.row === this.treeString.length - 1 &&
        this.cursorPosition.column  === this.treeString[this.cursorPosition.row].length) {
        return false;
      }
      if (this.cursorPosition.row < this.treeString.length - 1 &&
        this.cursorPosition.column === this.treeString[this.cursorPosition.row].length) {
        this.cursorPosition.row++;
        this.cursorPosition.column = 0;
      }
      else if (this.cursorPosition.column < this.treeString[this.cursorPosition.row].length) {
        console.log("move right");
        //this.currentNode = this.currentNode.next;
        this.cursorPosition.column += 1;
      }
      return true;
    },
    handleArrowDown() {},
    handleArrow(event) {
      console.log(event.key, event.keyCode);
      event.preventDefault();
      // Left 37, up 38, right 39, down 40
      console.log("prev id", this.beforeIdentifier, this.afterIdentifier);
      let updatedPosition = false;
      switch (event.keyCode) {
        case(37):
          updatedPosition = this.handleArrowLeft();
          break;
        case(38):
          updatedPosition = this.handleArrowUp();
          break;
        case(39):
          updatedPosition = this.handleArrowRight();
          break;
        case(40):
          updatedPosition = this.handleArrowDown();
          break;
        default:
          console.error(event.keyCode, " is not an arrow key");
      }
      if (updatedPosition) {
        [this.beforeIdentifier, this.afterIdentifier] = 
          this.tree.getBeforeAfterIdentifiers(this.cursorPosition);
      }
      console.log("aft id", this.beforeIdentifier, this.afterIdentifier);
    },
    deleteFromTo(start, end) {
      console.log("deleting from ", start, end);
      for (let i = end; i > start; i--)
        this.deleteChar(i);
    },
    deleteSelection() {
      const selection = this.textSelection;
      const range = selection.getRangeAt(0);
      const anchorNode = selection.anchorNode;
      const focusNode = selection.focusNode;
      const selectionContent = selection.toString();
      console.log({anchorNode, focusNode, start: range.startOffset, end: range.endOffset});
      //if (anchorNode !== focusNode || range.startOffset === range.endOffset) {
      //  console.log("aborting deletion of selection");
      //  return '';
      //}
      this.deleteFromTo(range.startOffset, range.endOffset);
      console.log(selectionContent);
      return selectionContent;
    },
    handleBackspace(event) {
      console.log("Handle backspace");
      const selection = this.textSelection;
      if (!selection || selection.isCollapsed) {
        if (this.cursorPosition.column === 0 && this.cursorPosition.row === 0) return console.log("At pos 0, not deleting anything");
        return this.deleteChar(this.cursorPosition);
      }

      this.deleteSelection();
    },
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
    insertChar(char) {
      //let newNode = {
      //  prev: node,
      //  next: node.next,
      //  char: char,
      //  siteCounter: this.siteCounter++,
      //  uuid: this.uuid,
      //  pos: null,
      //}
      //console.log('next', node.next);
      //let insertPosition = node.next === this.listTail ?
      //  node.pos + 1 :
      //  (node.pos + node.next.pos) / 2;

      //if (node.next) node.next.prev = newNode;
      //node.next = newNode;
      //this.currentNode = newNode;
      //this.listLength += 1;
      //this.cursorPosition += 1;
      let currentCounter = this.siteCounter++;
      let uniqueID = this.uuid + '#' + currentCounter;
      this.tree.insert(
        this.beforeIdentifier,
        {char: char, uniqueID},
        this.afterIdentifier
      );
      this.cursorPosition.column += 1;
      [this.beforeIdentifier, this.afterIdentifier] = 
        this.tree.getBeforeAfterIdentifiers(this.cursorPosition);

      //this.sendChange(
      //  this.INSERT_CODE,
      //  char,
      //  currentCounter,
      //  this.uuid,
      //  insertPosition,
      //);
    },
    deleteChar(position) {
      //node.prev.next = node.next;
      //node.next.prev = node.prev;
      //this.currentNode = node.prev;
      //node.next = null;
      //node.prev = null;
      //this.cursorPosition -= 1;
      //this.listLength -= 1;
      let [identifier, ] = this.tree.getBeforeAfterIdentifiers(position);
      if (position.row > this.cursorPosition.row ||
        (position.row === this.cursorPosition.row &&
        position.column > this.cursorPosition.column)) {}
      else if (position.column === 0 && position.row <= this.cursorPosition.row) {
        this.cursorPosition.row--;
        if (position.row === this.cursorPosition.row)
          this.cursorPosition.column = this.lineLengths[this.cursorPosition.row] +
            this.cursorPosition.column;
      }
      else if (position.column !== 0 && position.row === this.cursorPosition.row) {
        this.cursorPosition.column--;
      }
      else if (position.column !== 0 && position.row < this.cursorPosition.row) {}

      this.tree.delete(identifier);
      [this.beforeIdentifier, this.afterIdentifier] = 
        this.tree.getBeforeAfterIdentifiers(this.cursorPosition);

      //this.sendChange(
      //  this.DELETE_CODE,
      //  node.char,
      //  node.siteCounter,
      //  node.uuid,
      //  node.pos,
      //);
    },
    handleKeyDown(event) {
      console.log(event);
      if (event.ctrlKey || event.metaKey) return;
      this.restartCursor();
      const key = event.key;
      const keyCode = event.keyCode;
      console.log("Key down", keyCode);
      if (keyCode >= 37 && keyCode <= 40)
        return this.handleArrow(event);
      // Backspace
      if (keyCode === 8) return this.handleBackspace(event);
      // Enter 
      if (keyCode === 13) return this.handleEnter(event);
      if (key.length > 1) return;

      this.insertChar(key);
    },
    handlePaste(event) {
      const toPaste = (event.clipboardData || window.clipboardData).getData('text');
      console.log({paste: event, data: toPaste});
      for (let i = 0; i < toPaste.length; i++)
        this.insertChar(toPaste.charAt(i));
    },
    handleCut(event) {
      console.log("cut");
      let cutText = this.deleteSelection();
      if (cutText !== '') event.clipboardData.setData('text/plain', cutText);
      event.preventDefault();
      //TODO Limit selection to editor
    },
    handleCopy(event) {
      console.log({copy: event});
      // Nothing happens
    },
    handleSelectionStart(event) {
      console.log("Sel start", event.target, event.currentTarget);
      //event.preventDefault();
    },
    handleSelection(event) {
      //console.log({selection: event, target: event.target, currTarg: event.currentTarget});
      if (window.getSelection) {
        this.textSelection = window.getSelection();
      } else if (document.getSelection) {
        this.textSelection = document.getSelection();
      } else if (document.selection) {
        this.textSelection = document.selection.createRange().text;
      }
      let hasStartLimiter = this.textSelection.containsNode(this.startLimiter);
      let hasEndLimiter = this.textSelection.containsNode(this.endLimiter);
      if (
        this.textSelection.isCollapsed ||
        document.activeElement !== this.textContainer
      )
        return;

      if (hasStartLimiter && hasEndLimiter) { 
        this.textSelection.setBaseAndExtent(
          this.textLines.firstChild.childNodes[0],
          0,
          this.textLines.lastChild.childNodes[0],
          this.lineLengths[this.lineLengths.length - 1]
        );
      }
      else if (hasStartLimiter)
        this.textSelection.setBaseAndExtent(
          this.textLines.firstChild.childNodes[0],
          0,
          this.textSelection.focusNode,
          this.textSelection.focusOffset
        );
      else if (hasEndLimiter) 
        this.textSelection.setBaseAndExtent(
          this.textSelection.anchorNode,
          this.textSelection.anchorOffset,
          this.textLines.lastChild.childNodes[0],
          this.lineLengths[this.lineLengths.length - 1]
        );


      //this.textSelection.removeAllRanges();
      //const anchorNode = this.textSelection.anchorNode;
      //const focusNode =  this.textSelection.focusNode;
      //console.log(anchorNode, focusNode, anchorNode !== focusNode);
      //if (anchorNode !== focusNode) 
      //this.textSelection.setBaseAndExtent(anchorNode, 0, anchorNode, anchorNode.length);
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
    handleRemoteInsert({ char, pos, uuid, siteCounter }) {
      console.log(`Insert ${char} at ${pos}, from ${uuid} ${siteCounter}`);
      //let prevNode = this.getNodeBefore(pos);
      //console.log('prev',prevNode, prevNode === this.listHead ? 'head' :'tail');
      //let newNode = {
      //  prev: prevNode,
      //  next: prevNode.next,
      //  char,
      //  siteCounter,
      //  uuid,
      //  pos,
      //}
      //if (newNode.next)
      //  newNode.next.prev = newNode;
      //prevNode.next = newNode;
      //console.log('current', this.currentNode);
      //this.listLength += 1;
      if (this.currentNode.pos >= pos) {
        //this.currentNode = newNode;
        this.cursorPosition.column += 1;
      }
    },
    handleRemoteDelete({ char, pos, uuid, siteCounter }) {
      console.log(`Delete ${char} at ${pos}, from ${uuid} ${siteCounter}`);
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
      console.log("ws message", message);
      try {
        let { data, time } = JSON.parse(message.data);
        let write1Stamp = new HybridTimestamp(
          time.systemTime,
          time.ticks
        );
        console.log('new data at', {data, write1Stamp});

        //this.clockClient.tick(write1Stamp);
        data.editType = this.REMOTE_EDIT;
        switch(data.code) {
          case (this.INSERT_CODE):
            this.addToInsertSet(data);
            this.handleRemoteInsert(data);
            break;
          case (this.DELETE_CODE):
            this.addToDeleteSet(data);
            //this.handleRemoteDelete(data);
            break;
          default:
            console.error('Unknown op-code', data.code);
        }
      } catch (e) {
        console.log("Error while parsing message", e);
      }
    },
    sendChange(code, char, siteCounter, uuid, pos) {
      switch(code) {
        case this.INSERT_CODE:
          this.addToInsertSet({
            char,
            editType: this.MANUAL_EDIT,
            siteCounter,
            uuid,
            pos
          });
          break;
        case this.DELETE_CODE:
          this.addToDeleteSet({
            char,
            editType: this.MANUAL_EDIT,
            siteCounter,
            uuid,
            pos
          });
          break;
        default:
          return console.error('Invalid send code');
      };
      let content = JSON.stringify({
        data: {
          code,
          char,
          siteCounter,
          uuid,
          pos 
        },
        time:  this.clockClient.nowToJSON(),
      });
      console.log("content sent", content);
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
    console.log({ uuid: this.uuid });
    this.contentElement = document.getElementsByClassName('content');
    this.textArea = document.getElementById('text-area');
    this.startLimiter = document.querySelector('.selection-limiter.start-limiter');
    this.endLimiter = document.querySelector('.selection-limiter.end-limiter');
    this.textLines = document.getElementsByClassName('text-lines')[0];
    this.textLines.addEventListener('mouseup', this.handleMouseUp);
    this.textLines.addEventListener('mousedown', this.disableCursor);
    this.textContainer = document.getElementById('text-container');
    this.textContainer.addEventListener('keydown', this.handleKeyDown);
    this.textContainer.addEventListener('selectstart', this.handleSelectionStart);
    this.textContainer.addEventListener('paste', this.handlePaste);
    this.textContainer.addEventListener('copy', this.handleCopy);
    this.textContainer.addEventListener('cut', this.handleCut);
    this.textContainer.addEventListener('focusin', this.handleFocusIn);
    this.textContainer.addEventListener('focusout', this.handleFocusOut);
    document.addEventListener('selectionchange', this.handleSelection);
    document.addEventListener('updateContent', (e) => this.treeString = e.data);
    let metrices = this.getTextMetrices();
    this.letterWidth = metrices.width;
    this.letterHeight = metrices.height;
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
  content: 'length: ';
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
