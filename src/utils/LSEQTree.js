const { on } = require("events");

// Implementation of the LSEQ allocation function and tree
module.exports = class LSEQTree {
  constructor(base = 32, boundary = 10) {
    this.base = base;
    this.boundary = boundary;
    this.strategy = {};
    this.newlines = [];
    this.content = [];
    let begin = this.nodeFactory('', [0], '', 1);
    let end = this.nodeFactory('', [base - 1], '', 1);
    this.root = this.nodeFactory('', [], '', 0);
    this.root.children[0] = begin;
    this.root.children[base - 1] = end;
  }
  alloc(p, q) {
    console.log("alloc", p, q);
    let depth = 0;
    let interval = 0;
    let cnt = 0;
    while (interval < 1) {
      depth++;
      interval = this.computeInterval(this.prefix(p, depth), this.prefix(q, depth), depth);
      if( cnt ++ > 10) return;
    }
    let step = Math.min(this.boundary, interval);

    if (!(depth in this.strategy)) this.strategy[depth] = Math.random() < 0.5;

    let randVal = Math.random() * step;
    let newVal = Math.floor(randVal + 1);
    let newID = 0;
    if (this.strategy[depth]) {
      newID = this.prefix(p, depth);
      newID[newID.length - 1] += newVal;
    } else {
      newID = this.prefix(q, depth);
      //jnewID[newID.length - 1] = ~(~newID[newID.length - 1] + newVal);
      newID[newID.length - 1] -= newVal;
    }
    console.log({ step, newVal, randVal , round: Math.round(randVal)});
    for (let i = newID.length - 1; i > 0; i--) {
      if (newID[i] < 0) {
        newID[i] += this.getArity(i);
        newID[i - 1]--;
      }
    }
    console.log("New id", newID);
    return newID;
  }
  prefix(id, depth) {
    let idCopy = [];
    for (let cpt = 0; cpt < depth; cpt++)
      idCopy.push(cpt < id.length ? id[cpt] : 0);
    return idCopy;
  }
  // [9, 15] [10, 0]
  computeInterval(p, q, depth) {
    let distance = (q[depth - 1] === 0 ? this.getArity(depth - 1) : q[depth - 1]) - p[depth - 1] - 1;
    return distance;
  }
  nodeFactory(char, identifier, uniqueID, depth) {
    return {
      char: char,
      identifier: [...identifier],
      uniqueID: uniqueID,
      depth: depth,
      children: {},
    };
  }
  getArity(depth) {
    return this.base * (2 ** depth);
  }
  generateText(node) {
    //console.log({node, add:node.char});
    if (node.char === '\n')
      this.content.push('');
    else 
      this.content[this.content.length - 1] += node.char;
    Object.keys(node.children).forEach((idx) => {
      this.generateText(node.children[idx])
    });
  }
  remoteInsert(char, uniqueID, identifier) {
    let parent = this.root;
    for (let i = 0; i < identifier.length - 1; i++) {
      let idx = identifier[i];
      if (!(idx in parent.children)) {
        console.log('Creating child at idx', idx, 'with id', identifier.slice(0, i + 1));
        parent.children[idx] = this.nodeFactory('', identifier.slice(0, i + 1), '', parent.depth + 1);
      }
      parent = parent.children[idx];
    }
    let idx = identifier[identifier.length - 1];
    if (idx in parent.children) {
      console.error("Identifier already present!!!", ...identifier);
    }
    parent.children[idx] = this.nodeFactory(char, [...identifier], uniqueID, parent.depth + 1);
    if (char === '\n') {
      this.newlines.push(parent.children[idx].identifier);
      this.newlines.sort((a, b) => this.compareIdentifiers(a, b, this.prefix));
      console.log("Added newline");
    }
    this.update();
    let prevIdentifier = this.getPrevIdentifier(identifier)
    return this.getLineChFromIdentifier(prevIdentifier);
  }
  insert(p, data, q) {
    console.log('Insert ' + data.char + '-' + data.uniqueID + 'between', p, q);
    let newID = this.alloc(p, q);
    let parent = this.root;
    for (let i = 0; i < newID.length - 1; i++) {
      let idx = newID[i];
      if (!(idx in parent.children)) {
        console.log('Creating child at idx', idx, 'with id', newID.slice(0, i + 1));
        parent.children[idx] = this.nodeFactory('', newID.slice(0, i + 1), '', parent.depth + 1);
      }
      parent = parent.children[idx];
    }
    let idx = newID[newID.length - 1];
    parent.children[idx] = this.nodeFactory(data.char, [...newID], data.uniqueID, parent.depth + 1);
    if (data.char === '\n') {
      this.newlines.push(parent.children[idx].identifier);
      this.newlines.sort((a, b) => this.compareIdentifiers(a, b, this.prefix));
      console.log("Added newline", this.newlines);
    }
    this.update();
    return newID;
  }
  compareIdentifiers(p, q, prefixFun) {
    let maxLen = Math.max(p.length, q.length);
    let pCopy = prefixFun(p, maxLen);
    let qCopy = prefixFun(q, maxLen);
    for (let i = 0; i < maxLen; i++)
      if (pCopy[i] !== qCopy[i]) return pCopy[i] - qCopy[i];
    return 0;
  }
  update() {
    //console.log("Update");
    this.content = [''];
    this.generateText(this.root);
    console.log({tree:this.root, strats: this.strategy, string: this.content});
    let e = new Event('updateContent');
    e.data = this.content;
    document.dispatchEvent(e);
  }
  remoteDelete(char, uniqueID, identifier) {
    let node = this.getNodeAt(identifier);
    if (!this.isIdentifierEqual(node.identifier, identifier) ||
      node.uniqueID !== uniqueID)
      return {changed: false, pos: null};
    let pos = this.getLineChFromIdentifier(identifier);
    this.delete(identifier);
    return {changed: true, pos};
  }
  delete(identifier) {
    console.log("Delete", {identifier, tree:this.root});
    let hierarchy = this.getNodeHierarchy(identifier);
    if (hierarchy.length !== identifier.length + 1) {
      console.error("Node to delete not found", hierarchy);
      return null;
    }
    let hierarchyIdx = hierarchy.length - 1;
    let currentNode = hierarchy[hierarchyIdx];
    let idx = identifier[hierarchyIdx - 1];
    let toReturn = null;
    //console.log({hierarchy});

    do {
      //console.log({currentNode, idx, hierarchyIdx, len: Object.keys(currentNode.children).length});
      if (Object.keys(currentNode.children).length) {
        console.log("Setting", currentNode, "char to ''");
        currentNode.char = '';
        break;
      }
      // node doesn't have children
      hierarchyIdx--;
      currentNode = hierarchy[hierarchyIdx];
      console.log("Deleting obj", currentNode.children[idx]);
      if (currentNode.children[idx].char === '\n') {
        this.newlines.splice(this.newlines.findIndex((el) => el === currentNode.children[idx].identifier), 1);
      }
      delete currentNode.children[idx];
      idx = identifier[hierarchyIdx - 1];
      if (currentNode.char !== '' || Object.keys(currentNode.children).length) {
        console.log('breaking');
        break;
      }
      //console.log({currentNode, idx, hierarchyIdx, len: Object.keys(currentNode.children).length});

    } while (hierarchyIdx > 0);

    this.update();
    //console.log("returning", toReturn, toReturn.length === 0);
    //return toReturn;
  }
  getNodeHierarchy(identifier) {
    console.log("hierarchy for ", identifier);
    let node = this.root;
    let nodes = [node];
    for (let i = 0; i < identifier.length; i++) {
      if (!(identifier[i] in node.children)) {
        //console.log({node: node});
        console.error(`Identifier ${identifier[i]} not found in children of ${node.children}`);
        return nodes;
      }
      node = node.children[identifier[i]];
      nodes.push(node);
    }
    return nodes;
  }
  getNodeAt(identifier) {
    let node = this.root;
    for (let i = 0; i < identifier.length; i++) {
      if (!(identifier[i] in node.children)) {
        console.log("returning incomplete node for identifier", ...identifier);
        return node;
      }
      node = node.children[identifier[i]];
    }
    return node;
  }
  getLastChild(node) {
    let current = node;
    let listChildren = Object.keys(current.children);
    while (listChildren.length) {
      current = current.children[listChildren[listChildren.length - 1]];
      listChildren = Object.keys(current.children);
    }
    return current;
  }
  getPrevIdentifier(identifier) {
    console.log("get prev of", identifier);
    let lastIdx = identifier[identifier.length - 1];
    let lastFoundNode = this.getNodeAt(identifier.slice(0, identifier.length - 1));
    let parentChildren = Object.keys(lastFoundNode.children);
    if (parentChildren.length === 0) return [...lastFoundNode.identifier];
    // Is parent of searched node
    if (lastFoundNode.identifier.length === identifier.length - 1) {

      let currentNodeIndex = parentChildren.findIndex((el) => el == lastIdx);

      if (currentNodeIndex === 0) return lastFoundNode.identifier;
      if (currentNodeIndex !== -1) {
        let prevSibling = lastFoundNode.children[parentChildren[currentNodeIndex - 1]];
        let predecessor = this.getLastChild(prevSibling);
        return [...predecessor.identifier];
      }
      if (parentChildren[parentChildren.length - 1] < lastIdx) {
        let prevSibling = lastFoundNode.children[parentChildren[parentChildren.length - 1]];
        let predecessor = this.getLastChild(prevSibling);
        return [...predecessor.identifier];
      }
      // identifier not found
      for (let i = 0; i < parentChildren.length; i++) {
        if (i === 0 && parentChildren[i] > lastIdx) {
          return [...lastFoundNode.identifier];
        }
        else if (parentChildren[i] > lastIdx) {
          let prevSibling = lastFoundNode.children[parentChildren[i - 1]];
          let predecessor = this.getLastChild(prevSibling);
          return [...predecessor.identifier];
        }
      }
      console.error("Should not arrive here wtf");
      return [];
    }
    lastIdx = identifier[lastFoundNode.identifier.length];
    if (parentChildren[parentChildren.length - 1] < lastIdx) {
      let prevSibling = lastFoundNode.children[parentChildren[parentChildren.length - 1]];
      let predecessor = this.getLastChild(prevSibling);
      return [...predecessor.identifier];
    }
    // identifier not found
    for (let i = 0; i < parentChildren.length; i++) {
      if (i === 0 && parentChildren[i] > lastIdx) {
        return [...lastFoundNode.identifier];
      }
      else if (parentChildren[i] > lastIdx) {
        let prevSibling = lastFoundNode.children[parentChildren[i - 1]];
        let predecessor = this.getLastChild(prevSibling);
        return [...predecessor.identifier];
      }
    }
    console.error("Should not arrive here v2 wtf");
    return [];
  }
  getNextNode(currentNode) {
    console.log("current node", currentNode);
    let identifier = currentNode.identifier;
    let nodeChildrenIndexes = Object.keys(currentNode.children);

    if (nodeChildrenIndexes.length)
      return currentNode.children[nodeChildrenIndexes[0]];

    let lastIdx = identifier[identifier.length - 1];
    let currentIdentifier = [...identifier.slice(0, identifier.length - 1)];
    let parentNode = this.getNodeAt(currentIdentifier);
    let parentChildren = Object.keys(parentNode.children);
    let currentNodeIndex = parentChildren.findIndex((el) => el == lastIdx);
    do {
      //console.log({parentNode, lastIdx, currentNodeIndex, len: parentChildren.length, currentIdentifier, parentChildren});
      if (currentNodeIndex === -1) {
        console.error("Identifier", lastIdx, 'not included in parent children', parentChildren);
        return null;
      }

      if (currentNodeIndex !== parentChildren.length - 1) {
        console.log("Return", {parentNode, idx: currentNodeIndex + 1, node: parentNode.children[parentChildren[currentNodeIndex + 1]]});
        return parentNode.children[parentChildren[currentNodeIndex + 1]];
      }
      if (currentIdentifier.length === 0) break;
      lastIdx = currentIdentifier[currentIdentifier.length - 1];
      currentIdentifier = [...currentIdentifier.slice(
        0,
        currentIdentifier.length - 1
      )];
      parentNode = this.getNodeAt(currentIdentifier);
      parentChildren = Object.keys(parentNode.children);
      currentNodeIndex = parentChildren.findIndex((el) => el == lastIdx);
    } while (1);
    console.error("Should not arrive here");
    return null;
  }
  getNextIdentifier(identifier) {
    console.log("Get Next ID of", identifier);
    let nextNode = this.getNextNode(this.getNodeAt(identifier));
    return nextNode ? nextNode.identifier : [];
  }
  getBeforeAfterIdentifiers(stringPosition) {
    if (stringPosition.row === 0 && stringPosition.column === 0) {
      return [[0], this.getNextIdentifier([0])];
    }
    if (stringPosition.column === 0) {
      console.log('len', this.newlines.length, stringPosition.row -1);
      return [this.newlines[stringPosition.row - 1],
        this.getNextIdentifier(this.newlines[stringPosition.row - 1])];
    }

    let startNode;
    if (stringPosition.row === 0) startNode = this.root;
    else startNode = this.getNodeAt(this.newlines[stringPosition.row - 1]);
    console.log({startNode, isRoot: startNode === this.root});
    let node = this.traverseUntilPosition(startNode, stringPosition.column, 0);
    return node ? [node.identifier, this.getNextIdentifier(node.identifier)] : [[],[]];
  }
  isIdentifierBefore(a, b) {
    let len = Math.max(a.length, b.length);
    let aPrefix = this.prefix(a, len);
    let bPrefix = this.prefix(b, len);
    for (let i = 0; i < len; i++) {
      if (aPrefix[i] === bPrefix[i]) continue;
      return aPrefix[i] < bPrefix[i];
    }
    return true;
  }
  isIdentifierEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((el, idx) => el === b[idx]);
  }
  getLineChFromIdentifier(identifier) {
    let node = this.root;
    let line = -1;
    for (let i = 0; i < this.newlines.length; i++) {
      if (this.isIdentifierBefore(this.newlines[i], identifier)) continue;
      if (i === 0) { 
        line = 0;
        break;
      }
      node = this.getNodeAt(this.newlines[i - 1]);
      line = i;
      break;
    }
    if (line === -1 && this.newlines.length) {
      line = this.newlines.length;
      node = this.getNodeAt(this.newlines[line - 1]);
    }
    else if(line === -1) {
      line = 0;
    }

    let {stop, count} = this.countColumns(node, identifier, 0);
    if (!stop) {
      console.log("Stop is negative");
    }
    return {line, ch: count};
  }
  countColumns(node, stopIdentifier, count) {
    console.log("count", node, stopIdentifier);
    if (node.char !== '' && node.char !== '\n') {
      count++;
    }
    let isEqual = this.isIdentifierEqual(node.identifier, stopIdentifier);
    if (isEqual) {
      return {stop: true, count};
    }
    //let children = Object.keys(node.children);
    //for (let el of children) {
    //  let {stop, count:  newCount} = this.countColumns(node.children[el], stopIdentifier, count);
    //  count = newCount;
    //  if (stop) return {stop: true, count};
    //}
    let nextNode = this.getNextNode(node);
    if (!nextNode) return {stop: false, count};
    return this.countColumns(nextNode, stopIdentifier, count);
    //return {stop: false, count};
  }
  traverseUntilPosition(node, pos, currentValue) {
    do {
      console.log({node, pos, currentValue});
      if (node.char !== '' && node.char !== '\n') currentValue++;
      if (currentValue === pos) return node;
    } while ((node = this.getNextNode(node)));

    return null;
  }
}
