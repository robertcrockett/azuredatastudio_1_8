/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as constants from '../constants';
import * as azdata from 'azdata';
import ControllerBase from './controllerBase';
import * as vscode from 'vscode';
import { FlatFileWizard } from '../wizard/flatFileWizard';
import { ServiceClient } from '../services/serviceClient';
import { ApiType, managerInstance } from '../services/serviceApiManager';
import { FlatFileProvider } from '../services/contracts';

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {

	public constructor(context: vscode.ExtensionContext) {
		super(context);
	}
	/**
	 */
	public deactivate(): void {
	}

	public activate(): Promise<boolean> {
		const outputChannel = vscode.window.createOutputChannel(constants.serviceName);
		new ServiceClient(outputChannel).startService(this._context);

		managerInstance.onRegisteredApi<FlatFileProvider>(ApiType.FlatFileProvider)(provider => {
			this.initializeFlatFileProvider(provider);
		});

		return Promise.resolve(true);
	}

	private initializeFlatFileProvider(provider: FlatFileProvider) {
		azdata.tasks.registerTask('flatFileImport.start', (profile: azdata.IConnectionProfile, ...args: any[]) => new FlatFileWizard(provider).start(profile, args));
	}
}
