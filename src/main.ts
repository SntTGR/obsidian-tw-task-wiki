import { App, Plugin, PluginSettingTab, Setting, MarkdownRenderChild, Notice, TFile } from 'obsidian';
import TaskList from './ui/TaskList.svelte';
import { CreateTaskModal } from './modals';
import { TinyEmitter } from 'tiny-emitter';
import TaskHandler, { TaskEvents } from './task-handler';
import { TWPluginLogger, clearUriCache, sanitize, sanitizeSingleArgument } from './util';
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
	tasknote_enabled: boolean;
	tasknote_folder: string;
	tasknote_right_click_context_menu_action: boolean;
	tasknote_annotation_prefix: string;
}


const DEFAULT_SETTINGS: TWSettings = {
	tw_bin: 'task',
	debug_log: false,
	cache_columns: true,
	delete_key: "Alt",
	right_click_context_menu_enabled: false,
	right_click_context_menu_actions: [],
	project_urls_enabled: false,
	project_regex_url_entries: [],
	tasknote_enabled: false,
	tasknote_folder: 'tasknotes',
	tasknote_right_click_context_menu_action: false,
	tasknote_annotation_prefix: '[tasknote]',
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

		this.registerHoverLinkSource('tw-task-wiki', {
			display: 'TW Task Wiki',
			defaultMod: false,
		});

		this.registerInterval(window.setInterval(() => this.emitter?.emit(TaskEvents.INTERVAL), 10000));
		this.addSettingTab(new TWSettingTab(this.app, this));
	}

	onunload() {		
		this.emitter?.off(TaskEvents.INTERVAL);
		this.emitter?.off(TaskEvents.REFRESH);
		this.emitter = undefined;
	}

	async openTaskNote(uuid: string) {
		const folder = this.settings.tasknote_folder;
		const filePath = `${folder}/${uuid}.md`;

		let file = this.app.vault.getFileByPath(filePath);
		if (!file) {
			if (!this.app.vault.getAbstractFileByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}
			file = await this.app.vault.create(filePath, `---\ntask_uuid: ${uuid}\n---\n`);
			await this.handler?.annotateTask(uuid, this.settings.tasknote_annotation_prefix);
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file as TFile);
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
					this.plugin.logger?.setDebugMode(value);
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
					this.plugin.settings.delete_key = value;
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
			const openTaskNoteSetting = new Setting(containerEl)
				.setName('Open task note')
				.setDesc('Built-in action that creates/opens a note for the task. Requires tasknote integration to be enabled.')
				.addToggle(toggle => toggle
					.setDisabled(!this.plugin.settings.tasknote_enabled)
					.setValue(this.plugin.settings.tasknote_right_click_context_menu_action)
					.onChange(async (value) => {
						this.plugin.settings.tasknote_right_click_context_menu_action = value;
						await this.plugin.saveSettings();
					}));
			if (!this.plugin.settings.tasknote_enabled) {
				openTaskNoteSetting.settingEl.style.opacity = '0.5';
			}

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

		new Setting(containerEl)
			.setHeading()
			.setName('Tasknote integration')
			.setDesc('Integrates with tasknote plugin to create and link notes to tasks.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.tasknote_enabled)
				.onChange(async (value) => {
					this.plugin.settings.tasknote_enabled = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.tasknote_enabled) {
			const tasknoteDesc = document.createDocumentFragment();
			tasknoteDesc.append(
				'Vault-relative folder where task notes are stored. Compatible with ',
				tasknoteDesc.createEl('a', { text: 'tasknote', href: 'https://github.com/mikebobroski/tasknote' }),
				' if you configure it with FOLDER=<this folder>, and EXT=.md.',
			);
			new Setting(containerEl)
				.setName('Tasknote folder')
				.setDesc(tasknoteDesc)
				.addText(text => text
					.setPlaceholder('tasknotes')
					.setValue(this.plugin.settings.tasknote_folder)
					.onChange(async (value) => {
						this.plugin.settings.tasknote_folder = value;
						await this.plugin.saveSettings();
					}));
			new Setting(containerEl)
				.setName('Tasknote annotation prefix')
				.setDesc('Prefix used on a task annotation to mark it as the tasknote link. Added automatically when creating a note.')
				.addText(text => text
					.setPlaceholder('[tasknote]')
					.setValue(this.plugin.settings.tasknote_annotation_prefix)
					.onChange(async (value) => {
						this.plugin.settings.tasknote_annotation_prefix = value;
						await this.plugin.saveSettings();
					}));
		}


		// Project regex urls menu
		new Setting(containerEl)
			.setHeading()
			.setName('Project URLs')
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

			// Display regex urls
			for (const [index, project] of this.plugin.settings.project_regex_url_entries.entries()) {
				new Setting(containerEl)
					.addText(text => text
						.setPlaceholder('myproject.*')
						.setValue(project.regexString)
						.onChange(async (value) => {
							this.plugin.settings.project_regex_url_entries[index].regexString = value
							clearUriCache();
							await this.plugin.saveSettings();
						}))
					.addText(text => text
						.setPlaceholder('obsidian://myfolder/mysubfolder/myproject')
						.setValue(project.uri)
						.onChange(async (value) => {
							this.plugin.settings.project_regex_url_entries[index].uri = value
							clearUriCache();
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
									clearUriCache();
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
									clearUriCache();
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
								clearUriCache();
								await this.plugin.saveSettings();
								this.display();
							})
					});
			}
		}
		


	}
}
