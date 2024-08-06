<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Report, Task, TaskEvents } from '../task-handler';
	import { getIcon } from 'obsidian'
	import { CreateTaskModal, UpdateTaskModal } from '../modals';
	import { showActionMenu }  from './CustomActionMenu';

	import Status from './col/status.svelte';
	
	import { format } from 'timeago.js';
	import type TWPlugin from 'src/main';
	import Tags from './col/tags.svelte';
	import Urgency from './col/urgency.svelte';

	export let plugin: TWPlugin;
	
	export let report: string;
	export let sanitizedReport: string;
	
	export let command: string | undefined;
	export let sanitizedCommand: string | undefined;
	
	export let newTaskTemplate: string | undefined;

	let state: 'loading' | 'error' | 'ok' = 'loading';
	let reportList: Omit<Report, 'tasks'> & { tasks: Array<Report['tasks'][number] & {disabled?: true}> };
	let timestamp: number;
	let deleteKeyDown: boolean = false;

	let refreshButton: HTMLElement;
	
	let formattedAgo: string;
	$: { formatTimestamp(timestamp) }

	function formatTimestamp(timestamp: number) { formattedAgo = format(timestamp); }

	async function getTasks() {
		state = 'loading';
		
		let result;
		try {
			result = await plugin.handler?.getTasks(sanitizedReport, sanitizedCommand);
		} catch (error) {
			state = 'error';
			plugin.logger!.debug_log('Error fetching tasks', error);
			return;
		}
		
		reportList = result!.report;
		timestamp = result!.timestamp;
		state = 'ok';	
	}

	function isChecked(e: Event): boolean { return (e.target as any).checked }

	function onDeleteKeyDown() { deleteKeyDown = true; }
	function onDeleteKeyUp() { deleteKeyDown = false; }

	async function handleStatusChange(uuid: string, e: Event & { detail: Task['status'] }) {
		switch (e.detail) {
			case 'C': await plugin.handler?.completeTask(uuid); break;
			case 'D': await plugin.handler?.deleteTask(uuid); break;
			case 'P': await plugin.handler?.modifyTask(uuid, 'status:pending'); break;
			case 'R': await plugin.handler?.modifyTask(uuid, 'status:recurring'); break;
			default: break;
		}
	}

	const refreshCallback = () => { getTasks(); }
	const intervalCallback = () => { formatTimestamp(timestamp); }

	onMount(() => {
		getTasks();
		plugin.emitter?.on(TaskEvents.REFRESH, refreshCallback);
		plugin.emitter?.on(TaskEvents.INTERVAL, intervalCallback);
	})

	onDestroy(() => {
		plugin.emitter?.off(TaskEvents.REFRESH, refreshCallback);
		plugin.emitter?.off(TaskEvents.INTERVAL, intervalCallback);
	})

</script>

<svelte:window on:keydown={e => e.key === plugin.settings.delete_key  && onDeleteKeyDown()} on:keyup={e => e.key === plugin.settings.delete_key && onDeleteKeyUp()}/>

<div>

	<!-- Loader -->
	<div class="loader">
		<div class="refresh-container">
			{#if newTaskTemplate}				
				<button on:click={() => new CreateTaskModal(plugin.app, plugin, newTaskTemplate).open()} >{@html getIcon('plus')?.outerHTML }</button>
			{/if}
			<span class="unimportant padding-horizontal">{ report + ' ' + command }</span>
		</div>
		<div class="refresh-container">
			{#if state === 'ok' }<span class="report unimportant padding-horizontal">updated { formattedAgo }</span>{/if}
			{#if state === 'error'}<span class="report unimportant error padding-horizontal">error fetching tasks</span>{/if}
			{#if state === 'loading'}<span class="report unimportant padding-horizontal">loading...</span> {/if}
			<button class="refresh-button" on:click={getTasks} bind:this={refreshButton}>{@html getIcon('rotate-cw')?.outerHTML }</button>
		</div>
	</div>

	<div class="data">
		{#if reportList !== undefined}
			{#if reportList.columns.length <= 2}
				<div class="padder error"><span>Report does not seem to exist.</span></div>
			{:else if reportList.tasks.length === 0}
				<div class="padder error"><span>No tasks found in report.</span></div>
			{:else}
				<table class="tw-table">
					<thead>
						<tr>
							<th></th>
							{#each reportList.printedColumns as pColumns}
								<th>{pColumns.label}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each reportList.tasks as task, tIndex (task.uuid)}
							<tr class:row-disabled={task.disabled} class="task-hover" on:contextmenu={ (event) => showActionMenu(task.uuid, event, plugin)} >
								<Status disabled={task.disabled} status={task.status} altVersion={deleteKeyDown} on:statusChange={(e) => {handleStatusChange(task.uuid, e); task.disabled = true}}/>
								{#each task.data as data, dIndex}
									{#if reportList.printedColumns[dIndex].type === 'tags'}
										<Tags tags={data}/>
									{:else if reportList.printedColumns[dIndex].type === 'urgency'}
										<Urgency urgency={data}/>
									{:else}
										<td on:click={ () => { new UpdateTaskModal(plugin.app, plugin, { uuid: task.uuid }).open() } } >{data}</td>
									{/if}
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{/if}
	</div>
</div>

<style>
	.loader {
		padding: 4px;
		
		display: flex;
		justify-content: space-between;
		align-items: center;

		background-color: #00000034;
	}

	.task-hover:hover {
		background-color: var(--table-selection);
	}
	
	.padding-horizontal {
		padding-left: 1em;
		padding-right: 1em;
	}

	.padder {
		padding: 8px;
	}

	.error {
		color: lightcoral;
	}

	.row-disabled {
		text-decoration: line-through;
		color: var(--color-base-50);
	}

	.unimportant {
		color: var(--color-comment);
		font-size: var(--font-smallest);
	}

	.refresh-container {
		display: flex;
		align-items: center;
	}

	.report {
		padding-left: 4px;
		padding-right: 4px;
	}

	.data {
		overflow-x: auto;
		min-width: none;
	}
	.tw-table {
		width: 100%;
		border-collapse: collapse;
		

		margin: 0;
		border: 0;
	}
	.tw-table th, .tw-table td {
		min-width: 1ch !important;
		font-size: var(--font-smaller);
	}

	.refresh-button {
		cursor: pointer;
	}
	.refresh-button:hover {
		text-decoration: underline;
	}
	
</style>
