export function emberCliCodeCoverageIncrement(params, hash) {
  let { path, statement, branch, condition } = hash;

  if (statement) {
    window.__coverage__[path].s[statement]++;
  }

  if (branch && condition) {
    window.__coverage__[path].b[branch][condition]++;
  }
}

export default Ember.Helper.helper(emberCliCodeCoverageIncrement);