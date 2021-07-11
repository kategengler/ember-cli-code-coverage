'use strict';

var path = require('path');
var TestExclude = require('test-exclude');
var TemplateCoverage = require('./template-coverage');

const HELPERS = {
  INCREMENT: 'ember-cli-code-coverage-increment',
  REGISTER: 'ember-cli-code-coverage-register'
}

module.exports = function(appRoot, templateExtensions, include, exclude) {

  const _exclude = new TestExclude({
    cwd: appRoot,
    include,
    exclude,
    extension: templateExtensions
  });

  return class TemplateInstrumenter {
    constructor(options) {
      this.options = options;
      let moduleName = options.meta.moduleName;
      if (!moduleName) {
        return;
      }
      
      this.relativePath = moduleName;
      this.fullPath = path.join(appRoot, moduleName);

      this.cov = new TemplateCoverage(this.fullPath, options.contents);
    }

    shouldInstrument() {
      return this.relativePath && _exclude.shouldInstrument(this.relativePath);
    }

    currentContainer() {
      return this._containerStack[this._containerStack.length - 1];
    }

    /* ----------------------------- HELPER METHODS ----------------------------- */
    insertStatementHelper(node) {
      let container = this.currentContainer();
      let children = container.body || container.children;
      let index = children ? children.indexOf(node) : 0;
      
      let helper = this.createHelper(null, {
        statement: this.cov._currentStatement
      });
      
      container._statementsToInsert = container._statementsToInsert || [];
      container._statementsToInsert.unshift({
        helper,
        index
      });
    }

    processStatementsToInsert(node) {
      if (node._statementsToInsert) {
        node._statementsToInsert.forEach((statement) => {
          let { helper, index } = statement;

          let children = node.children || node.body;
          children && children.splice(index, 0, helper);
        });
      }
    }

    insertBranchHelper(branchNode, parentNode, branchIndex, inline, params) {
      let helper = this.createHelper(params, {
        branch: this.cov._currentBranch,
        condition: branchIndex
      }, inline);

      if (inline) {
        return helper;
      }

      branchNode.body.unshift(helper);
    }

    handleStatement(node) {
      if (node.isCoverageHelper) { return; }

      if (node.type === 'TextNode' && node.chars.trim() === '') {
        return;
      }

      // if (this.currentContainer()._ignoreCoverage) { return; }

      // cannot process statements without a loc
      if (!node.loc) {
        return;
      }

      if (node.loc.start.line == null) {
        return;
      }
      
      if (node.path && node.path.type == 'PathExpression' && node.path.original.match(/if|unless/) && node.params.length > 1) {
        // if else statement
        let branchIndex = this.cov.newBranch(node);
        this.cov.newBranchPath(branchIndex, node.params[1]);
        let helper = this.insertBranchHelper(node.program, node, 0, true, [node.params[1]]);
        node.params[1] = helper;

        if (node.params[2]) {
          this.cov.newBranchPath(branchIndex, node.params[2]);
          let helper = this.insertBranchHelper(node.program, node, 1, true, [node.params[2]]);
          node.params[2] = helper;    
        }
      } else {
        this.cov.newStatement(node);
        this.insertStatementHelper(node);
      }
    }
    
    handleBlock(node) {
      // cannot process blocks without a loc
      if (!node.loc) {
        return;
      }

      if (node.isCoverageHelper) { return; }

      this.handleStatement(node);

      if (node.type === 'BlockStatement') {
        let branchIndex = this.cov.newBranch(node);
        this.cov.newBranchPath(branchIndex, node.program);
        this.insertBranchHelper(node.program, node, 0);
        
        if (node.inverse) {
          this.cov.newBranchPath(branchIndex, node.inverse);
          this.insertBranchHelper(node.inverse, node, 1);
        }
      }
    }

    createHelper(params, hash, isInline) {
      const b = this.syntax.builders;

      if (hash) {
        hash = b.hash(Object.keys(hash).map(key => b.pair(key, b.string(hash[key]))));
        hash.pairs.push(
          b.pair('path', b.string(this.fullPath))
        );
      }

      let helper = b[isInline ? 'sexpr' : 'mustache'](
        b.path(HELPERS.INCREMENT),
        isInline ? params : (params && params.map(p => b.string(JSON.stringify(p)))),
        hash
      );

      helper.isCoverageHelper = true;
      return helper;
    }

    transform(ast) {
      if (!this.shouldInstrument()) {
        return ast;
      }

      const b = this.syntax.builders;

      let handleBlock = {
        enter: (node) => {
          this.handleBlock(node);
          this._containerStack.push(node);
        },
        exit: (node) => {
          this.processStatementsToInsert(node);
          this._containerStack.pop();
        }
      };

      let handleStatement = (node) => this.handleStatement(node);

      let visitor = {
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
                b.path(HELPERS.REGISTER),
                [ b.string(JSON.stringify(this.cov.data)) ]
              );
              helper.isCoverageHelper = true;
              node.body.unshift(helper);
            }
            this._containerStack.pop(node)
          }
        },
        ElementNode: handleBlock,
        BlockStatement: handleBlock,
        MustacheStatement: handleStatement,
        TextNode: handleStatement,
        ElementModifierStatement: (node) => {
          const helper = this.createHelper([node.params[1]], {
            action: true,
            statement: this.cov.newStatement(node)
          }, true);

          node.params[1] = helper;
        },
        AttrNode: {
          enter: (node) => {
            if (node.value && node.value.type === 'TextNode') {
              return;
            }
            this._containerStack.push(node);
          },
          exit: (node) => {
            if (node.value && node.value.type === 'TextNode') {
              return;
            }
            this._containerStack.pop();
          }
        }
      }

      this.syntax.traverse(ast, visitor);

      return ast;
    }

  }
};
