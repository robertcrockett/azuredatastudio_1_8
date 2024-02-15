/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { join } from 'vs/base/common/path';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IOutputChannelRegistry, Extensions as OutputExt, } from 'vs/workbench/contrib/output/common/output';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { Disposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import * as Constants from 'vs/workbench/contrib/logs/common/logConstants';
import { IWorkbenchActionRegistry, Extensions as WorkbenchActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { OpenLogsFolderAction, SetLogLevelAction } from 'vs/workbench/contrib/logs/common/logsActions';
import { ILogService, LogLevel } from 'vs/platform/log/common/log';

class LogOutputChannels extends Disposable implements IWorkbenchContribution {

	constructor(
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@ILogService logService: ILogService
	) {
		super();
		let outputChannelRegistry = Registry.as<IOutputChannelRegistry>(OutputExt.OutputChannels);
		outputChannelRegistry.registerChannel({ id: Constants.mainLogChannelId, label: nls.localize('mainLog', "Main"), file: URI.file(join(environmentService.logsPath, `main.log`)), log: true });
		outputChannelRegistry.registerChannel({ id: Constants.sharedLogChannelId, label: nls.localize('sharedLog', "Shared"), file: URI.file(join(environmentService.logsPath, `sharedprocess.log`)), log: true });
		outputChannelRegistry.registerChannel({ id: Constants.rendererLogChannelId, label: nls.localize('rendererLog', "Window"), file: URI.file(join(environmentService.logsPath, `renderer${environmentService.configuration.windowId}.log`)), log: true });

		// {{SQL CARBON EDIT}} @anthonydresser 05/19/19 investigate, this should be in the extension
		let toolsServiceLogFile: string = join(environmentService.logsPath, '..', '..', 'mssql', `sqltools_${Date.now()}.log`);
		console.log(`SqlTools Log file is: ${toolsServiceLogFile}`);
		outputChannelRegistry.registerChannel({ id: Constants.sqlToolsLogChannellId, label: nls.localize('sqlToolsLog', "Log (SqlTools)"), file: URI.file(toolsServiceLogFile), log: true });
		// {{SQL CARBON EDIT}} - End

		const registerTelemetryChannel = (level: LogLevel) => {
			if (level === LogLevel.Trace && !outputChannelRegistry.getChannel(Constants.telemetryLogChannelId)) {
				outputChannelRegistry.registerChannel({ id: Constants.telemetryLogChannelId, label: nls.localize('telemetryLog', "Telemetry"), file: URI.file(join(environmentService.logsPath, `telemetry.log`)), log: true });
			}
		};
		registerTelemetryChannel(logService.getLevel());
		logService.onDidChangeLogLevel(registerTelemetryChannel);

		const workbenchActionsRegistry = Registry.as<IWorkbenchActionRegistry>(WorkbenchActionExtensions.WorkbenchActions);
		const devCategory = nls.localize('developer', "Developer");
		workbenchActionsRegistry.registerWorkbenchAction(new SyncActionDescriptor(OpenLogsFolderAction, OpenLogsFolderAction.ID, OpenLogsFolderAction.LABEL), 'Developer: Open Log Folder', devCategory);
		workbenchActionsRegistry.registerWorkbenchAction(new SyncActionDescriptor(SetLogLevelAction, SetLogLevelAction.ID, SetLogLevelAction.LABEL), 'Developer: Set Log Level', devCategory);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(LogOutputChannels, LifecyclePhase.Eventually);
