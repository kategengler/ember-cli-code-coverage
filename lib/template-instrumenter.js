'use strict';

const LINE_ENDINGS = /(?:\r\n?|\n)/;

module.exports = class IstanbulInstrumenter {
  constructor(options) {

    this.options = options;
    this.moduleName = options.meta && options.meta.moduleName;

    this.coverageData = {
      path: this.moduleName,
      s: { },
      b: { },
      f: { },
      fnMap: { },
      statementMap: { },
      branchMap: { },
      code: [ ]
    };

    this._currentStatement = 0;
    this._currentBranch = 0;

    if (options.contents) {
      this.coverageData.code = options.contents.split(LINE_ENDINGS);
    }
  }

  currentContainer() {
    return this._containerStack[this._containerStack.length - 1];
  }

  insertHelper(container, node, hash) {
    let children = container.body || container.children;
    let index = children.indexOf(node);
    let b = this.syntax.builders;

    hash.pairs.push(
      b.pair('path', b.string(this.moduleName))
    );

    let helper = b.mustache(
      b.path('ember-cli-code-coverage-increment'),
      null,
      hash
    );
    helper.isCoverageHelper = true;

    container._statementsToInsert = container._statementsToInsert || [];
    container._statementsToInsert.unshift({
      helper,
      index
    });
  }

  insertStatementHelper(node) {
    let b = this.syntax.builders;

    let hash = b.hash([
      b.pair('statement', b.string(this._currentStatement))
    ]);
    this.insertHelper(this.currentContainer(), node, hash);
  }

  insertBranchHelper(container, node, condition) {
    let b = this.syntax.builders;

    let hash = b.hash([
      b.pair('branch', b.string(this._currentBranch)),
      b.pair('condition', b.string(condition))
    ]);

    this.insertHelper(container, node, hash);
  }

  processStatementsToInsert(node) {
    if (node._statementsToInsert) {
      node._statementsToInsert.forEach((statement) => {
        let { helper, index } = statement;

        let children = node.children || node.body;
        children.splice(index, 0, helper);
      });
    }
  }

  handleBlock(node) {
    // blocks are statements
    // blocks have contents
    this.handleStatement(node);
    this._currentBranch++;
    this.coverageData.b[this._currentBranch] = 0;
    this.coverageData.branchMap[this._currentStatement] = {
      start: { line: node.loc.start.line, column: node.loc.start.column },
      end: { line: node.loc.end.line, column: node.loc.end.column },
    };

    if (node.type === 'BlockStatement') {
      this.insertBranchHelper(node.program, node);
    }
  }

  handleStatement(node) {
    if (node.type === 'TextNode' && node.chars.trim() === '') {
      return;
    }

    if (node.isCoverageHelper) { return; }

    this._currentStatement++;
    this.coverageData.s[this._currentStatement] = 0;
    this.coverageData.statementMap[this._currentStatement] = {
      start: { line: node.loc.start.line, column: node.loc.start.column },
      end: { line: node.loc.end.line, column: node.loc.end.column },
    };

    this.insertStatementHelper(node);
  }

  transform(ast) {
    let handleBlock = {
      enter: (node) => {
        this.handleBlock(node);
        this._containerStack.push(node);
      },
      exit: (node) => {
        this._containerStack.pop();
        this.processStatementsToInsert(node);
      }
    };

    let handleStatement = (node) => this.handleStatement(node);

    let b = this.syntax.builders;

    this.syntax.traverse(ast, {
      Program: {
        enter: (node) => {
          if (!this._topLevelProgram) {
            this._topLevelProgram = node;
            this._containerStack = [node];
          } else {
            this._containerStack.push(node);
          }
        },
        exit: (node) => {
          this.processStatementsToInsert(node);
          if (node === this._topLevelProgram) {
            let helper = b.mustache(
              b.path('ember-cli-code-coverage-register'),
              [
                b.string(JSON.stringify(this.coverageData))
              ]
            );
            helper.isCoverageHelper = true;

            node.body.unshift(helper);
          } else {
            this._containerStack.pop();
          }
        },
      },

      ElementNode: handleBlock,
      BlockStatement: handleBlock,
      MustacheStatement: handleStatement,
      TextNode: handleStatement,
    });

    return ast;
  }
};
