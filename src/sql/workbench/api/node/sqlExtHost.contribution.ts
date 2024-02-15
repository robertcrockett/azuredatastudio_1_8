/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

// --- SQL contributions
import 'sql/workbench/api/node/mainThreadConnectionManagement';
import 'sql/workbench/api/node/mainThreadCredentialManagement';
import 'sql/workbench/api/node/mainThreadDataProtocol';
import 'sql/workbench/api/node/mainThreadObjectExplorer';
import 'sql/workbench/api/node/mainThreadBackgroundTaskManagement';
import 'sql/workbench/api/node/mainThreadSerializationProvider';
import 'sql/workbench/api/node/mainThreadResourceProvider';
import 'sql/workbench/api/electron-browser/mainThreadTasks';
import 'sql/workbench/api/electron-browser/mainThreadDashboard';
import 'sql/workbench/api/node/mainThreadDashboardWebview';
import 'sql/workbench/api/node/mainThreadQueryEditor';
import 'sql/workbench/api/node/mainThreadModelView';
import 'sql/workbench/api/node/mainThreadModelViewDialog';
import 'sql/workbench/api/node/mainThreadNotebook';
import 'sql/workbench/api/node/mainThreadNotebookDocumentsAndEditors';
import 'sql/workbench/api/node/mainThreadAccountManagement';
import 'sql/workbench/api/node/mainThreadExtensionManagement';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';

export class SqlExtHostContribution implements IWorkbenchContribution {

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) {
	}

	public getId(): string {
		return 'sql.api.sqlExtHost';
	}
}

// Register File Tracker
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	SqlExtHostContribution,
	LifecyclePhase.Restored
);
