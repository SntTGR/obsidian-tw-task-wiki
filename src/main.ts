import { App, Plugin, PluginSettingTab, Setting, MarkdownRenderChild, Notice } from 'obsidian';
import TaskList from './ui/TaskList.svelte';
import { CreateTaskModal } from './modals';
import { TinyEmitter } from 'tiny-emitter';
import TaskHandler, { TaskEvents } from './task-handler';
import { TWPluginLogger, sanitize, sanitizeSingleArgument } from './util';
import { SvelteComponent } from 'svelte';
import { setGlobalContext } from './util';
import { randomUUID } from 'crypto';

class RightClickMenuAction 
{ 
	ActionId: string
	ActionName: string
	Action: string
	constructor(name:string, action:string) {
		this.Action = action;
		this.ActionName = name;	
		this.ActionId = randomUUID();
	}
}

class ProjectRegexUrl {	
	regexString: string;
	uri: string;
	constructor(regex: string, uri: string) {
		this.regexString = regex;
		this.uri = uri;
	}
}

interface TWSettings {
	tw_bin: string;
	debug_log: boolean;
	cache_columns: boolean;
	delete_key: string;
	right_click_context_menu_enabled: boolean;
	right_click_context_menu_actions: RightClickMenuAction[];
	project_urls_enabled: boolean;
	project_regex_url_entries: ProjectRegexUrl[];
}


const DEFAULT_SETTINGS: TWSettings = {
	tw_bin: 'task',
	debug_log: false,
	cache_columns: true,
	delete_key: "Alt",
	right_click_context_menu_enabled: false,
	right_click_context_menu_actions: [],
	project_urls_enabled: false,
	project_regex_url_entries: []
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
				new CreateTaskModal().open();
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

			setGlobalContext(this);

			const svelteComponent = new TaskList({
				target: el,
				props: {
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

		new Setting(containerEl)
			.setName('Deletion hold Key')
			.setDesc('Hold key to enable task deletion')
			.addText(text => text
				.setPlaceholder('Alt')
				.setValue(this.plugin.settings.delete_key)
				.onChange(async (value) => {
					this.plugin.settings.delete_key= value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable custom actions context menu')
			.setDesc('Will enable feature of custom actions on context menu on right click.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.right_click_context_menu_enabled)
				.onChange(async (value) => {
					this.plugin.settings.right_click_context_menu_enabled = value;
					await this.plugin.saveSettings();
					this.display();
				}))
		
		if(this.plugin.settings.right_click_context_menu_enabled) {
			new Setting(containerEl)
				.setHeading().setName('Right click context menu actions')
				.setDesc('')
				.addButton(button => {
					button
						.setButtonText('+')
						.onClick(async () => {
							this.plugin.settings.right_click_context_menu_actions.push(new RightClickMenuAction('', ''))
							this.display();
						})
			});

			// Display actions
			for (const [index, action] of this.plugin.settings.right_click_context_menu_actions.entries()) {
				new Setting(containerEl)
					.addText(text => text
						.setPlaceholder('Name')
						.setValue(action.ActionName)
						.onChange(async (value) => {
							this.plugin.settings.right_click_context_menu_actions[index].ActionName = value
							await this.plugin.saveSettings();
						}))
					.addText(text => text
						.setPlaceholder('Example +today')
						.setValue(action.Action)
						.onChange(async (value) => {
							this.plugin.settings.right_click_context_menu_actions[index].Action = value
							await this.plugin.saveSettings();
						}))
					.addButton(button => {
						button
							.setButtonText('-')
							.onClick(async () => {
								this.plugin.settings.right_click_context_menu_actions = this.plugin.settings.right_click_context_menu_actions.filter(x => x.ActionId != action.ActionId)
								await this.plugin.saveSettings();
								this.display();
							})
						});
			}
		}

		// Project glob urls menu

		new Setting(containerEl)
			.setName('Enable project urls')
			.setDesc('Will enable external linking for projects in lists.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.project_urls_enabled)
				.onChange(async (value) => {
					this.plugin.settings.project_urls_enabled = value;
					await this.plugin.saveSettings();
					this.display();
				}));
		
		if(this.plugin.settings.project_urls_enabled) {
			new Setting(containerEl)
				.setHeading().setName('Project Regex URIs')
				.setDesc('Order dictates priority')
				.addButton(button => {
					button
						.setButtonText('+')
						.onClick(async () => {
							this.plugin.settings.project_regex_url_entries.push(new ProjectRegexUrl('', ''))
							this.display();
						})
				});

			// Display actions
			for (const [index, project] of this.plugin.settings.project_regex_url_entries.entries()) {
				new Setting(containerEl)
					.addText(text => text
						.setPlaceholder('myproject.*')
						.setValue(project.regexString)
						.onChange(async (value) => {
							this.plugin.settings.project_regex_url_entries[index].regexString = value
							await this.plugin.saveSettings();
						}))
					.addText(text => text
						.setPlaceholder('obsidian://myfolder/mysubfolder/myproject')
						.setValue(project.uri)
						.onChange(async (value) => {
							this.plugin.settings.project_regex_url_entries[index].uri = value
							await this.plugin.saveSettings();
						}))
					.addButton(button => {
						button
							.setButtonText('↑')
							.onClick(async () => {
								if(index > 0) {
									const temp = this.plugin.settings.project_regex_url_entries[index - 1];
									this.plugin.settings.project_regex_url_entries[index - 1] = this.plugin.settings.project_regex_url_entries[index];
									this.plugin.settings.project_regex_url_entries[index] = temp;
									await this.plugin.saveSettings();
									this.display();
								}
							})
					})
					.addButton(button => {
						button
							.setButtonText('↓')
							.onClick(async () => {
								if(index < this.plugin.settings.project_regex_url_entries.length - 1) {
									const temp = this.plugin.settings.project_regex_url_entries[index + 1];
									this.plugin.settings.project_regex_url_entries[index + 1] = this.plugin.settings.project_regex_url_entries[index];
									this.plugin.settings.project_regex_url_entries[index] = temp;
									await this.plugin.saveSettings();
									this.display();
								}
							})
					})
					.addButton(button => {
						button
							.setButtonText('-')
							.onClick(async () => {
								this.plugin.settings.project_regex_url_entries = this.plugin.settings.project_regex_url_entries.filter(x => x != project)
								await this.plugin.saveSettings();
								this.display();
							})
					});
			}
		}
		


	}
}
