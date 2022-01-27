const SuiteCloudJestConfiguration = require("@oracle/suitecloud-unit-testing/jest-configuration/SuiteCloudJestConfiguration");
const SuiteCloudJestStubs = require("suitecloud-unit-testing-stubs/SuiteCloudJestStubs");

module.exports = SuiteCloudJestConfiguration.build({
  projectFolder: 'src',
  projectType: SuiteCloudJestConfiguration.ProjectType.ACP,
  customStubs: SuiteCloudJestStubs.customStubs,
});