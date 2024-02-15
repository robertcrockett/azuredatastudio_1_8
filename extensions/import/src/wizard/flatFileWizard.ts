/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { FlatFileProvider } from '../services/contracts';
import { ImportDataModel } from './api/models';
import { ImportPage } from './api/importPage';
// pages
import { FileConfigPage } from './pages/fileConfigPage';
import { ProsePreviewPage } from './pages/prosePreviewPage';
import { ModifyColumnsPage } from './pages/modifyColumnsPage';
import { SummaryPage } from './pages/summaryPage';

const localize = nls.loadMessageBundle();

export class FlatFileWizard {
	private readonly provider: FlatFileProvider;
	private wizard: azdata.window.Wizard;

	private importAnotherFileButton: azdata.window.Button;

	constructor(provider: FlatFileProvider) {
		this.provider = provider;
	}

	public async start(p: any, ...args: any[]) {
		let model = <ImportDataModel>{};

		let profile = p ? <azdata.IConnectionProfile>p.connectionProfile : null;
		if (profile) {
			model.serverId = profile.id;
			model.database = profile.databaseName;
		}

		let pages: Map<number, ImportPage> = new Map<number, ImportPage>();


		let connections = await azdata.connection.getActiveConnections();
		if (!connections || connections.length === 0) {
			vscode.window.showErrorMessage(localize('import.needConnection', 'Please connect to a server before using this wizard.'));
			return;
		}

		let currentConnection = await azdata.connection.getCurrentConnection();
		model.serverId = currentConnection.connectionId;

		this.wizard = azdata.window.createWizard(localize('flatFileImport.wizardName', 'Import flat file wizard'));
		let page1 = azdata.window.createWizardPage(localize('flatFileImport.page1Name', 'Specify Input File'));
		let page2 = azdata.window.createWizardPage(localize('flatFileImport.page2Name', 'Preview Data'));
		let page3 = azdata.window.createWizardPage(localize('flatFileImport.page3Name', 'Modify Columns'));
		let page4 = azdata.window.createWizardPage(localize('flatFileImport.page4Name', 'Summary'));

		let fileConfigPage: FileConfigPage;

		page1.registerContent(async (view) => {
			fileConfigPage = new FileConfigPage(this, page1, model, view, this.provider);
			pages.set(0, fileConfigPage);
			await fileConfigPage.start().then(() => {
				fileConfigPage.setupNavigationValidator();
				fileConfigPage.onPageEnter();
			});
		});

		let prosePreviewPage: ProsePreviewPage;
		page2.registerContent(async (view) => {
			prosePreviewPage = new ProsePreviewPage(this, page2, model, view, this.provider);
			pages.set(1, prosePreviewPage);
			await prosePreviewPage.start();
		});

		let modifyColumnsPage: ModifyColumnsPage;
		page3.registerContent(async (view) => {
			modifyColumnsPage = new ModifyColumnsPage(this, page3, model, view, this.provider);
			pages.set(2, modifyColumnsPage);
			await modifyColumnsPage.start();
		});

		let summaryPage: SummaryPage;

		page4.registerContent(async (view) => {
			summaryPage = new SummaryPage(this, page4, model, view, this.provider);
			pages.set(3, summaryPage);
			await summaryPage.start();
		});


		this.importAnotherFileButton = azdata.window.createButton(localize('flatFileImport.importNewFile', 'Import new file'));
		this.importAnotherFileButton.onClick(() => {
			//TODO replace this with proper cleanup for all the pages
			this.wizard.close();
			pages.forEach((page) => page.cleanup());
			this.wizard.open();
		});

		this.importAnotherFileButton.hidden = true;
		this.wizard.customButtons = [this.importAnotherFileButton];
		this.wizard.onPageChanged(async (event) => {
			let newPageIdx = event.newPage;
			let lastPageIdx = event.lastPage;
			let newPage = pages.get(newPageIdx);
			let lastPage = pages.get(lastPageIdx);
			if (lastPage) {
				await lastPage.onPageLeave();
			}
			if (newPage) {
				newPage.setupNavigationValidator();
				await newPage.onPageEnter();
			}
		});

		//not needed for this wizard
		this.wizard.generateScriptButton.hidden = true;

		this.wizard.pages = [page1, page2, page3, page4];

		this.wizard.open();
	}

	public setImportAnotherFileVisibility(visibility: boolean) {
		this.importAnotherFileButton.hidden = !visibility;
	}

	public registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean) {
		this.wizard.registerNavigationValidator(validator);
	}

	public changeNextButtonLabel(label: string) {
		this.wizard.nextButton.label = label;
	}


}



