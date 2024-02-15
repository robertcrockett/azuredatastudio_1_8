/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dialogModal';

import { forwardRef, NgModule, ComponentFactoryResolver, Inject, ApplicationRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, APP_BASE_HREF } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';

import { DialogContainer } from 'sql/platform/dialog/dialogContainer.component';
import { WizardNavigation } from 'sql/platform/dialog/wizardNavigation.component';
import { Extensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';
import { ModelViewContent } from 'sql/workbench/electron-browser/modelComponents/modelViewContent.component';
import { ModelComponentWrapper } from 'sql/workbench/electron-browser/modelComponents/modelComponentWrapper.component';
import { ComponentHostDirective } from 'sql/workbench/parts/dashboard/common/componentHost.directive';
import { IBootstrapParams, ISelector, providerIterator } from 'sql/platform/bootstrap/node/bootstrapService';
import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';
import { EditableDropDown } from 'sql/platform/electron-browser/editableDropdown/editableDropdown.component';
import { Checkbox } from 'sql/base/electron-browser/ui/checkbox/checkbox.component';
import { SelectBox } from 'sql/platform/ui/electron-browser/selectBox/selectBox.component';
import { InputBox } from 'sql/base/electron-browser/ui/inputBox/inputBox.component';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Registry } from 'vs/platform/registry/common/platform';

export const DialogModule = (params, selector: string, instantiationService: IInstantiationService): any => {

	/* Model-backed components */
	let extensionComponents = Registry.as<IComponentRegistry>(Extensions.ComponentContribution).getAllCtors();

	@NgModule({
		declarations: [
			Checkbox,
			SelectBox,
			EditableDropDown,
			InputBox,
			DialogContainer,
			WizardNavigation,
			ModelViewContent,
			ModelComponentWrapper,
			ComponentHostDirective,
			...extensionComponents
		],
		entryComponents: [DialogContainer, WizardNavigation, ...extensionComponents],
		imports: [
			FormsModule,
			CommonModule,
			BrowserModule
		],
		providers: [
			{ provide: APP_BASE_HREF, useValue: '/' },
			CommonServiceInterface,
			{ provide: IBootstrapParams, useValue: params },
			{ provide: ISelector, useValue: selector },
			...providerIterator(instantiationService)
		]
	})
	class ModuleClass {

		constructor(
			@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
			@Inject(ISelector) private selector: string
		) {
		}

		ngDoBootstrap(appRef: ApplicationRef) {
			let componentClass = this.selector.startsWith(WizardNavigation.SELECTOR) ? WizardNavigation : DialogContainer;
			const factoryWrapper: any = this._resolver.resolveComponentFactory<WizardNavigation | DialogContainer>(componentClass);
			factoryWrapper.factory.selector = this.selector;
			appRef.bootstrap(factoryWrapper);
		}
	}

	return ModuleClass;
};
