/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from 'path';

import { registerDashboardWidget, registerNonCustomDashboardWidget } from 'sql/platform/dashboard/common/widgetRegistry';
import { Extensions as InsightExtensions, IInsightRegistry } from 'sql/platform/dashboard/common/insightRegistry';
import { IInsightTypeContrib } from './interfaces';
import { insightsContribution, insightsSchema } from 'sql/workbench/parts/dashboard/widgets/insights/insightsWidgetSchemas';

import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { Registry } from 'vs/platform/registry/common/platform';

const insightRegistry = Registry.as<IInsightRegistry>(InsightExtensions.InsightContribution);

registerDashboardWidget('insights-widget', '', insightsSchema);

ExtensionsRegistry.registerExtensionPoint<IInsightTypeContrib | IInsightTypeContrib[]>({ extensionPoint: 'dashboard.insights', jsonSchema: insightsContribution }).setHandler(extensions => {

	function handleCommand(insight: IInsightTypeContrib, extension: IExtensionPointUser<any>) {

		if (insight.contrib.queryFile) {
			insight.contrib.queryFile = join(extension.description.extensionLocation.fsPath, insight.contrib.queryFile);
		}

		if (insight.contrib.details && insight.contrib.details.queryFile) {
			insight.contrib.details.queryFile = join(extension.description.extensionLocation.fsPath, insight.contrib.details.queryFile);
		}

		registerNonCustomDashboardWidget(insight.id, '', insight.contrib);
		insightRegistry.registerExtensionInsight(insight.id, insight.contrib);
	}

	for (const extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IInsightTypeContrib>(value)) {
			for (const command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
