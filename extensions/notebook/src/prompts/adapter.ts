// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import { window } from 'vscode';
import PromptFactory from './factory';
import EscapeException from './escapeException';
import { IQuestion, IPrompter, IPromptCallback } from './question';

// Supports simple pattern for prompting for user input and acting on this
export default class CodeAdapter implements IPrompter {

	// TODO define question interface
	private fixQuestion(question: any): any {
		if (question.type === 'checkbox' && Array.isArray(question.choices)) {
			// For some reason when there's a choice of checkboxes, they aren't formatted properly
			// Not sure where the issue is
			question.choices = question.choices.map((item: any) => {
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
				// Original Code: uses jQuery patterns. Keeping for reference
				// if (!question.when || question.when(answers) === true) {
				//     return prompt.render().then(result => {
				//         answers[question.name] = question.filter ? question.filter(result) : result;
				//     });
				// }

				if (!question.shouldPrompt || question.shouldPrompt(answers) === true) {
					return prompt.render().then((result: any) => {
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
