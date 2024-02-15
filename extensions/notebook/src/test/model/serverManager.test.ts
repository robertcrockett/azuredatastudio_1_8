/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import 'mocha';

import { JupyterServerInstanceStub } from '../common';
import { LocalJupyterServerManager, ServerInstanceFactory } from '../../jupyter/jupyterServerManager';
import JupyterServerInstallation from '../../jupyter/jupyterServerInstallation';
import { Deferred } from '../../common/promise';
import { ApiWrapper } from '../../common/apiWrapper';
import * as testUtils from '../common/testUtils';
import { IServerInstance } from '../../jupyter/common';
import { MockExtensionContext } from '../common/stubs';

describe('Local Jupyter Server Manager', function (): void {
	let expectedPath = 'my/notebook.ipynb';
	let serverManager: LocalJupyterServerManager;
	let deferredInstall: Deferred<void>;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	let mockExtensionContext: MockExtensionContext;
	let mockFactory: TypeMoq.IMock<ServerInstanceFactory>;
	beforeEach(() => {
		mockExtensionContext = new MockExtensionContext();
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
		mockApiWrapper.setup(a => a.showErrorMessage(TypeMoq.It.isAny()));
		mockApiWrapper.setup(a => a.getWorkspacePathFromUri(TypeMoq.It.isAny())).returns(() => undefined);
		mockFactory = TypeMoq.Mock.ofType(ServerInstanceFactory);

		deferredInstall = new Deferred<void>();
		let mockInstall = TypeMoq.Mock.ofType(JupyterServerInstallation, undefined, undefined, '/root');
		mockInstall.setup(j => j.promptForPythonInstall()).returns(() => deferredInstall.promise);

		serverManager = new LocalJupyterServerManager({
			documentPath: expectedPath,
			jupyterInstallation: mockInstall.object,
			extensionContext: mockExtensionContext,
			apiWrapper: mockApiWrapper.object,
			factory: mockFactory.object
		});
	});

	it('Should not be started initially', function (): void {
		should(serverManager.isStarted).be.false();
		should(serverManager.serverSettings).be.undefined();
	});

	it('Should show error message on install failure', async function (): Promise<void> {
		let error = 'Error!!';
		deferredInstall.reject(error);
		await testUtils.assertThrowsAsync(() => serverManager.startServer(), undefined);
	});

	it('Should configure and start install', async function (): Promise<void> {
		// Given an install and instance that start with no issues
		let expectedUri = vscode.Uri.parse('http://localhost:1234?token=abcdefghijk');
		let mockServerInstance = initInstallAndInstance(expectedUri);
		deferredInstall.resolve();

		// When I start the server
		let notified = false;
		serverManager.onServerStarted(() => notified = true);
		await serverManager.startServer();

		// Then I expect the port to be included in settings
		should(serverManager.serverSettings.baseUrl.indexOf('1234') > -1).be.true();
		should(serverManager.serverSettings.token).equal('abcdefghijk');
		// And a notification to be sent
		should(notified).be.true();
		// And the key methods to have been called
		mockServerInstance.verify(s => s.configure(), TypeMoq.Times.once());
		mockServerInstance.verify(s => s.start(), TypeMoq.Times.once());
	});

	it('Should not fail on stop if never started', async function (): Promise<void> {
		await serverManager.stopServer();
	});

	it('Should call stop on server instance', async function (): Promise<void> {
		// Given an install and instance that start with no issues
		let expectedUri = vscode.Uri.parse('http://localhost:1234?token=abcdefghijk');
		let mockServerInstance = initInstallAndInstance(expectedUri);
		mockServerInstance.setup(s => s.stop()).returns(() => Promise.resolve());
		deferredInstall.resolve();

		// When I start and then the server
		await serverManager.startServer();
		await serverManager.stopServer();

		// Then I expect stop to have been called on the server instance
		mockServerInstance.verify(s => s.stop(), TypeMoq.Times.once());
	});

	it('Should call stop when extension is disposed', async function (): Promise<void> {
		// Given an install and instance that start with no issues
		let expectedUri = vscode.Uri.parse('http://localhost:1234?token=abcdefghijk');
		let mockServerInstance = initInstallAndInstance(expectedUri);
		mockServerInstance.setup(s => s.stop()).returns(() => Promise.resolve());
		deferredInstall.resolve();

		// When I start and then dispose the extension
		await serverManager.startServer();
		should(mockExtensionContext.subscriptions).have.length(1);
		mockExtensionContext.subscriptions[0].dispose();

		// Then I expect stop to have been called on the server instance
		mockServerInstance.verify(s => s.stop(), TypeMoq.Times.once());
	});

	function initInstallAndInstance(uri: vscode.Uri): TypeMoq.IMock<IServerInstance> {
		let mockServerInstance = TypeMoq.Mock.ofType(JupyterServerInstanceStub);
		mockFactory.setup(f => f.createInstance(TypeMoq.It.isAny())).returns(() => mockServerInstance.object);
		mockServerInstance.setup(s => s.configure()).returns(() => Promise.resolve());
		mockServerInstance.setup(s => s.start()).returns(() => Promise.resolve());
		mockServerInstance.setup(s => s.uri).returns(() => uri);
		return mockServerInstance;
	}
});
