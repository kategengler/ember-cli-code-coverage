const LINE_ENDINGS = /(?:\r\n?|\n)/;

function getLocation({ loc }) {
  return {
    start: {
      line: loc && loc.start.line,
      column: loc && loc.start.column
    },
    end: {
      line: loc && loc.end.line,
      column: loc && loc.end.column
    }
  };
}

class TemplateCoverage {
  constructor(path, contents) {
    this.data = {
      path,
      s: {},
      b: {},
      f: {},
      fnMap: {},
      statementMap: {},
      branchMap: {},
      code: contents ? contents.split(LINE_ENDINGS) : [],
    };

    this._currentStatement = 0;
    this._currentBranch = 0;
  }

  newStatement(node) {
    this._currentStatement++;
    this.data.s[this._currentStatement] = 0;
    this.data.statementMap[this._currentStatement] = getLocation(node);

    return this._currentStatement;
  }

  newBlock(node) {
    this._currentBranch++;
    this.data.b[this._currentBranch] = [0,0];
    this.data.branchMap[this._currentBranch] = {
      loc: node.loc
    };
  }

  newBranch(node, type) {
    this._currentBranch++;
    this.data.b[this._currentBranch] = [];
    this.data.branchMap[this._currentBranch] = {
      type,
      loc: node.loc,
      locations: []
    };
    return this._currentBranch;
  }

  newBranchPath(index, node) {
    const bMeta = this.data.branchMap[index];
    const counts = this.data.b[index];

    bMeta.locations.push(getLocation(node));
    counts.push(0);
    return counts.length - 1;
  }
}

module.exports = TemplateCoverage