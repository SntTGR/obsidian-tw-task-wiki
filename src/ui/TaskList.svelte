<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Report, TaskEvents } from '../task-handler';
	import { getIcon } from 'obsidian'
	import { UpdateTaskModal } from '../modals';
	
	import { format } from 'timeago.js';
	import type TWPlugin from 'src/main';

	export let plugin: TWPlugin;
	export let report: string;
	export let command: string | undefined;

	let state: 'loading' | 'error' | 'ok' = 'loading';
	let reportList: Report;
	let timestamp: number;
	let timestampEl: HTMLElement;

	let refreshButton: HTMLElement;
	
	let formattedAgo: string;
	$: { formatTimestamp(timestamp) }

	function formatTimestamp(timestamp: number) {
		formattedAgo = format(timestamp);
		console.log('blabla');
	}
	
	async function getTasks() {
		state = 'loading';
		
		let result;
		try {
			result = await plugin.handler?.getTasks(report, command);
		} catch (error) {
			state = 'error';
			console.error('Error fetching tasks', error);
			return;
		}

		reportList = result!.report;
		timestamp = result!.timestamp;
		state = 'ok';	
	}

	function isChecked(e: Event): boolean {
		return (e.target as any).checked
	}

	onMount(() => {
		getTasks();
		plugin.emitter?.on(TaskEvents.REFRESH, () => {
			// Set to loading and start a new promise to refresh the internal data
			plugin.handler?.invalidateCache();
			getTasks();
		});
		plugin.emitter?.on(TaskEvents.INTERVAL, () => {
			formatTimestamp(timestamp);
		})
	})

</script>

<div>
	
	<!-- Loader -->
	<div class="loader">
		<div>
			<span class="unimportant">{ report + ' ' + command }</span>
		</div>
		<div class="refresh-container">
			{#if state === 'ok' }<span class="report unimportant">updated { formattedAgo }</span>{/if}
			{#if state === 'error'}<span class="report unimportant error">error fetching tasks</span>{/if}
			{#if state === 'loading'}<span class="report unimportant">loading...</span> {/if}
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
								<th>{pColumns}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each reportList.tasks as task}
							<tr>
								<td> <input type="checkbox" checked={task.status === 'Completed'} on:change={e => isChecked(e) ? plugin.handler?.completeTask(task.uuid) : plugin.handler?.undoTask(task.uuid)} /> </td>
								{#each task.data as data}
									<td on:click={ () => { new UpdateTaskModal(plugin.app, plugin, { uuid: task.uuid }).open() } }>{data}</td>
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

	.padder {
		padding: 8px;
	}

	.error {
		color: lightcoral;
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


	.tw-table input {
		margin: 0;
	}

	.refresh-button {
		cursor: pointer;
	}
	.refresh-button:hover {
		text-decoration: underline;
	}
	
</style>
