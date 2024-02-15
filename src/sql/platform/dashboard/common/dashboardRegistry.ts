/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions as ConfigurationExtension } from 'vs/platform/configuration/common/configurationRegistry';
import { IJSONSchema, IJSONSchemaMap } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';

import { ProviderProperties } from 'sql/workbench/parts/dashboard/widgets/properties/propertiesWidget.component';
import { DATABASE_DASHBOARD_TABS } from 'sql/workbench/parts/dashboard/pages/databaseDashboardPage.contribution';
import { SERVER_DASHBOARD_TABS, SERVER_DASHBOARD_PROPERTIES } from 'sql/workbench/parts/dashboard/pages/serverDashboardPage.contribution';
import { DASHBOARD_CONFIG_ID, DASHBOARD_TABS_KEY_PROPERTY } from 'sql/workbench/parts/dashboard/pages/dashboardPageContribution';

export const Extensions = {
	DashboardContributions: 'dashboard.contributions'
};

export interface IDashboardTab {
	id: string;
	title: string;
	provider: string | string[];
	publisher: string;
	description?: string;
	container?: object;
	when?: string;
	alwaysShow?: boolean;
	isHomeTab?: boolean;
}

export interface IDashboardRegistry {
	registerDashboardProvider(id: string, properties: ProviderProperties): void;
	getProperties(id: string): ProviderProperties;
	registerTab(tab: IDashboardTab): void;
	tabs: Array<IDashboardTab>;
}

class DashboardRegistry implements IDashboardRegistry {
	private _properties = new Map<string, ProviderProperties>();
	private _tabs = new Array<IDashboardTab>();
	private _configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtension.Configuration);
	private _dashboardTabContentSchemaProperties: IJSONSchemaMap = {};

	/**
	 * Register a dashboard widget
	 * @param id id of the widget
	*/
	public registerDashboardProvider(id: string, properties: ProviderProperties): void {
		this._properties.set(id, properties);
	}

	public getProperties(id: string): ProviderProperties {
		return this._properties.get(id);
	}

	public registerTab(tab: IDashboardTab): void {
		this._tabs.push(tab);
		let dashboardConfig = this._configurationRegistry.getConfigurations().find(c => c.id === DASHBOARD_CONFIG_ID);

		if (dashboardConfig) {
			let dashboardDatabaseTabProperty = (<IJSONSchema>dashboardConfig.properties[DATABASE_DASHBOARD_TABS].items).properties[DASHBOARD_TABS_KEY_PROPERTY];
			dashboardDatabaseTabProperty.enum.push(tab.id);
			dashboardDatabaseTabProperty.enumDescriptions.push(tab.description || '');

			let dashboardServerTabProperty = (<IJSONSchema>dashboardConfig.properties[SERVER_DASHBOARD_TABS].items).properties[DASHBOARD_TABS_KEY_PROPERTY];
			dashboardServerTabProperty.enum.push(tab.id);
			dashboardServerTabProperty.enumDescriptions.push(tab.description || '');

			this._configurationRegistry.notifyConfigurationSchemaUpdated(dashboardConfig);
		}
	}

	public get tabs(): Array<IDashboardTab> {
		return this._tabs;
	}
}

const dashboardRegistry = new DashboardRegistry();
Registry.add(Extensions.DashboardContributions, dashboardRegistry);

export function registerTab(tab: IDashboardTab): void {
	dashboardRegistry.registerTab(tab);
}

const dashboardPropertiesPropertyContrib: IJSONSchema = {
	description: nls.localize('dashboard.properties.property', "Defines a property to show on the dashboard"),
	type: 'object',
	properties: {
		displayName: {
			description: nls.localize('dashboard.properties.property.displayName', "What value to use as a label for the property"),
			type: 'string'
		},
		value: {
			description: nls.localize('dashboard.properties.property.value', "What value in the object to access for the value"),
			type: 'string'
		},
		ignore: {
			description: nls.localize('dashboard.properties.property.ignore', "Specify values to be ignored"),
			type: 'array',
			items: { type: 'string' }
		},
		default: {
			description: nls.localize('dashboard.properties.property.default', "Default value to show if ignored or no value"),
			type: 'string'
		}
	}
};

const dashboardPropertyFlavorContrib: IJSONSchema = {
	description: nls.localize('dashboard.properties.flavor', "A flavor for defining dashboard properties"),
	type: 'object',
	properties: {
		id: {
			description: nls.localize('dashboard.properties.flavor.id', 'Id of the flavor'),
			type: 'string'
		},
		condition: {
			description: nls.localize('dashboard.properties.flavor.condition', "Condition to use this flavor"),
			type: 'object',
			properties: {
				field: {
					description: nls.localize('dashboard.properties.flavor.condition.field', "Field to compare to"),
					type: 'string'
				},
				operator: {
					description: nls.localize('dashboard.properties.flavor.condition.operator', "Which operator to use for comparison"),
					type: 'string',
					enum: ['==', '<=', '>=', '!=']
				},
				value: {
					description: nls.localize('dashboard.properties.flavor.condition.value', "Value to compare the field to"),
					type: ['string', 'boolean']
				}
			}
		},
		databaseProperties: {
			description: nls.localize('dashboard.properties.databaseProperties', "Properties to show for database page"),
			type: 'array',
			items: dashboardPropertiesPropertyContrib
		},
		serverProperties: {
			description: nls.localize('dashboard.properties.serverProperties', "Properties to show for server page"),
			type: 'array',
			items: dashboardPropertiesPropertyContrib
		}
	}
};

const dashboardContrib: IJSONSchema = {
	description: nls.localize('carbon.extension.dashboard', "Defines that this provider supports the dashboard"),
	type: 'object',
	properties: {
		provider: {
			description: nls.localize('dashboard.id', "Provider id (ex. MSSQL)"),
			type: 'string'
		},
		flavors: {
			description: nls.localize('dashboard.properties', "Property values to show on dashboard"),
			type: 'array',
			items: dashboardPropertyFlavorContrib
		}
	}
};

ExtensionsRegistry.registerExtensionPoint<ProviderProperties | ProviderProperties[]>({ extensionPoint: 'dashboard', jsonSchema: dashboardContrib }).setHandler(extensions => {

	function handleCommand(contrib: ProviderProperties, extension: IExtensionPointUser<any>) {
		dashboardRegistry.registerDashboardProvider(contrib.provider, contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<ProviderProperties>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
