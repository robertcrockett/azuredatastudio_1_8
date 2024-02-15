## Integration tests
The integration-tests suite is based on the extension testing feature provided by VS Code, We can use this for:
* Commands for setting up the environment for feature testing.
* Adding test cases that do not need UI interaction or the test scenarios not supported by the UI automation framework (e.g. object explorer context menu – not html based)

##### Folders
* extensionInstallers folder: Copy the VISX installers for the extensions we would like to run the tests with.
* src folder: This is where the test file for features should be added, name the file like this: feature.test.ts. e.g. objectExplorer.test.ts

## UI automation testing
The UI automation test cases should be added under $root/test/smoke/src/sql folder. Each feature should create its own folder and add 2 files, one for accessing the feature and the other for the test cases. For example: objectExplorer.ts and objectExplorer.test.ts. only tested on Windows for now.

For both Smoke test and Integration test, ADS will be launched using new temp folders: extension folder and data folder so that your local dev environment won't be changed.

## How to run the test
1. In the build pipeline:
The integration test suite has been added to ADS windows pipeline to run the test and report the results, you can find the test results under the test tab.

2. Local environment:
	1. open a terminal window/command line window. (When testing on Mac we found some issue with VSCode scenario, you might have to close VSCode before running the command)
	2. navigate to this folder and then run 'node setEnvironmentVariables.js', there are different options, by default VSCode will be opened.
		1. Terminal(Mac)/CMD(Windows): node setEnvironmentVariables.js Terminal
		2. Git-Bash on Windows: node setEnvironmentVariables.js BashWin
	3. Follow the instructions in the window: you will be prompted to login to azure portal.
	4. A new window will be opened based on your selection and the new window will have the required environment variables set.
	5. Run the Test:
		1. For Integration Test: in the new window navigate to the scripts folder and run sql-test-integration.bat or sql-test-integration.sh based on your environment.
		2. Smoke Test can be launched in 2 ways:
			1. In the new window navigate to the test/smoke folder and run: node smoke/index.js
			2. Or, In a VSCode window opened by step above, open AzureDataStudio folder and then select the 'Launch Smoke Test' option.
