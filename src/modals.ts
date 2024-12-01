import { App, Modal } from "obsidian";
import TaskCreate from "./ui/TaskCreate.svelte";
import TaskModify from './ui/TaskModify.svelte';
import TWPlugin from './main';
import { getGlobalContext } from "./util";

class TWPModal extends Modal {
    plugin: TWPlugin;
    
    constructor(app: App, plugin: TWPlugin) {
        super(app);
        this.plugin = plugin;
    }
}

export class CreateTaskModal extends TWPModal {
	private ctModal: TaskCreate | undefined;
	private template?: string;

	constructor(template?: string) {
		const plugin = getGlobalContext();
		
		super(plugin.app, plugin);
		this.template = template;
	}

	onOpen() {
		const {titleEl, contentEl} = this;
		this.ctModal = new TaskCreate({
			target: contentEl,
			props: {
				close: () => this.close(),
				plugin: this.plugin,
				titleElement: titleEl,
				template: this.template,
			}
		})
	}

	onClose() {
		this.ctModal?.$destroy();
		const {contentEl} = this;
		contentEl.empty();
	}
}


type UpdateTask = { uuid: string, name?: string } 
export class UpdateTaskModal extends TWPModal {
	private ctModal: TaskModify | undefined;
    
    private task: UpdateTask
	private inputValue: string;

    constructor(task: UpdateTask, options?: {
		title?: string;
		value?: string;
	}) {
        const plugin = getGlobalContext();
		
		super(plugin.app, plugin);
        this.task = task;
		this.inputValue = options?.value || '';
    }

	onOpen() {
		const {titleEl, contentEl} = this;
		
		this.ctModal = new TaskModify({
			target: contentEl,
			props: {
				close: () => this.close(),
				plugin: this.plugin,
                task: this.task,
				inputValue: this.inputValue,
				titleElement: titleEl
			}
		})
	}

	onClose() {
		this.ctModal?.$destroy();
		const {contentEl} = this;
		contentEl.empty();
	}
}