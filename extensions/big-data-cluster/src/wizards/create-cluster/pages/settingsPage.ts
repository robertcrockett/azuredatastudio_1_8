/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import * as nls from 'vscode-nls';
import { ClusterPorts, ContainerRegistryInfo } from '../../../interfaces';
import { CreateClusterWizard } from '../createClusterWizard';

const localize = nls.loadMessageBundle();
const UserNameInputWidth = '300px';
const PortInputWidth = '100px';
const RestoreDefaultValuesText = localize('bdc-create.RestoreDefaultValuesText', 'Restore Default Values');

export class SettingsPage extends WizardPageBase<CreateClusterWizard> {
	private acceptEulaCheckbox: azdata.CheckBoxComponent;

	constructor(wizard: CreateClusterWizard) {
		super(localize('bdc-create.settingsPageTitle', 'Settings'),
			localize('bdc-create.settingsPageDescription', 'Configure the settings required for deploying SQL Server big data cluster'),
			wizard);
	}

	public onEnter(): void {
		this.wizard.wizardObject.registerNavigationValidator((e) => {
			if (e.lastPage > e.newPage) {
				this.wizard.wizardObject.message = null;
				return true;
			}
			if (!this.acceptEulaCheckbox.checked) {
				this.wizard.wizardObject.message = {
					text: localize('bdc-create.EulaNotAccepted', 'You need to accept the terms of services and privacy policy in order to proceed'),
					level: azdata.window.MessageLevel.Error
				};
			} else {
				this.wizard.wizardObject.message = null;
			}
			return this.acceptEulaCheckbox.checked;
		});
	}

	protected initialize(view: azdata.ModelView): Thenable<void> {
		let clusterPorts: ClusterPorts;
		let containerRegistryInfo: ContainerRegistryInfo;

		let clusterPortsPromise = this.wizard.model.getDefaultPorts().then(ports => {
			clusterPorts = ports;
		});

		let containerRegistryPromise = this.wizard.model.getDefaultContainerRegistryInfo().then(containerRegistry => {
			containerRegistryInfo = containerRegistry;
		});
		return Promise.all([clusterPortsPromise, containerRegistryPromise]).then(() => {
			let formBuilder = view.modelBuilder.formContainer();

			// User settings
			let clusterNameInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.ClusterName', 'Cluster name'),
				inputWidth: UserNameInputWidth,
				isRequiredField: true
			}, (input) => {
				this.wizard.model.clusterName = input.value;
			});

			let adminUserNameInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.AdminUsernameText', 'Admin username'),
				isRequiredField: true,
				inputWidth: UserNameInputWidth
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.adminUserName = inputBox.value;
			});
			let adminPasswordInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.AdminUserPasswordText', 'Password'),
				isRequiredField: true,
				inputType: 'password',
				inputWidth: UserNameInputWidth
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.adminPassword = inputBox.value;
			});

			// Port settings
			let sqlPortInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.SQLPortText', 'SQL Server master'),
				isRequiredField: true,
				inputWidth: PortInputWidth,
				initialValue: clusterPorts.sql
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.sqlPort = inputBox.value;
			});
			let knoxPortInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.KnoxPortText', 'Knox'),
				isRequiredField: true,
				inputWidth: PortInputWidth,
				initialValue: clusterPorts.knox
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.knoxPort = inputBox.value;
			});
			let controllerPortInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.ControllerPortText', 'Controller'),
				isRequiredField: true,
				inputWidth: PortInputWidth,
				initialValue: clusterPorts.controller
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.controllerPort = inputBox.value;
			});
			let proxyPortInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.ProxyPortText', 'Proxy'),
				isRequiredField: true,
				inputWidth: PortInputWidth,
				initialValue: clusterPorts.proxy
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.proxyPort = inputBox.value;
			});
			let grafanaPortInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.GrafanaPortText', 'Grafana dashboard'),
				isRequiredField: true,
				inputWidth: PortInputWidth,
				initialValue: clusterPorts.grafana
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.grafanaPort = inputBox.value;
			});
			let kibanaPortInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.KibanaPortText', 'Kibana dashboard'),
				isRequiredField: true,
				inputWidth: PortInputWidth,
				initialValue: clusterPorts.kibana
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.kibanaPort = inputBox.value;
			});
			let restorePortSettingsButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				label: RestoreDefaultValuesText,
				width: 200
			}).component();
			this.wizard.registerDisposable(restorePortSettingsButton.onDidClick(() => {
				sqlPortInput.input.value = clusterPorts.sql;
				knoxPortInput.input.value = clusterPorts.knox;
				controllerPortInput.input.value = clusterPorts.controller;
				proxyPortInput.input.value = clusterPorts.proxy;
				grafanaPortInput.input.value = clusterPorts.grafana;
				kibanaPortInput.input.value = clusterPorts.kibana;
			}));

			// Container Registry Settings
			const registryUserNamePasswordHintText = localize('bdc-create.RegistryUserNamePasswordHintText', 'only required for private registries');
			let registryInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.RegistryText', 'Registry'),
				isRequiredField: true,
				inputWidth: UserNameInputWidth,
				initialValue: containerRegistryInfo.registry
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.containerRegistry = inputBox.value;
			});

			let repositoryInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.RepositoryText', 'Repository'),
				isRequiredField: true,
				inputWidth: UserNameInputWidth,
				initialValue: containerRegistryInfo.repository
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.containerRepository = inputBox.value;
			});

			let imageTagInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.ImageTagText', 'Image tag'),
				isRequiredField: true,
				inputWidth: UserNameInputWidth,
				initialValue: containerRegistryInfo.imageTag
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.containerRegistry = inputBox.value;
			});

			let registryUserNameInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.RegistryUserNameText', 'Username'),
				isRequiredField: false,
				inputWidth: UserNameInputWidth,
				placeHolder: registryUserNamePasswordHintText
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.containerRegistryUserName = inputBox.value;
			});

			let registryPasswordInput = this.createInputWithLabel(view, {
				label: localize('bdc-create.RegistryPasswordText', 'Password'),
				isRequiredField: false,
				inputWidth: UserNameInputWidth,
				placeHolder: registryUserNamePasswordHintText,
				inputType: 'password'
			}, (inputBox: azdata.InputBoxComponent) => {
				this.wizard.model.containerRegistryPassword = inputBox.value;
			});
			let restoreContainerSettingsButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				label: RestoreDefaultValuesText,
				width: 200
			}).component();
			this.wizard.registerDisposable(restoreContainerSettingsButton.onDidClick(() => {
				registryInput.input.value = containerRegistryInfo.registry;
				repositoryInput.input.value = containerRegistryInfo.repository;
				imageTagInput.input.value = containerRegistryInfo.imageTag;
			}));

			let basicSettingsGroup = view.modelBuilder.groupContainer().withItems([clusterNameInput.row, adminUserNameInput.row, adminPasswordInput.row]).withLayout({ header: localize('bdc-create.BasicSettingsText', 'Basic Settings'), collapsible: true }).component();
			let containerSettingsGroup = view.modelBuilder.groupContainer().withItems([registryInput.row, repositoryInput.row, imageTagInput.row, registryUserNameInput.row, registryPasswordInput.row, restoreContainerSettingsButton]).withLayout({ header: localize('bdc-create.ContainerRegistrySettings', 'Container Registry Settings'), collapsible: true }).component();
			let portSettingsGroup = view.modelBuilder.groupContainer().withItems([sqlPortInput.row, knoxPortInput.row, controllerPortInput.row, proxyPortInput.row, grafanaPortInput.row, kibanaPortInput.row, restorePortSettingsButton]).withLayout({ header: localize('bdc-create.PortSettings', 'Port Settings (Optional)'), collapsible: true, collapsed: true }).component();

			this.acceptEulaCheckbox = view.modelBuilder.checkBox().component();
			this.acceptEulaCheckbox.checked = false;

			let eulaLink: azdata.LinkArea = {
				text: localize('bdc-create.LicenseTerms', 'license terms'),
				url: 'https://go.microsoft.com/fwlink/?LinkId=2002534'
			};
			let privacyPolicyLink: azdata.LinkArea = {
				text: localize('bdc-create.PrivacyPolicyText', 'privacy policy'),
				url: 'https://go.microsoft.com/fwlink/?LinkId=853010'
			};

			let checkboxText = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: localize({
					key: 'bdc-create.AcceptTermsText',
					comment: ['{0} is the place holder for license terms, {1} is the place holder for privacy policy']
				}, 'I accept the {0} and {1}.'),
				links: [eulaLink, privacyPolicyLink]
			}).component();

			let eulaContainer = this.createRow(view, [this.acceptEulaCheckbox, checkboxText]);

			let form = formBuilder.withFormItems([
				{
					title: '',
					component: eulaContainer
				}, {
					title: '',
					component: basicSettingsGroup
				}, {
					title: '',
					component: containerSettingsGroup
				}, {
					title: '',
					component: portSettingsGroup
				}]).component();
			return view.initializeModel(form);
		});
	}

	private createInputWithLabel(view: azdata.ModelView, options: {
		label: string,
		isRequiredField: boolean,
		inputWidth: string,
		inputType?: string,
		initialValue?: string,
		placeHolder?: string
	}, textChangedHandler: (inputBox: azdata.InputBoxComponent) => void): { row: azdata.FlexContainer, input: azdata.InputBoxComponent } {
		let inputType = !!options.inputType ? options.inputType : 'text';
		let input = view.modelBuilder.inputBox().withProperties({
			required: options.isRequiredField,
			inputType: inputType
		}).component();
		let text = view.modelBuilder.text().withProperties({ value: options.label }).component();
		input.width = options.inputWidth;
		text.width = '150px';
		input.placeHolder = options.placeHolder;
		this.wizard.registerDisposable(input.onTextChanged(() => {
			textChangedHandler(input);
		}));
		input.value = options.initialValue;
		let row = this.createRow(view, [text, input]);
		return {
			input: input,
			row: row
		};
	}

	private createRow(view: azdata.ModelView, items: azdata.Component[]): azdata.FlexContainer {
		return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '5px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
	}
}
