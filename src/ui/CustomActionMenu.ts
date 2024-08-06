import { Menu, Notice } from 'obsidian'
import { TaskEvents } from '../task-handler';
import type TWPlugin from 'src/main';

function runCommandOnTask(taskUuid: string, command: string, plugin: TWPlugin) {
	plugin.handler!.modifyTask(taskUuid, command).then(() => {
			new Notice(`Task ${taskUuid} modified.`);
			plugin.emitter!.emit(TaskEvents.REFRESH);
	}).catch(() => {
			new Notice(`Could not modify task ${taskUuid}!`, 5000);
	})
}

export function showActionMenu(taskUuid: string, event: MouseEvent, plugin: TWPlugin) {

	if(!plugin.settings.right_click_context_menu_enabled) {
		//Ideally the template in the TaskList should'nt add anything to oncontext menu if this feature is disabled
		//But adding if statement in the TaskList.svelte would made everything much more complicated
		return
	}

	const menu = new Menu();

	for (const [_, action] of plugin.settings.right_click_context_menu_actions.entries()) {
		menu.addItem((item) =>
			item
			.setTitle(action.ActionName)
			.setIcon("documents")
			.onClick(() => {
				runCommandOnTask(taskUuid, action.Action, plugin)
			})
		);
	}

	menu.showAtMouseEvent(event);
}