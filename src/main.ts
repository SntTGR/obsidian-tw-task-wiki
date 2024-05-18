import { App, Plugin, PluginSettingTab, Setting, MarkdownRenderChild, Notice } from 'obsidian';
import TaskList from './ui/TaskList.svelte';
import { CreateTaskModal } from './modals';
import { TinyEmitter } from 'tiny-emitter';
import TaskHandler, { TaskEvents } from './task-handler';
import { TWPluginLogger, sanitize, sanitizeSingleArgument } from './util';
import { SvelteComponent } from 'svelte';

interface TWSettings {
	tw_bin: string;
	debug_log: boolean;
	cache_columns: boolean;
}

const DEFAULT_SETTINGS: TWSettings = {
	tw_bin: 'task',
	debug_log: false,
	cache_columns: true,
}

class LifeCycleHookMRC extends MarkdownRenderChild {
	
	component: SvelteComponent
	
	constructor(el: HTMLElement, component: SvelteComponent) {
		super(el);
		this.component = component;
	}

	onunload(): void {
		this.component.$destroy();
	}
}

export default class TWPlugin extends Plugin {
	settings: TWSettings = DEFAULT_SETTINGS;
	emitter: TinyEmitter | undefined = undefined;
	handler: TaskHandler | undefined = undefined;
	logger: TWPluginLogger | undefined = undefined;

	async onload() {
		await this.loadSettings();
		this.emitter = new TinyEmitter();
		this.handler = new TaskHandler(this);
		this.logger = new TWPluginLogger(this.settings.debug_log);

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'create-new-task',
			name: 'Create task',
			callback: () => {
				new CreateTaskModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'undo',
			name: 'Undo last task action',
			callback: () => {
				this.handler?.undo();
			}
		})

		this.registerMarkdownCodeBlockProcessor('tw', (source, el, ctx) => {
			
			// Parse command
			const input = source.trim().split('\n');
			const report = input[0]?.trim();
			
			const command = input[1]?.trim();

			const newTaskTemplate = input[2]?.trim();

			const svelteComponent = new TaskList({
				target: el,
				props: {
					plugin: this,
					
					report: report,
					sanitizedReport: sanitizeSingleArgument(report),
					
					command: command,
					sanitizedCommand: command ? sanitize(command) : '',
					
					newTaskTemplate: newTaskTemplate
				}
			});
			
			const component = new LifeCycleHookMRC(el, svelteComponent);
			ctx.addChild(component);

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
			.setName('TaskWarrior path')
			.setDesc('Path of the taskwarrior executable')
			.addText(text => text
				.setPlaceholder('/usr/bin/task')
				.setValue(this.plugin.settings.tw_bin)
				.onChange(async (value) => {
					this.plugin.settings.tw_bin = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Debug log')
			.setDesc('Enable debug logging. Prints taskwarrior commands to web console.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debug_log)
				.onChange(async (value) => {
					this.plugin.settings.debug_log = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Columns cache')
			.setDesc('Cache report columns/labels for faster reloading. Disable if you fiddle with the taskwarrior report columns too much :).')
			.addButton(button => {
				button
					.setButtonText('Clear cache')
					.onClick(async () => {
						const cleared = this.plugin.handler?.clearColumnCache();
						if (cleared !== undefined) new Notice(`Cleared ${cleared} cached reports`);
					})
			})
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.cache_columns)
				.onChange(async (value) => {
					this.plugin.settings.cache_columns = value;
					await this.plugin.saveSettings();
				}))
			
	
	}
}
