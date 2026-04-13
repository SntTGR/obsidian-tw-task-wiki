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
	event.preventDefault();

	const menu = new Menu();

	if (plugin.settings.tasknote_right_click_enabled) {
		menu.addItem((item) =>
			item
				.setTitle('Open task note')
				.setIcon('file-text')
				.onClick(() => plugin.openTaskNote(taskUuid))
		);
	}

	if (plugin.settings.right_click_context_menu_enabled) {
		for (const action of plugin.settings.right_click_context_menu_actions.values()) {
			menu.addItem((item) =>
				item
				.setTitle(action.ActionName)
				.setIcon("documents")
				.onClick(() => {
					runCommandOnTask(taskUuid, action.Action, plugin)
				})
			);
		}
	}

	menu.showAtMouseEvent(event);
}