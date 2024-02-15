/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import * as os from 'os';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { IConfig, ServerProvider, Events } from 'service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';

import * as Constants from './constants';
import ContextProvider from './contextProvider';
import { CredentialStore } from './credentialstore/credentialstore';
import { AzureResourceProvider } from './resourceProvider/resourceProvider';
import * as Utils from './utils';
import { Telemetry, LanguageClientErrorHandler } from './telemetry';
import { TelemetryFeature, AgentServicesFeature, DacFxServicesFeature, SchemaCompareServicesFeature } from './features';
import { AppContext } from './appContext';
import { ApiWrapper } from './apiWrapper';
import { UploadFilesCommand, MkDirCommand, SaveFileCommand, PreviewFileCommand, CopyPathCommand, DeleteFilesCommand } from './objectExplorerNodeProvider/hdfsCommands';
import { IPrompter } from './prompts/question';
import CodeAdapter from './prompts/adapter';
import { MssqlExtensionApi, MssqlObjectExplorerBrowser } from './api/mssqlapis';
import { OpenSparkJobSubmissionDialogCommand, OpenSparkJobSubmissionDialogFromFileCommand, OpenSparkJobSubmissionDialogTask } from './sparkFeature/dialog/dialogCommands';
import { OpenSparkYarnHistoryTask } from './sparkFeature/historyTask';
import { MssqlObjectExplorerNodeProvider, mssqlOutputChannel } from './objectExplorerNodeProvider/objectExplorerNodeProvider';
import { CmsService } from './cms/cmsService';
import { registerSearchServerCommand } from './objectExplorerNodeProvider/command';
import { MssqlIconProvider } from './iconProvider';

const baseConfig = require('./config.json');
const outputChannel = vscode.window.createOutputChannel(Constants.serviceName);
const statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', 'This sample code loads the file into a data frame and shows the first 10 results.');


export async function activate(context: vscode.ExtensionContext): Promise<MssqlExtensionApi> {
	// lets make sure we support this platform first
	let supported = await Utils.verifyPlatform();

	if (!supported) {
		vscode.window.showErrorMessage('Unsupported platform');
		return undefined;
	}

	let config: IConfig = JSON.parse(JSON.stringify(baseConfig));
	config.installDirectory = path.join(__dirname, config.installDirectory);
	config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
	config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL') || true;

	const credentialsStore = new CredentialStore(config);
	const resourceProvider = new AzureResourceProvider(config);
	let languageClient: SqlOpsDataClient;
	let cmsService: CmsService;

	const serverdownloader = new ServerProvider(config);

	serverdownloader.eventEmitter.onAny(generateHandleServerProviderEvent());

	let clientOptions: ClientOptions = {
		documentSelector: ['sql'],
		synchronize: {
			configurationSection: Constants.extensionConfigSectionName
		},
		providerId: Constants.providerId,
		errorHandler: new LanguageClientErrorHandler(),
		features: [
			// we only want to add new features
			...SqlOpsDataClient.defaultFeatures,
			TelemetryFeature,
			AgentServicesFeature,
			DacFxServicesFeature,
			SchemaCompareServicesFeature
		],
		outputChannel: new CustomOutputChannel()
	};

	let prompter: IPrompter = new CodeAdapter();
	let appContext = new AppContext(context, new ApiWrapper());

	const installationStart = Date.now();
	let serverPromise = serverdownloader.getOrDownloadServer().then(e => {
		const installationComplete = Date.now();
		let serverOptions = generateServerOptions(e);
		languageClient = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
		const processStart = Date.now();
		languageClient.onReady().then(() => {
			const processEnd = Date.now();
			statusView.text = 'Service Started';
			setTimeout(() => {
				statusView.hide();
			}, 1500);
			Telemetry.sendTelemetryEvent('startup/LanguageClientStarted', {
				installationTime: String(installationComplete - installationStart),
				processStartupTime: String(processEnd - processStart),
				totalTime: String(processEnd - installationStart),
				beginningTimestamp: String(installationStart)
			});
		});
		statusView.show();
		statusView.text = 'Starting service';
		languageClient.start();
		credentialsStore.start();
		resourceProvider.start();

		let nodeProvider = new MssqlObjectExplorerNodeProvider(prompter, appContext);
		azdata.dataprotocol.registerObjectExplorerNodeProvider(nodeProvider);
		let iconProvider = new MssqlIconProvider();
		azdata.dataprotocol.registerIconProvider(iconProvider);
		cmsService = new CmsService(appContext, languageClient);

		activateSparkFeatures(appContext);
		activateNotebookTask(appContext);
	}, e => {
		Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
		vscode.window.showErrorMessage('Failed to start Sql tools service');
	});
	registerSearchServerCommand(appContext);
	let contextProvider = new ContextProvider();
	context.subscriptions.push(contextProvider);
	context.subscriptions.push(credentialsStore);
	context.subscriptions.push(resourceProvider);
	context.subscriptions.push(new UploadFilesCommand(prompter, appContext));
	context.subscriptions.push(new MkDirCommand(prompter, appContext));
	context.subscriptions.push(new SaveFileCommand(prompter, appContext));
	context.subscriptions.push(new PreviewFileCommand(prompter, appContext));
	context.subscriptions.push(new CopyPathCommand(appContext));
	context.subscriptions.push(new DeleteFilesCommand(prompter, appContext));
	context.subscriptions.push({ dispose: () => languageClient.stop() });

	azdata.ui.registerModelViewProvider('bdc-endpoints', async (view) => {

		const endpointsArray: Array<Utils.IEndpoint> = Object.assign([], view.serverInfo.options['clusterEndpoints']);
		if (endpointsArray.length > 0) {
			const managementProxyEp = endpointsArray.find(e => e.serviceName === 'management-proxy');
			if (managementProxyEp) {
				endpointsArray.push(getCustomEndpoint(managementProxyEp, 'Grafana Dashboard', '/grafana'));
				endpointsArray.push(getCustomEndpoint(managementProxyEp, 'Kibana Dashboard', '/kibana'));
			}

			const gatewayEp = endpointsArray.find(e => e.serviceName === 'gateway');
			if (gatewayEp) {
				endpointsArray.push(getCustomEndpoint(gatewayEp, 'Spark History', '/gateway/default/sparkhistory'));
				endpointsArray.push(getCustomEndpoint(gatewayEp, 'Yarn History', '/gateway/default/yarn'));
			}

			const container = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%', alignItems: 'left' }).component();
			endpointsArray.forEach(endpointInfo => {
				const endPointRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
				const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: endpointInfo.serviceName }).component();
				endPointRow.addItem(nameCell, { CSSStyles: { 'width': '30%', 'font-weight': '600' } });
				if (endpointInfo.isHyperlink) {
					const linkCell = view.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({ label: endpointInfo.hyperlink, url: endpointInfo.hyperlink, position: '' }).component();
					endPointRow.addItem(linkCell, { CSSStyles: { 'width': '70%', 'color': 'blue', 'text-decoration': 'underline', 'padding-top': '10px' } });
				}
				else {
					const endpointCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: endpointInfo.ipAddress + ':' + endpointInfo.port }).component();
					endPointRow.addItem(endpointCell, { CSSStyles: { 'width': '70%' } });
				}
				container.addItem(endPointRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box' } });
			});
			const endpointsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%', alignItems: 'left' }).component();
			endpointsContainer.addItem(container, { CSSStyles: { 'padding-top': '25px' } });

			await view.initializeModel(endpointsContainer);
		}

	});

	function getCustomEndpoint(parentEndpoint: Utils.IEndpoint, serviceName: string, serviceUrl?: string): Utils.IEndpoint {
		if (parentEndpoint) {
			let endpoint: Utils.IEndpoint = {
				serviceName: serviceName,
				ipAddress: parentEndpoint.ipAddress,
				port: parentEndpoint.port,
				isHyperlink: serviceUrl ? true : false,
				hyperlink: 'https://' + parentEndpoint.ipAddress + ':' + parentEndpoint.port + serviceUrl
			};
			return endpoint;
		}
		return null;
	}

	let api: MssqlExtensionApi = {
		getMssqlObjectExplorerBrowser(): MssqlObjectExplorerBrowser {
			return {
				getNode: (context: azdata.ObjectExplorerContext) => {
					let oeProvider = appContext.getService<MssqlObjectExplorerNodeProvider>(Constants.ObjectExplorerService);
					return <any>oeProvider.findSqlClusterNodeByContext(context);
				}
			};
		},
		getCmsServiceProvider(): Promise<CmsService> {
			return serverPromise.then(() => cmsService);
		}
	};
	return api;
}

function activateSparkFeatures(appContext: AppContext): void {
	let extensionContext = appContext.extensionContext;
	let apiWrapper = appContext.apiWrapper;
	let outputChannel: vscode.OutputChannel = mssqlOutputChannel;
	extensionContext.subscriptions.push(new OpenSparkJobSubmissionDialogCommand(appContext, outputChannel));
	extensionContext.subscriptions.push(new OpenSparkJobSubmissionDialogFromFileCommand(appContext, outputChannel));
	apiWrapper.registerTaskHandler(Constants.mssqlClusterLivySubmitSparkJobTask, (profile: azdata.IConnectionProfile) => {
		new OpenSparkJobSubmissionDialogTask(appContext, outputChannel).execute(profile);
	});
	apiWrapper.registerTaskHandler(Constants.mssqlClusterLivyOpenSparkHistory, (profile: azdata.IConnectionProfile) => {
		new OpenSparkYarnHistoryTask(appContext).execute(profile, true);
	});
	apiWrapper.registerTaskHandler(Constants.mssqlClusterLivyOpenYarnHistory, (profile: azdata.IConnectionProfile) => {
		new OpenSparkYarnHistoryTask(appContext).execute(profile, false);
	});
}

function activateNotebookTask(appContext: AppContext): void {
	let apiWrapper = appContext.apiWrapper;
	apiWrapper.registerTaskHandler(Constants.mssqlClusterNewNotebookTask, (profile: azdata.IConnectionProfile) => {
		return saveProfileAndCreateNotebook(profile);
	});
	apiWrapper.registerTaskHandler(Constants.mssqlClusterOpenNotebookTask, (profile: azdata.IConnectionProfile) => {
		return handleOpenNotebookTask(profile);
	});
}

function saveProfileAndCreateNotebook(profile: azdata.IConnectionProfile): Promise<void> {
	return handleNewNotebookTask(undefined, profile);
}

function findNextUntitledEditorName(): string {
	let nextVal = 0;
	// Note: this will go forever if it's coded wrong, or you have inifinite Untitled notebooks!
	while (true) {
		let title = `Notebook-${nextVal}`;
		let hasNotebookDoc = azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1;
		if (!hasNotebookDoc) {
			return title;
		}
		nextVal++;
	}
}

async function handleNewNotebookTask(oeContext?: azdata.ObjectExplorerContext, profile?: azdata.IConnectionProfile): Promise<void> {
	// Ensure we get a unique ID for the notebook. For now we're using a different prefix to the built-in untitled files
	// to handle this. We should look into improving this in the future
	let title = findNextUntitledEditorName();
	let untitledUri = vscode.Uri.parse(`untitled:${title}`);
	let editor = await azdata.nb.showNotebookDocument(untitledUri, {
		connectionProfile: profile,
		preview: false
	});
	if (oeContext && oeContext.nodeInfo && oeContext.nodeInfo.nodePath) {
		// Get the file path after '/HDFS'
		let hdfsPath: string = oeContext.nodeInfo.nodePath.substring(oeContext.nodeInfo.nodePath.indexOf('/HDFS') + '/HDFS'.length);
		if (hdfsPath.length > 0) {
			let analyzeCommand = '#' + msgSampleCodeDataFrame + os.EOL + 'df = (spark.read.option("inferSchema", "true")'
				+ os.EOL + '.option("header", "true")' + os.EOL + '.csv("{0}"))' + os.EOL + 'df.show(10)';
			editor.edit(editBuilder => {
				editBuilder.replace(0, {
					cell_type: 'code',
					source: analyzeCommand.replace('{0}', hdfsPath)
				});
			});

		}
	}
}

async function handleOpenNotebookTask(profile: azdata.IConnectionProfile): Promise<void> {
	let notebookFileTypeName = localize('notebookFileType', 'Notebooks');
	let filter = {};
	filter[notebookFileTypeName] = 'ipynb';
	let uris = await vscode.window.showOpenDialog({
		filters: filter,
		canSelectFiles: true,
		canSelectMany: false
	});
	if (uris && uris.length > 0) {
		let fileUri = uris[0];
		// Verify this is a .ipynb file since this isn't actually filtered on Mac/Linux
		if (path.extname(fileUri.fsPath) !== '.ipynb') {
			// in the future might want additional supported types
			vscode.window.showErrorMessage(localize('unsupportedFileType', 'Only .ipynb Notebooks are supported'));
		} else {
			await azdata.nb.showNotebookDocument(fileUri, {
				connectionProfile: profile,
				preview: false
			});
		}
	}
}

function generateServerOptions(executablePath: string): ServerOptions {
	let launchArgs = Utils.getCommonLaunchArgsAndCleanupOldLogFiles('sqltools', executablePath);
	return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
}

function generateHandleServerProviderEvent() {
	let dots = 0;
	return (e: string, ...args: any[]) => {
		outputChannel.show();
		statusView.show();
		switch (e) {
			case Events.INSTALL_START:
				outputChannel.appendLine(`Installing ${Constants.serviceName} service to ${args[0]}`);
				statusView.text = 'Installing Service';
				break;
			case Events.INSTALL_END:
				outputChannel.appendLine('Installed');
				break;
			case Events.DOWNLOAD_START:
				outputChannel.appendLine(`Downloading ${args[0]}`);
				outputChannel.append(`(${Math.ceil(args[1] / 1024)} KB)`);
				statusView.text = 'Downloading Service';
				break;
			case Events.DOWNLOAD_PROGRESS:
				let newDots = Math.ceil(args[0] / 5);
				if (newDots > dots) {
					outputChannel.append('.'.repeat(newDots - dots));
					dots = newDots;
				}
				break;
			case Events.DOWNLOAD_END:
				outputChannel.appendLine('Done!');
				break;
		}
	};
}

// this method is called when your extension is deactivated
export function deactivate(): void {
}

class CustomOutputChannel implements vscode.OutputChannel {
	name: string;
	append(value: string): void {
		console.log(value);
	}
	appendLine(value: string): void {
		console.log(value);
	}
	clear(): void {
	}
	show(preserveFocus?: boolean): void;
	show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
	show(column?: any, preserveFocus?: any) {
	}
	hide(): void {
	}
	dispose(): void {
	}
}
