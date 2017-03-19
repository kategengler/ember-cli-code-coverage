'use strict';

const LINE_ENDINGS = /(?:\r\n?|\n)/;
require('string.prototype.startswith');
function fixPath(relativePath, name, root, templateExtensions, isAddon) {
  // Handle addons
  if (isAddon) {
    // Handle addons (served from dummy app)
    if (relativePath.startsWith('dummy')) {
      relativePath = relativePath.replace('dummy', 'app');
      var dummyPath = path.join('tests', 'dummy', relativePath);
      return (
        getPathForRealFile(dummyPath, root, templateExtensions) ||
        getPathForRealFile(relativePath, root, templateExtensions) ||
        relativePath
      );
    }

    // Handle addons renaming of modules/my-addon or my-addon (depending on ember-cli version)
    var regex = new RegExp('^(modules/)?' + name + '/');
    if (regex.test(relativePath)) {
      relativePath = relativePath.replace(regex, 'addon/');
      return (
        getPathForRealFile(relativePath, root, templateExtensions) ||
        relativePath
      );
    }
  } else {
    relativePath = relativePath.replace(name, 'app');
    return getPathForRealFile(relativePath, root, templateExtensions) || relativePath;
  }

  return relativePath;
}

module.exports = function(appName, appRoot, templateExtensions, isAddon) {
  return class IstanbulInstrumenter {
    constructor(options) {

      this.options = options;

      let moduleName = options.meta.moduleName;
      let relativePath = fixPath(moduleName, appName, appRoot, templateExtensions, isAddon);

      this.relativePath = relativePath;

      this.coverageData = {
        path: this.relativePath,
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

    shouldInstrument() {
      let relativePath = this.relativePath;

      return !relativePath || relativePath.startsWith('app') || relativePath.startsWith('addon');
    }

    currentContainer() {
      return this._containerStack[this._containerStack.length - 1];
    }

    insertHelper(container, node, hash) {
      let children = container.body || container.children;
      let index = children.indexOf(node);
      let b = this.syntax.builders;

      hash.pairs.push(
        b.pair('path', b.string(this.relativePath))
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
        start: {
          line: node.loc && node.loc.start.line,
          column: node.loc && node.loc.start.column
        },
        end: {
          line: node.loc && node.loc.end.line,
          column: node.loc && node.loc.end.column
        },
      };

      this.insertStatementHelper(node);
    }

    transform(ast) {
      if (!this.shouldInstrument()) {
        return;
      }

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
};
