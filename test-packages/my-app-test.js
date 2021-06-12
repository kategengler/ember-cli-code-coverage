'use strict';

const fs = require('fs-extra');
const util = require('util');
const rimraf = util.promisify(require('rimraf'));
const { dir, file } = require('chai-files');
const path = require('path');
const execa = require('execa');

const BASE_PATH = path.join(__dirname, 'my-app');

describe('app coverage generation', function () {
  jest.setTimeout(10000000);

  beforeEach(async function () {
    await rimraf(`${BASE_PATH}/coverage*`);
    await execa('git', ['clean', '-f', 'my-app'], { cwd: __dirname });
    await execa('git', ['restore', 'my-app'], { cwd: __dirname });
  });

  afterEach(async function () {
    await rimraf(`${BASE_PATH}/coverage*`);
    await execa('git', ['clean', '-f', 'my-app'], { cwd: __dirname });
    await execa('git', ['restore', 'my-app'], { cwd: __dirname });
  });

  it('runs coverage when env var is set', async function () {
    dir(`${BASE_PATH}/coverage`).assertDoesNotExist();

    let env = { COVERAGE: 'true' };
    await execa('ember', ['test'], { cwd: BASE_PATH, env });
    file(`${BASE_PATH}/coverage/lcov-report/index.html`).assertIsNotEmpty();
    file(`${BASE_PATH}/coverage/index.html`).assertIsNotEmpty();

    let summary = fs.readJSONSync(`${BASE_PATH}/coverage/coverage-summary.json`);
    expect(summary).toMatchSnapshot();
  });

  it('does not run coverage when env var is NOT set', async function () {
    dir(`${BASE_PATH}/coverage`).assertDoesNotExist();

    let env = { COVERAGE: 'false' };
    await execa('ember', ['test'], { cwd: BASE_PATH, env });
    dir(`${BASE_PATH}/coverage`).assertDoesNotExist();
  });

  it('excludes files when the configuration is set', async function () {
    fs.copySync(`${BASE_PATH}/config/-coverage-excludes.js`, `${BASE_PATH}/config/coverage.js`);

    let env = { COVERAGE: 'true' };
    await execa('ember', ['test'], { cwd: BASE_PATH, env });
    file(`${BASE_PATH}/coverage/lcov-report/index.html`).assertIsNotEmpty();
    file(`${BASE_PATH}/coverage/index.html`).assertIsNotEmpty();

    let summary = fs.readJSONSync(`${BASE_PATH}/coverage/coverage-summary.json`);
    expect(summary).toMatchSnapshot();
  });

  it('runs coverage when the path option is used', async function () {
    dir(`${BASE_PATH}/coverage`).assertDoesNotExist();

    let env = { COVERAGE: 'true' };
    await execa('ember', ['build', '--output-path=test-dist'], { cwd: BASE_PATH, env });
    await execa('ember', ['test', '--path=test-dist'], { cwd: BASE_PATH, env });
    file(`${BASE_PATH}/coverage/lcov-report/index.html`).assertIsNotEmpty();
    file(`${BASE_PATH}/coverage/index.html`).assertIsNotEmpty();

    let summary = fs.readJSONSync(`${BASE_PATH}/coverage/coverage-summary.json`);
    expect(summary).toMatchSnapshot();
  });

  it('merges coverage when tests are run in parallel', async function () {
    dir(`${BASE_PATH}/coverage`).assertDoesNotExist();

    let env = { COVERAGE: 'true' };
    await execa('ember', ['exam', '--split=2', '--parallel=true'], { cwd: BASE_PATH, env });
    file(`${BASE_PATH}/coverage/lcov-report/index.html`).assertIsNotEmpty();
    file(`${BASE_PATH}/coverage/index.html`).assertIsNotEmpty();

    let summary = fs.readJSONSync(`${BASE_PATH}/coverage/coverage-summary.json`);
    expect(summary).toMatchSnapshot();
  });

  it('uses parallel configuration and merges coverage when merge-coverage command is issued', async function () {
    dir(`${BASE_PATH}/coverage`).assertDoesNotExist();
    fs.copySync(`${BASE_PATH}/config/-coverage-parallel.js`, `${BASE_PATH}/config/coverage.js`);

    let env = { COVERAGE: 'true' };
    await execa('ember', ['exam', '--split=2', '--parallel=true'], { cwd: BASE_PATH, env });
    dir(`${BASE_PATH}/coverage`).assertDoesNotExist();

    await execa('ember', ['coverage-merge'], { cwd: BASE_PATH });
    file(`${BASE_PATH}/coverage/lcov-report/index.html`).assertIsNotEmpty();
    file(`${BASE_PATH}/coverage/index.html`).assertIsNotEmpty();

    let summary = fs.readJSONSync(`${BASE_PATH}/coverage/coverage-summary.json`);
    expect(summary).toMatchSnapshot();
  });

  it('uses nested coverageFolder and parallel configuration and run merge-coverage', async function () {
    let coverageFolder = `${BASE_PATH}/coverage/abc/easy-as/123`;

    dir(coverageFolder).assertDoesNotExist();
    fs.copySync(
      `${BASE_PATH}/config/-coverage-nested-folder.js`,
      `${BASE_PATH}/config/coverage.js`
    );

    let env = { COVERAGE: 'true' };
    await execa('ember', ['exam', '--split=2', '--parallel=true'], { cwd: BASE_PATH, env });
    dir(coverageFolder).assertDoesNotExist();

    await execa('ember', ['coverage-merge'], { cwd: BASE_PATH });
    file(`${coverageFolder}/lcov-report/index.html`).assertIsNotEmpty();
    file(`${coverageFolder}/index.html`).assertIsNotEmpty();

    let summary = fs.readJSONSync(`${coverageFolder}/coverage-summary.json`);
    expect(summary).toMatchSnapshot();
  });

  it('runs coverage when a module has an import error', async function () {
    dir(`${BASE_PATH}/coverage`).assertDoesNotExist();
    fs.copySync(`${BASE_PATH}/-error-module.js`, `${BASE_PATH}/app/error-module.js`);

    let env = { COVERAGE: 'true' };
    await execa('ember', ['test'], { cwd: BASE_PATH, env });
    dir(`${BASE_PATH}/coverage`).assertExists();

    let summary = fs.readJSONSync(`${BASE_PATH}/coverage/coverage-summary.json`);
    expect(summary).toMatchSnapshot();
  });
});
