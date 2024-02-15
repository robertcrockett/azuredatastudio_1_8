/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities, StaticFeature, RPCMessageType, ServerCapabilities } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import { Telemetry } from './telemetry';
import * as contracts from './contracts';
import * as azdata from 'azdata';
import * as Utils from './utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';

export class TelemetryFeature implements StaticFeature {

	constructor(private _client: SqlOpsDataClient) { }

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		Utils.ensure(capabilities, 'telemetry')!.telemetry = true;
	}

	initialize(): void {
		this._client.onNotification(contracts.TelemetryNotification.type, e => {
			Telemetry.sendTelemetryEvent(e.params.eventName, e.params.properties, e.params.measures);
		});
	}
}

export class DacFxServicesFeature extends SqlOpsFeature<undefined> {
	private static readonly messageTypes: RPCMessageType[] = [
		contracts.ExportRequest.type,
		contracts.ImportRequest.type,
		contracts.ExtractRequest.type,
		contracts.DeployRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, DacFxServicesFeature.messageTypes);
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: undefined): Disposable {
		const client = this._client;

		let exportBacpac = (databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> => {
			let params: contracts.ExportParams = { databaseName: databaseName, packageFilePath: packageFilePath, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
			return client.sendRequest(contracts.ExportRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.ExportRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let importBacpac = (packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> => {
			let params: contracts.ImportParams = { packageFilePath: packageFilePath, databaseName: databaseName, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
			return client.sendRequest(contracts.ImportRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.ImportRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let extractDacpac = (databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> => {
			let params: contracts.ExtractParams = { databaseName: databaseName, packageFilePath: packageFilePath, applicationName: applicationName, applicationVersion: applicationVersion, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
			return client.sendRequest(contracts.ExtractRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.ExtractRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deployDacpac = (packageFilePath: string, targetDatabaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> => {
			let params: contracts.DeployParams = { packageFilePath: packageFilePath, databaseName: targetDatabaseName, upgradeExisting: upgradeExisting, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
			return client.sendRequest(contracts.DeployRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.DeployRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let generateDeployScript = (packageFilePath: string, targetDatabaseName: string, scriptFilePath: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> => {
			let params: contracts.GenerateDeployScriptParams = { packageFilePath: packageFilePath, databaseName: targetDatabaseName, scriptFilePath: scriptFilePath, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
			return client.sendRequest(contracts.GenerateDeployScriptRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.GenerateDeployScriptRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let generateDeployPlan = (packageFilePath: string, targetDatabaseName: string, ownerUri: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.GenerateDeployPlanResult> => {
			let params: contracts.GenerateDeployPlanParams = { packageFilePath: packageFilePath, databaseName: targetDatabaseName, ownerUri: ownerUri, taskExecutionMode: taskExecutionMode };
			return client.sendRequest(contracts.GenerateDeployPlanRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.GenerateDeployPlanRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		return azdata.dataprotocol.registerDacFxServicesProvider({
			providerId: client.providerId,
			exportBacpac,
			importBacpac,
			extractDacpac,
			deployDacpac,
			generateDeployScript,
			generateDeployPlan
		});
	}
}

export class SchemaCompareServicesFeature extends SqlOpsFeature<undefined> {
	private static readonly messageTypes: RPCMessageType[] = [
		contracts.SchemaCompareRequest.type,
		contracts.SchemaCompareGenerateScriptRequest.type,
		contracts.SchemaCompareGetDefaultOptionsRequest.type,
		contracts.SchemaCompareIncludeExcludeNodeRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, SchemaCompareServicesFeature.messageTypes);
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: undefined): Disposable {
		const client = this._client;

		let schemaCompare = (sourceEndpointInfo: azdata.SchemaCompareEndpointInfo, targetEndpointInfo: azdata.SchemaCompareEndpointInfo, taskExecutionMode: azdata.TaskExecutionMode, deploymentOptions: azdata.DeploymentOptions): Thenable<azdata.SchemaCompareResult> => {
			let params: contracts.SchemaCompareParams = { sourceEndpointInfo: sourceEndpointInfo, targetEndpointInfo: targetEndpointInfo, taskExecutionMode: taskExecutionMode, deploymentOptions: deploymentOptions };
			return client.sendRequest(contracts.SchemaCompareRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.SchemaCompareRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let schemaCompareGenerateScript = (operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> => {
			let params: contracts.SchemaCompareGenerateScriptParams = { operationId: operationId, targetServerName: targetServerName, targetDatabaseName: targetDatabaseName, taskExecutionMode: taskExecutionMode };
			return client.sendRequest(contracts.SchemaCompareGenerateScriptRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.SchemaCompareGenerateScriptRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let schemaComparePublishChanges = (operationId: string, targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.ResultStatus> => {
			let params: contracts.SchemaComparePublishChangesParams = { operationId: operationId, targetServerName: targetServerName, targetDatabaseName: targetDatabaseName, taskExecutionMode: taskExecutionMode };
			return client.sendRequest(contracts.SchemaComparePublishChangesRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.SchemaComparePublishChangesRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let schemaCompareGetDefaultOptions = (): Thenable<azdata.SchemaCompareOptionsResult> => {
			let params: contracts.SchemaCompareGetOptionsParams = {};
			return client.sendRequest(contracts.SchemaCompareGetDefaultOptionsRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.SchemaCompareGetDefaultOptionsRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let schemaCompareIncludeExcludeNode = (operationId: string, diffEntry: azdata.DiffEntry, includeRequest: boolean, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.DacFxResult> => {
			let params: contracts.SchemaCompareNodeParams = { operationId: operationId, diffEntry, includeRequest, taskExecutionMode: taskExecutionMode };
			return client.sendRequest(contracts.SchemaCompareIncludeExcludeNodeRequest.type, params).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.SchemaCompareIncludeExcludeNodeRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		return azdata.dataprotocol.registerSchemaCompareServicesProvider({
			providerId: client.providerId,
			schemaCompare,
			schemaCompareGenerateScript,
			schemaComparePublishChanges,
			schemaCompareGetDefaultOptions,
			schemaCompareIncludeExcludeNode
		});
	}
}

export class AgentServicesFeature extends SqlOpsFeature<undefined> {
	private static readonly messagesTypes: RPCMessageType[] = [
		contracts.AgentJobsRequest.type,
		contracts.AgentJobHistoryRequest.type,
		contracts.AgentJobActionRequest.type
	];

	private onUpdatedHandler: () => any;

	constructor(client: SqlOpsDataClient) {
		super(client, AgentServicesFeature.messagesTypes);
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
		// this isn't explicitly necessary
		// ensure(ensure(capabilities, 'connection')!, 'agentServices')!.dynamicRegistration = true;
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: undefined): Disposable {
		const client = this._client;
		let self = this;

		// On updated registration
		let registerOnUpdated = (handler: () => any): void => {
			self.onUpdatedHandler = handler;
		};

		let fireOnUpdated = (): void => {
			if (self.onUpdatedHandler) {
				self.onUpdatedHandler();
			}
		};

		// Job management methods
		let getJobs = (ownerUri: string): Thenable<azdata.AgentJobsResult> => {
			let params: contracts.AgentJobsParams = { ownerUri: ownerUri, jobId: null };
			return client.sendRequest(contracts.AgentJobsRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(contracts.AgentJobsRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let getJobHistory = (ownerUri: string, jobID: string, jobName: string): Thenable<azdata.AgentJobHistoryResult> => {
			let params: contracts.AgentJobHistoryParams = { ownerUri: ownerUri, jobId: jobID, jobName: jobName };

			return client.sendRequest(contracts.AgentJobHistoryRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(contracts.AgentJobHistoryRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let jobAction = (ownerUri: string, jobName: string, action: string): Thenable<azdata.ResultStatus> => {
			let params: contracts.AgentJobActionParams = { ownerUri: ownerUri, jobName: jobName, action: action };
			return client.sendRequest(contracts.AgentJobActionRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(contracts.AgentJobActionRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let createJob = (ownerUri: string, jobInfo: azdata.AgentJobInfo): Thenable<azdata.CreateAgentJobResult> => {
			let params: contracts.CreateAgentJobParams = {
				ownerUri: ownerUri,
				job: jobInfo
			};
			let requestType = contracts.CreateAgentJobRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateJob = (ownerUri: string, originalJobName: string, jobInfo: azdata.AgentJobInfo): Thenable<azdata.UpdateAgentJobResult> => {
			let params: contracts.UpdateAgentJobParams = {
				ownerUri: ownerUri,
				originalJobName: originalJobName,
				job: jobInfo
			};
			let requestType = contracts.UpdateAgentJobRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteJob = (ownerUri: string, jobInfo: azdata.AgentJobInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentJobParams = {
				ownerUri: ownerUri,
				job: jobInfo
			};
			let requestType = contracts.DeleteAgentJobRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let getJobDefaults = (ownerUri: string): Thenable<azdata.AgentJobDefaultsResult> => {
			let params: contracts.AgentJobDefaultsParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentJobDefaultsRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		// Job Step management methods
		let createJobStep = (ownerUri: string, stepInfo: azdata.AgentJobStepInfo): Thenable<azdata.CreateAgentJobStepResult> => {
			let params: contracts.CreateAgentJobStepParams = {
				ownerUri: ownerUri,
				step: stepInfo
			};
			let requestType = contracts.CreateAgentJobStepRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateJobStep = (ownerUri: string, originalJobStepName: string, stepInfo: azdata.AgentJobStepInfo): Thenable<azdata.UpdateAgentJobStepResult> => {
			let params: contracts.UpdateAgentJobStepParams = {
				ownerUri: ownerUri,
				originalJobStepName: originalJobStepName,
				step: stepInfo
			};
			let requestType = contracts.UpdateAgentJobStepRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteJobStep = (ownerUri: string, stepInfo: azdata.AgentJobStepInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentJobStepParams = {
				ownerUri: ownerUri,
				step: stepInfo
			};
			let requestType = contracts.DeleteAgentJobStepRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		// Alert management methods
		let getAlerts = (ownerUri: string): Thenable<azdata.AgentAlertsResult> => {
			let params: contracts.AgentAlertsParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentAlertsRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let createAlert = (ownerUri: string, alertInfo: azdata.AgentAlertInfo): Thenable<azdata.CreateAgentAlertResult> => {
			let params: contracts.CreateAgentAlertParams = {
				ownerUri: ownerUri,
				alert: alertInfo
			};
			let requestType = contracts.CreateAgentAlertRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateAlert = (ownerUri: string, originalAlertName: string, alertInfo: azdata.AgentAlertInfo): Thenable<azdata.UpdateAgentAlertResult> => {
			let params: contracts.UpdateAgentAlertParams = {
				ownerUri: ownerUri,
				originalAlertName: originalAlertName,
				alert: alertInfo
			};
			let requestType = contracts.UpdateAgentAlertRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteAlert = (ownerUri: string, alertInfo: azdata.AgentAlertInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentAlertParams = {
				ownerUri: ownerUri,
				alert: alertInfo
			};
			let requestType = contracts.DeleteAgentAlertRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		// Operator management methods
		let getOperators = (ownerUri: string): Thenable<azdata.AgentOperatorsResult> => {
			let params: contracts.AgentOperatorsParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentOperatorsRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let createOperator = (ownerUri: string, operatorInfo: azdata.AgentOperatorInfo): Thenable<azdata.CreateAgentOperatorResult> => {
			let params: contracts.CreateAgentOperatorParams = {
				ownerUri: ownerUri,
				operator: operatorInfo
			};
			let requestType = contracts.CreateAgentOperatorRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateOperator = (ownerUri: string, originalOperatorName: string, operatorInfo: azdata.AgentOperatorInfo): Thenable<azdata.UpdateAgentOperatorResult> => {
			let params: contracts.UpdateAgentOperatorParams = {
				ownerUri: ownerUri,
				originalOperatorName: originalOperatorName,
				operator: operatorInfo
			};
			let requestType = contracts.UpdateAgentOperatorRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteOperator = (ownerUri: string, operatorInfo: azdata.AgentOperatorInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentOperatorParams = {
				ownerUri: ownerUri,
				operator: operatorInfo
			};
			let requestType = contracts.DeleteAgentOperatorRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		// Proxy management methods
		let getProxies = (ownerUri: string): Thenable<azdata.AgentProxiesResult> => {
			let params: contracts.AgentProxiesParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentProxiesRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let createProxy = (ownerUri: string, proxyInfo: azdata.AgentProxyInfo): Thenable<azdata.CreateAgentOperatorResult> => {
			let params: contracts.CreateAgentProxyParams = {
				ownerUri: ownerUri,
				proxy: proxyInfo
			};
			let requestType = contracts.CreateAgentProxyRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateProxy = (ownerUri: string, originalProxyName: string, proxyInfo: azdata.AgentProxyInfo): Thenable<azdata.UpdateAgentOperatorResult> => {
			let params: contracts.UpdateAgentProxyParams = {
				ownerUri: ownerUri,
				originalProxyName: originalProxyName,
				proxy: proxyInfo
			};
			let requestType = contracts.UpdateAgentProxyRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteProxy = (ownerUri: string, proxyInfo: azdata.AgentProxyInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentProxyParams = {
				ownerUri: ownerUri,
				proxy: proxyInfo
			};
			let requestType = contracts.DeleteAgentProxyRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		// Agent Credential Method
		let getCredentials = (ownerUri: string): Thenable<azdata.GetCredentialsResult> => {
			let params: contracts.GetCredentialsParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentCredentialsRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};


		// Job Schedule management methods
		let getJobSchedules = (ownerUri: string): Thenable<azdata.AgentJobSchedulesResult> => {
			let params: contracts.AgentJobScheduleParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentJobSchedulesRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let createJobSchedule = (ownerUri: string, scheduleInfo: azdata.AgentJobScheduleInfo): Thenable<azdata.CreateAgentJobScheduleResult> => {
			let params: contracts.CreateAgentJobScheduleParams = {
				ownerUri: ownerUri,
				schedule: scheduleInfo
			};
			let requestType = contracts.CreateAgentJobScheduleRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateJobSchedule = (ownerUri: string, originalScheduleName: string, scheduleInfo: azdata.AgentJobScheduleInfo): Thenable<azdata.UpdateAgentJobScheduleResult> => {
			let params: contracts.UpdateAgentJobScheduleParams = {
				ownerUri: ownerUri,
				originalScheduleName: originalScheduleName,
				schedule: scheduleInfo
			};
			let requestType = contracts.UpdateAgentJobScheduleRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteJobSchedule = (ownerUri: string, scheduleInfo: azdata.AgentJobScheduleInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentJobScheduleParams = {
				ownerUri: ownerUri,
				schedule: scheduleInfo
			};
			let requestType = contracts.DeleteAgentJobScheduleRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		return azdata.dataprotocol.registerAgentServicesProvider({
			providerId: client.providerId,
			getJobs,
			getJobHistory,
			jobAction,
			createJob,
			updateJob,
			deleteJob,
			getJobDefaults,
			createJobStep,
			updateJobStep,
			deleteJobStep,
			getAlerts,
			createAlert,
			updateAlert,
			deleteAlert,
			getOperators,
			createOperator,
			updateOperator,
			deleteOperator,
			getProxies,
			createProxy,
			updateProxy,
			deleteProxy,
			getCredentials,
			getJobSchedules,
			createJobSchedule,
			updateJobSchedule,
			deleteJobSchedule,
			registerOnUpdated
		});
	}
}
