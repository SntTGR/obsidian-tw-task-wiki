import { App, Modal } from "obsidian";
import TaskCreate from "./ui/TaskCreate.svelte";
import TaskModify from './ui/TaskModify.svelte';
import TWPlugin from './main';

class TWPModal extends Modal {
    plugin: TWPlugin;
    
    constructor(app: App, plugin: TWPlugin) {
        super(app);
        this.plugin = plugin;
    }
}

export class CreateTaskModal extends TWPModal {
	private ctModal: TaskCreate | undefined;

	onOpen() {
		const {titleEl, contentEl} = this;
		this.ctModal = new TaskCreate({
			target: contentEl,
			props: {
				close: () => this.close(),
				plugin: this.plugin,
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


type UpdateTask = { uuid: string, name?: string } 
export class UpdateTaskModal extends TWPModal {
	private ctModal: TaskCreate | undefined;
    
    
    private task: UpdateTask

    constructor(app: App, plugin: TWPlugin, task: UpdateTask) {
        super(app, plugin);
        this.task = task;
    }

	onOpen() {
		const {titleEl, contentEl} = this;
		
		this.ctModal = new TaskModify({
			target: contentEl,
			props: {
				close: () => this.close(),
				plugin: this.plugin,
                task: this.task,
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