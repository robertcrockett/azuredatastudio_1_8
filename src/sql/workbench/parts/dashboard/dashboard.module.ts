/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Inject, NgModule, forwardRef, ApplicationRef, ComponentFactoryResolver } from '@angular/core';
import { CommonModule, APP_BASE_HREF } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes, UrlSerializer, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgGridModule } from 'angular2-grid';
import { ChartsModule } from 'ng2-charts';

import CustomUrlSerializer from 'sql/base/node/urlSerializer';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/common/insightRegistry';
import { Extensions as ComponentExtensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';
import { IBootstrapParams, ISelector, providerIterator } from 'sql/platform/bootstrap/node/bootstrapService';

import { Registry } from 'vs/platform/registry/common/platform';

/* Telemetry */
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryUtils from 'sql/platform/telemetry/telemetryUtilities';
import * as TelemetryKeys from 'sql/platform/telemetry/telemetryKeys';

/* Services */
import { BreadcrumbService } from 'sql/workbench/parts/dashboard/services/breadcrumb.service';
import { DashboardServiceInterface } from 'sql/workbench/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';

/* Directives */
import { ComponentHostDirective } from 'sql/workbench/parts/dashboard/common/componentHost.directive';

/* Base Components */
import { DashboardComponent } from 'sql/workbench/parts/dashboard/dashboard.component';
import { DashboardWidgetWrapper } from 'sql/workbench/parts/dashboard/contents/dashboardWidgetWrapper.component';
import { DashboardWidgetContainer } from 'sql/workbench/parts/dashboard/containers/dashboardWidgetContainer.component';
import { DashboardGridContainer } from 'sql/workbench/parts/dashboard/containers/dashboardGridContainer.component';
import { DashboardWebviewContainer } from 'sql/workbench/parts/dashboard/containers/dashboardWebviewContainer.component';
import { DashboardModelViewContainer } from 'sql/workbench/parts/dashboard/containers/dashboardModelViewContainer.component';
import { DashboardErrorContainer } from 'sql/workbench/parts/dashboard/containers/dashboardErrorContainer.component';
import { DashboardNavSection } from 'sql/workbench/parts/dashboard/containers/dashboardNavSection.component';
import { WidgetContent } from 'sql/workbench/parts/dashboard/contents/widgetContent.component';
import { ModelViewContent } from 'sql/workbench/electron-browser/modelComponents/modelViewContent.component';
import { ModelComponentWrapper } from 'sql/workbench/electron-browser/modelComponents/modelComponentWrapper.component';
import { WebviewContent } from 'sql/workbench/parts/dashboard/contents/webviewContent.component';
import { BreadcrumbComponent } from 'sql/base/electron-browser/ui/breadcrumb/breadcrumb.component';
import { IBreadcrumbService } from 'sql/base/electron-browser/ui/breadcrumb/interfaces';
import { DashboardHomeContainer } from 'sql/workbench/parts/dashboard/containers/dashboardHomeContainer.component';
import { ControlHostContent } from 'sql/workbench/parts/dashboard/contents/controlHostContent.component';
import { DashboardControlHostContainer } from 'sql/workbench/parts/dashboard/containers/dashboardControlHostContainer.component';
import { JobsViewComponent } from 'sql/workbench/parts/jobManagement/electron-browser/jobsView.component';
import { AgentViewComponent } from 'sql/workbench/parts/jobManagement/electron-browser/agentView.component';
import { AlertsViewComponent } from 'sql/workbench/parts/jobManagement/electron-browser/alertsView.component';
import { JobHistoryComponent } from 'sql/workbench/parts/jobManagement/electron-browser/jobHistory.component';
import { OperatorsViewComponent } from 'sql/workbench/parts/jobManagement/electron-browser/operatorsView.component';
import { ProxiesViewComponent } from 'sql/workbench/parts/jobManagement/electron-browser/proxiesView.component';
import LoadingSpinner from 'sql/workbench/electron-browser/modelComponents/loadingSpinner.component';
import { Checkbox } from 'sql/base/electron-browser/ui/checkbox/checkbox.component';
import { SelectBox } from 'sql/platform/ui/electron-browser/selectBox/selectBox.component';
import { InputBox } from 'sql/base/electron-browser/ui/inputBox/inputBox.component';
import { EditableDropDown } from 'sql/platform/electron-browser/editableDropdown/editableDropdown.component';

const baseComponents = [DashboardHomeContainer, DashboardComponent, DashboardWidgetWrapper, DashboardWebviewContainer,
	DashboardWidgetContainer, DashboardGridContainer, DashboardErrorContainer, DashboardNavSection, ModelViewContent, WebviewContent, WidgetContent,
	ComponentHostDirective, BreadcrumbComponent, ControlHostContent, DashboardControlHostContainer,
	JobsViewComponent, AgentViewComponent, JobHistoryComponent, JobStepsViewComponent, AlertsViewComponent, ProxiesViewComponent, OperatorsViewComponent,
	DashboardModelViewContainer, ModelComponentWrapper, Checkbox, EditableDropDown, SelectBox, InputBox, LoadingSpinner];

/* Panel */
import { PanelModule } from 'sql/base/electron-browser/ui/panel/panel.module';

import { ScrollableModule } from 'sql/base/electron-browser/ui/scrollable/scrollable.module';

/* Pages */
import { ServerDashboardPage } from 'sql/workbench/parts/dashboard/pages/serverDashboardPage.component';
import { DatabaseDashboardPage } from 'sql/workbench/parts/dashboard/pages/databaseDashboardPage.component';

const pageComponents = [ServerDashboardPage, DatabaseDashboardPage];

/* Widget Components */
import { PropertiesWidgetComponent } from 'sql/workbench/parts/dashboard/widgets/properties/propertiesWidget.component';
import { ExplorerWidget } from 'sql/workbench/parts/dashboard/widgets/explorer/explorerWidget.component';
import { TasksWidget } from 'sql/workbench/parts/dashboard/widgets/tasks/tasksWidget.component';
import { InsightsWidget } from 'sql/workbench/parts/dashboard/widgets/insights/insightsWidget.component';
import { WebviewWidget } from 'sql/workbench/parts/dashboard/widgets/webview/webviewWidget.component';
import { JobStepsViewComponent } from 'sql/workbench/parts/jobManagement/electron-browser/jobStepsView.component';
import { IInstantiationService, _util } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';

const widgetComponents = [
	PropertiesWidgetComponent,
	ExplorerWidget,
	TasksWidget,
	InsightsWidget,
	WebviewWidget
];

/* Insights */
const insightComponents = Registry.as<IInsightRegistry>(Extensions.InsightContribution).getAllCtors();

// Setup routes for various child components
const appRoutes: Routes = [
	{ path: 'database-dashboard', component: DatabaseDashboardPage },
	{ path: 'server-dashboard', component: ServerDashboardPage },
	{
		path: '',
		redirectTo: 'database-dashboard',
		pathMatch: 'full'
	},
	{ path: '**', component: DatabaseDashboardPage }
];

// Connection Dashboard main angular module
export const DashboardModule = (params, selector: string, instantiationService: IInstantiationService): any => {

	/* Model-backed components */
	const extensionComponents = Registry.as<IComponentRegistry>(ComponentExtensions.ComponentContribution).getAllCtors();

	@NgModule({
		declarations: [
			...baseComponents,
			...pageComponents,
			...widgetComponents,
			...insightComponents,
			...extensionComponents
		],
		// also for widgets
		entryComponents: [
			DashboardComponent,
			...widgetComponents,
			...insightComponents,
			...extensionComponents
		],
		imports: [
			CommonModule,
			BrowserModule,
			FormsModule,
			NgGridModule,
			ChartsModule,
			RouterModule.forRoot(appRoutes),
			PanelModule,
			ScrollableModule
		],
		providers: [
			{ provide: APP_BASE_HREF, useValue: '/' },
			{ provide: IBreadcrumbService, useClass: BreadcrumbService },
			{ provide: CommonServiceInterface, useClass: DashboardServiceInterface },
			{ provide: UrlSerializer, useClass: CustomUrlSerializer },
			{ provide: IBootstrapParams, useValue: params },
			{ provide: ISelector, useValue: selector },
			...providerIterator(instantiationService)
		]
	})
	class ModuleClass {
		private navigations = 0;
		constructor(
			@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
			@Inject(forwardRef(() => Router)) private _router: Router,
			@Inject(ITelemetryService) private telemetryService: ITelemetryService,
			@Inject(ILogService) private readonly logService: ILogService,
			@Inject(ISelector) private selector: string
		) {
		}

		ngDoBootstrap(appRef: ApplicationRef) {
			const factory = this._resolver.resolveComponentFactory(DashboardComponent);
			(<any>factory).factory.selector = this.selector;
			appRef.bootstrap(factory);

			this._router.events.subscribe(e => {
				if (e instanceof NavigationEnd) {
					this.navigations++;
					TelemetryUtils.addTelemetry(this.telemetryService, this.logService, TelemetryKeys.DashboardNavigated, {
						numberOfNavigations: this.navigations
					});
				}
			});
		}
	}

	return ModuleClass;
};
