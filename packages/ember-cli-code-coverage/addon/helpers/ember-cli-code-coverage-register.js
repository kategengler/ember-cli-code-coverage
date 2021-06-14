
export function emberCliCodeCoverageRegister([rawData]) {
  let coverageData = JSON.parse(rawData);
  window.__coverage__[coverageData.path] = coverageData;
}

export default Ember.Helper.helper(emberCliCodeCoverageRegister);