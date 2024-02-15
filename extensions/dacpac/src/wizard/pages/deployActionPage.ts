/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as path from 'path';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard, Operation } from '../dataTierApplicationWizard';
import { DacFxConfigPage } from '../api/dacFxConfigPage';
import { sanitizeStringForFilename } from '../api/utils';

const localize = nls.loadMessageBundle();

export class DeployActionPage extends DacFxConfigPage {

	protected readonly wizardPage: azdata.window.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: azdata.ModelView;
	private deployRadioButton: azdata.RadioButtonComponent;
	private deployScriptRadioButton: azdata.RadioButtonComponent;
	private scriptRadioButton: azdata.RadioButtonComponent;
	private form: azdata.FormContainer;

	public constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
	}

	async start(): Promise<boolean> {
		let deployComponent = await this.createDeployRadioButton();
		let deployScriptComponent = await this.createDeployScriptRadioButton();
		let scriptComponent = await this.createScriptRadioButton();
		let fileBrowserComponent = await this.createFileBrowser();

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					deployComponent,
					scriptComponent,
					deployScriptComponent,
					fileBrowserComponent
				]).component();
		await this.view.initializeModel(this.form);

		//default have the first radio button checked
		this.deployRadioButton.checked = true;
		this.toggleFileBrowser(false);

		return true;
	}

	async onPageEnter(): Promise<boolean> {
		// generate script file path in case the database changed since last time the page was entered
		this.setDefaultScriptFilePath();
		return true;
	}

	private async createDeployRadioButton(): Promise<azdata.FormComponent> {
		this.deployRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedDeployAction',
				label: localize('dacFx.deployRadioButtonLabel', 'Deploy'),
			}).component();

		this.deployRadioButton.onDidClick(() => {
			this.model.generateScriptAndDeploy = false;
			this.instance.setDoneButton(Operation.deploy);
			this.toggleFileBrowser(false);
		});

		return {
			component: this.deployRadioButton,
			title: ''
		};
	}

	private async createDeployScriptRadioButton(): Promise<azdata.FormComponent> {
		this.deployScriptRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedDeployAction',
				label: localize('dacFx.deployScriptRadioButtonLabel', 'Generate Deployment Script and Deploy'),
			}).component();

		this.deployScriptRadioButton.onDidClick(() => {
			this.model.generateScriptAndDeploy = true;
			this.instance.setDoneButton(Operation.deploy);
			this.toggleFileBrowser(true);
		});

		return {
			component: this.deployScriptRadioButton,
			title: ''
		};
	}

	private async createScriptRadioButton(): Promise<azdata.FormComponent> {
		this.scriptRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedDeployAction',
				label: localize('dacFx.scriptRadioButtonLabel', 'Generate Deployment Script'),
			}).component();

		this.scriptRadioButton.onDidClick(() => {
			this.model.generateScriptAndDeploy = false;
			this.toggleFileBrowser(true);

			//change button text and operation
			this.instance.setDoneButton(Operation.generateDeployScript);
		});

		return {
			component: this.scriptRadioButton,
			title: ''
		};
	}

	private async createFileBrowser(): Promise<azdata.FormComponentGroup> {
		this.createFileBrowserParts();

		//default filepath
		this.setDefaultScriptFilePath();
		this.fileButton.onDidClick(async (click) => {
			let fileUri = await vscode.window.showSaveDialog(
				{
					defaultUri: vscode.Uri.file(this.fileTextBox.value),
					saveLabel: localize('dacfxDeployScript.saveFile', 'Save'),
					filters: {
						'SQL Files': ['sql'],
					}
				}
			);

			if (!fileUri) {
				return;
			}

			this.fileTextBox.value = fileUri.fsPath;
			this.model.scriptFilePath = fileUri.fsPath;
		});

		this.fileTextBox.onTextChanged(async () => {
			this.model.scriptFilePath = this.fileTextBox.value;
		});

		return {
			title: '',
			components: [
				{
					title: localize('dacfx.generatedScriptLocation', 'Deployment Script Location'),
					component: this.fileTextBox,
					layout: {
						horizontal: true,
						componentWidth: 400
					},
					actions: [this.fileButton]
				},],
		};
	}

	private toggleFileBrowser(enable: boolean): void {
		this.fileTextBox.enabled = enable;
		this.fileButton.enabled = enable;
	}

	private setDefaultScriptFilePath(): void {
		this.fileTextBox.value = path.join(this.getRootPath(), sanitizeStringForFilename(this.model.database) + '_UpgradeDACScript_' + this.getDateTime() + '.sql');
		this.model.scriptFilePath = this.fileTextBox.value;
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			return true;
		});
	}
}
