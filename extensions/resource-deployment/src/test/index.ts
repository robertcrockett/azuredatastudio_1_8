/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('path');
const testRunner = require('vscode/lib/testrunner');

const suite = 'Resource Deployment Unit Tests';

const testOptions: any = {
	ui: 'tdd',
	useColors: true,
	timeout: 60000
};

if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
	testOptions.reporter = 'mocha-multi-reporters';
	testOptions.reporterOptions = {
		reporterEnabled: 'spec, mocha-junit-reporter',
		mochaJunitReporterReporterOptions: {
			testsuitesTitle: `${suite} ${process.platform}`,
			mochaFile: path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
		}
	};
}

testRunner.configure(testOptions);

export = testRunner;
