/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { IBootstrapParams } from 'sql/platform/bootstrap/node/bootstrapService';
import { RenderMimeRegistry } from 'sql/workbench/parts/notebook/outputs/registry';
import { ModelFactory } from 'sql/workbench/parts/notebook/models/modelFactory';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { NotebookInput } from 'sql/workbench/parts/notebook/notebookInput';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ICellModel, INotebookModel, ILanguageMagic } from 'sql/workbench/parts/notebook/models/modelInterfaces';

export const SERVICE_ID = 'notebookService';
export const INotebookService = createDecorator<INotebookService>(SERVICE_ID);

export const DEFAULT_NOTEBOOK_PROVIDER = 'builtin';
export const DEFAULT_NOTEBOOK_FILETYPE = 'IPYNB';
export const SQL_NOTEBOOK_PROVIDER = 'sql';
export const OVERRIDE_EDITOR_THEMING_SETTING = 'notebook.overrideEditorTheming';

export interface INotebookService {
	_serviceBrand: any;

	readonly onNotebookEditorAdd: Event<INotebookEditor>;
	readonly onNotebookEditorRemove: Event<INotebookEditor>;
	onNotebookEditorRename: Event<INotebookEditor>;

	readonly isRegistrationComplete: boolean;
	readonly registrationComplete: Promise<void>;
	readonly languageMagics: ILanguageMagic[];
	/**
	 * Register a metadata provider
	 */
	registerProvider(providerId: string, provider: INotebookProvider): void;

	/**
	 * Register a metadata provider
	 */
	unregisterProvider(providerId: string): void;

	getSupportedFileExtensions(): string[];

	getProvidersForFileType(fileType: string): string[];

	getStandardKernelsForProvider(provider: string): azdata.nb.IStandardKernel[];

	/**
	 * Initializes and returns a Notebook manager that can handle all important calls to open, display, and
	 * run cells in a notebook.
	 * @param providerId ID for the provider to be used to instantiate a backend notebook service
	 * @param uri URI for a notebook that is to be opened. Based on this an existing manager may be used, or
	 * a new one may need to be created
	 */
	getOrCreateNotebookManager(providerId: string, uri: URI): Thenable<INotebookManager>;

	addNotebookEditor(editor: INotebookEditor): void;

	removeNotebookEditor(editor: INotebookEditor): void;

	listNotebookEditors(): INotebookEditor[];

	getMimeRegistry(): RenderMimeRegistry;

	renameNotebookEditor(oldUri: URI, newUri: URI, currentEditor: INotebookEditor): void;

	/**
	 * Checks if a notebook has previously been marked as trusted, and that
	 * the notebook has not changed on disk since that time. If the notebook
	 * is currently dirty in the app, the previous trusted state will be used even
	 * if it's altered on disk since the version in our UI is based on previously trusted
	 * content.
	 * @param notebookUri the URI identifying a notebook
	 * @param isDirty is the notebook marked as dirty in by the text model trackers?
	 */
	isNotebookTrustCached(notebookUri: URI, isDirty: boolean): Promise<boolean>;
	/**
	 * Serializes an impactful Notebook state change. This will result
	 * in trusted state being serialized if needed, and notifications being
	 * sent to listeners that can act on the point-in-time notebook state
	 * @param notebookUri the URI identifying a notebook
	 */
	serializeNotebookStateChange(notebookUri: URI, changeType: SerializationStateChangeType): void;

}

export interface INotebookProvider {
	readonly providerId: string;
	getNotebookManager(notebookUri: URI): Thenable<INotebookManager>;
	handleNotebookClosed(notebookUri: URI): void;
}

export interface INotebookManager {
	providerId: string;
	readonly contentManager: azdata.nb.ContentManager;
	readonly sessionManager: azdata.nb.SessionManager;
	readonly serverManager: azdata.nb.ServerManager;
}

export interface IProviderInfo {
	providerId: string;
	providers: string[];
}
export interface INotebookParams extends IBootstrapParams {
	notebookUri: URI;
	input: NotebookInput;
	providerInfo: Promise<IProviderInfo>;
	profile?: IConnectionProfile;
	modelFactory?: ModelFactory;
}

export interface INotebookEditor {
	readonly notebookParams: INotebookParams;
	readonly id: string;
	readonly cells?: ICellModel[];
	readonly modelReady: Promise<INotebookModel>;
	readonly model: INotebookModel | null;
	isDirty(): boolean;
	isActive(): boolean;
	isVisible(): boolean;
	executeEdits(edits: ISingleNotebookEditOperation[]): boolean;
	runCell(cell: ICellModel): Promise<boolean>;
	runAllCells(): Promise<boolean>;
	clearAllOutputs(): Promise<boolean>;
}

export enum SerializationStateChangeType {
	Saved,
	Executed
}