// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import { window, OutputChannel } from 'vscode';
import PromptFactory from './factory';
import EscapeException from '../escapeException';
import { IQuestion, IPrompter, IPromptCallback } from './question';

// Supports simple pattern for prompting for user input and acting on this
export default class CodeAdapter implements IPrompter {

	private outChannel: OutputChannel;
	constructor() {
		// TODO Decide whether output channel logging should be saved here?
		this.outChannel = window.createOutputChannel('test');
		// this.outChannel.clear();
	}

	public logError(message: any): void {
		let line = `error: ${message.message}\n    Code - ${message.code}`;

		this.outChannel.appendLine(line);
	}

	public clearLog(): void {
		this.outChannel.clear();
	}

	public showLog(): void {
		this.outChannel.show();
	}

	// TODO define question interface
	private fixQuestion(question: any): any {
		if (question.type === 'checkbox' && Array.isArray(question.choices)) {
			// For some reason when there's a choice of checkboxes, they aren't formatted properly
			// Not sure where the issue is
			question.choices = question.choices.map(item => {
				if (typeof (item) === 'string') {
					return { checked: false, name: item, value: item };
				} else {
					return item;
				}
			});
		}
	}

	public promptSingle<T>(question: IQuestion, ignoreFocusOut?: boolean): Promise<T> {
		let questions: IQuestion[] = [question];
		return this.prompt(questions, ignoreFocusOut).then((answers: { [key: string]: T }) => {
			if (answers) {
				let response: T = answers[question.name];
				return response || undefined;
			}
			return undefined;
		});
	}

	public prompt<T>(questions: IQuestion[], ignoreFocusOut?: boolean): Promise<{ [key: string]: T }> {
		let answers: { [key: string]: T } = {};

		// Collapse multiple questions into a set of prompt steps
		let promptResult: Promise<{ [key: string]: T }> = questions.reduce((promise: Promise<{ [key: string]: T }>, question: IQuestion) => {
			this.fixQuestion(question);

			return promise.then(() => {
				return PromptFactory.createPrompt(question, ignoreFocusOut);
			}).then(prompt => {
				if (!question.shouldPrompt || question.shouldPrompt(answers) === true) {
					return prompt.render().then(result => {
						answers[question.name] = result;

						if (question.onAnswered) {
							question.onAnswered(result);
						}
						return answers;
					});
				}
				return answers;
			});
		}, Promise.resolve());

		return promptResult.catch(err => {
			if (err instanceof EscapeException || err instanceof TypeError) {
				return undefined;
			}

			window.showErrorMessage(err.message);
		});
	}

	// Helper to make it possible to prompt using callback pattern. Generally Promise is a preferred flow
	public promptCallback(questions: IQuestion[], callback: IPromptCallback): void {
		// Collapse multiple questions into a set of prompt steps
		this.prompt(questions).then(answers => {
			if (callback) {
				callback(answers);
			}
		});
	}
}
