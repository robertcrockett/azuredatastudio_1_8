/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { resolveCommonProperties } from 'vs/platform/telemetry/node/commonProperties';

export const instanceStorageKey = 'telemetry.instanceId';
export const currentSessionDateStorageKey = 'telemetry.currentSessionDate';
export const firstSessionDateStorageKey = 'telemetry.firstSessionDate';
export const lastSessionDateStorageKey = 'telemetry.lastSessionDate';

// {{ SQL CARBON EDIT }}
import product from 'vs/platform/product/node/product';

export async function resolveWorkbenchCommonProperties(storageService: IStorageService, commit: string | undefined, version: string | undefined, machineId: string, installSourcePath: string): Promise<{ [name: string]: string | undefined }> {
	const result = await resolveCommonProperties(commit, version, machineId, installSourcePath);
	const instanceId = storageService.get(instanceStorageKey, StorageScope.GLOBAL)!;
	const firstSessionDate = storageService.get(firstSessionDateStorageKey, StorageScope.GLOBAL)!;
	const lastSessionDate = storageService.get(lastSessionDateStorageKey, StorageScope.GLOBAL)!;

	// __GDPR__COMMON__ "common.version.shell" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
	// result['common.version.shell'] = process.versions && process.versions['electron'];
	// __GDPR__COMMON__ "common.version.renderer" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
	// result['common.version.renderer'] = process.versions && process.versions['chrome'];
	// __GDPR__COMMON__ "common.firstSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
	// result['common.firstSessionDate'] = firstSessionDate;
	// __GDPR__COMMON__ "common.lastSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
	// result['common.lastSessionDate'] = lastSessionDate || '';
	// __GDPR__COMMON__ "common.isNewSession" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
	// result['common.isNewSession'] = !lastSessionDate ? '1' : '0';
	// __GDPR__COMMON__ "common.instanceId" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
	// result['common.instanceId'] = instanceId;

	// __GDPR__COMMON__ "common.version.shell" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
	result['common.version.shell'] = process.versions && process.versions['electron'];
	// __GDPR__COMMON__ "common.version.renderer" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
	result['common.version.renderer'] = process.versions && process.versions['chrome'];
	// {{SQL CARBON EDIT}}
	result['common.application.name'] = product.nameLong;
	// {{SQL CARBON EDIT}}
	result['common.userId'] = '';

	// {{SQL CARBON EDIT}}
	setUsageDates(storageService);

	return result;
}

// {{SQL CARBON EDIT}}
function setUsageDates(storageService: IStorageService): void {
	// daily last usage date
	const appStartDate = new Date('January 1, 2000');
	const dailyLastUseDate = storageService.get('telemetry.dailyLastUseDate', StorageScope.GLOBAL, appStartDate.toUTCString());
	storageService.store('telemetry.dailyLastUseDate', dailyLastUseDate, StorageScope.GLOBAL);

	// weekly last usage date
	const weeklyLastUseDate = storageService.get('telemetry.weeklyLastUseDate', StorageScope.GLOBAL, appStartDate.toUTCString());
	storageService.store('telemetry.weeklyLastUseDate', weeklyLastUseDate, StorageScope.GLOBAL);

	// monthly last usage date
	const monthlyLastUseDate = storageService.get('telemetry.monthlyLastUseDate', StorageScope.GLOBAL, appStartDate.toUTCString());
	storageService.store('telemetry.monthlyLastUseDate', monthlyLastUseDate, StorageScope.GLOBAL);

}
