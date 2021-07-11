export function emberCliCodeCoverageIncrement(params, hash) {
  let { path, statement, branch, condition, action } = hash;

  if (action) {
    // Handles actions
    return function(...arg) {
      if (statement) {
        window.__coverage__[path].s[statement]++;
      }

      return params[0].call(this, ...arg)
    }
  }

  if (statement) {
    window.__coverage__[path].s[statement]++;
  }

  if (branch && condition != null) {
    window.__coverage__[path].b[branch][condition]++;
  }

  return params[0];
}

export default Ember.Helper.helper(emberCliCodeCoverageIncrement);