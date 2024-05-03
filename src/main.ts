import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import TaskList from './ui/TaskList.svelte';
import { CreateTaskModal } from './modals';
import { TinyEmitter } from 'tiny-emitter';
import TaskHandler, { TaskEvents } from './task-handler';

// Remember to rename these classes and interfaces!

interface TWSettings {
	path: string;
}

const DEFAULT_SETTINGS: TWSettings = {
	path: 'task'
}

export default class TWPlugin extends Plugin {
	settings: TWSettings = DEFAULT_SETTINGS;
	emitter: TinyEmitter | undefined = undefined;
	handler: TaskHandler | undefined = undefined;

	async onload() {
		await this.loadSettings();
		this.emitter = new TinyEmitter();
		this.handler = new TaskHandler(this);

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'tw-create-new-task',
			name: 'Create new task',
			callback: () => {
				new CreateTaskModal(this.app, this).open();
			}
		});

		this.registerMarkdownCodeBlockProcessor('tw', (source, el, ctx) => {
			
			// Parse command
			const input = source.trim().split('\n');
			const report = input[0]?.trim();
			const command = input[1]?.trim();
			const newTaskTemplate = input[2]?.trim();

			new TaskList({
				target: el,
				props: {
					plugin: this,
					report: report,
					command: command,
					newTaskTemplate: newTaskTemplate,
				}
			});

			// Render element
				// Append events
				// Append eager update events
				// Add Svelte rendering
				// Refresh via events
				// Register click events for completions and deletion
				// Register click events for manual refresh

			// Get task event
		})

		this.registerInterval(window.setInterval(() => this.emitter?.emit(TaskEvents.INTERVAL), 10000));
		this.addSettingTab(new TWSettingTab(this.app, this));
	}

	onunload() {
		this.emitter?.off(TaskEvents.INTERVAL);
		this.emitter?.off(TaskEvents.REFRESH);
		this.emitter = undefined;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TWSettingTab extends PluginSettingTab {
	plugin: TWPlugin;

	constructor(app: App, plugin: TWPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('TW Command Path')
			.setDesc('Path of the taskwarrior executable')
			.addText(text => text
				.setPlaceholder('task')
				.setValue(this.plugin.settings.path)
				.onChange(async (value) => {
					this.plugin.settings.path = value;
					await this.plugin.saveSettings();
				}));
	}
}
