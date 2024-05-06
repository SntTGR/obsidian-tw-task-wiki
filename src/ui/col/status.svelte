<script lang="ts">
	import { getIcon } from "obsidian";
	import type { Task } from "src/task-handler";
	import { createEventDispatcher } from "svelte";

    let disabled: boolean = false;
    export let status : Task['status'];

    export let altVersion = false;
    
	function isChecked(e: Event): boolean { return (e.target as any).checked }
    const dispatch = createEventDispatcher();

    function notifyChange(newStatus: Task['status']) {
        dispatch('statusChange', newStatus);
        status = newStatus;
        disabled = true;
    }

</script>


<!-- TODO: figure out performant way of switching between alt versions -->

{#if !altVersion}
    {#if status === 'D'}
        <td class="center-td"> <button class="small-delete-button" on:click={() => notifyChange('P')}>{@html getIcon('undo')?.outerHTML }</button> </td>
    {:else if status === 'R'}
        <td class="center-td"> </td>
    {:else}
        <td class="center-td"> <input class="small-checkbox" type="checkbox" checked={status === 'C'} on:change={e => isChecked(e) ? notifyChange('C') : notifyChange('P')}/> </td>
    {/if}
{:else}
    {#if status === 'D'}
        <td class="center-td"> <button class="small-delete-button" on:click={() => notifyChange('P')}>{@html getIcon('undo')?.outerHTML }</button> </td>
    {:else}
        <td class="center-td"> <button class="small-delete-button" on:click={() => notifyChange('D')}>{@html getIcon('cross')?.outerHTML }</button> </td>
    {/if}
{/if}

<style>

    .small-checkbox {
		margin: 0;
	}

    .small-delete-button {
		padding: 2px;
		margin: 0;

		overflow: hidden;
		
		flex-shrink: 0;
		border-radius: var(--checkbox-radius);
		border: 1px solid var(--checkbox-border-color);
		height: var(--checkbox-size);
		width: var(--checkbox-size);
	}

    .center-td {
		text-align: center;		
	}

</style>