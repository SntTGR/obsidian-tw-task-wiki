<script lang="ts">
	import { Notice, getIcon } from 'obsidian';
    import type TWPlugin from 'src/main';
	import { TaskEvents } from 'src/task-handler';
	import { sanitize } from 'src/util';
    import { onMount } from 'svelte';

	export let plugin: TWPlugin;
    export let task: { uuid: string, taskName?: string }
    export let titleElement: HTMLElement;
    
    export let close: () => void;
    let state: 'loading' | 'error' | 'ok' = 'ok';

    let input: string;
    let sanitizedInput: string;
    $: { sanitizedInput = sanitize(input || '') }
    let command: string;
    $: { command = `task ${task.uuid} modify ${sanitizedInput}`; }

    let readyToModify: boolean;
    $: { readyToModify = state !== 'loading' && input !== undefined && input !== ''}
    
    async function modifyTask(cmd: string) {
        state = 'loading';
        (await plugin.handler!.modifyTask(task.uuid, cmd)).match(
            (v) => {
                state = 'ok';
                new Notice(`Task ${task.uuid} modified.`);
                plugin.emitter!.emit(TaskEvents.REFRESH);
            },
            (err) => {
                state = 'error';
                new Notice(`Could not modify task ${task.uuid}!`, 5000);
            }
        );
        
        close();
    }

    onMount(() => {
        titleElement.setText(`Modify task ${task.taskName || task.uuid}`);
    });

    function autoFocus(node: HTMLElement) {
        node.focus();
    }

    async function copyToClipboard(c: string) {        
        await navigator.clipboard.writeText(c);
        new Notice('Copied to clipboard');
    }

</script>

<div>
    <label for="modify-command">Name and modifiers</label>
    <input use:autoFocus tabindex="0" on:keyup={(e) => e.key === 'Enter' && readyToModify && modifyTask(sanitizedInput)} id="modify-command" type="text" bind:value={input} placeholder="{ task.taskName ? task.taskName : 'My Task' } due:tomorrow" />
    <p class="command" id="command-to-run">{command}</p>

    <div class="actions-container">
        <button class="uuid-text" on:click={() => copyToClipboard(task.uuid)}> UUID: {task.uuid} <pre> </pre> {@html getIcon('copy')?.outerHTML} </button>
        <button class="action-button" disabled={!readyToModify} on:click={() => modifyTask(sanitizedInput)}>Modify</button>
    </div>
</div>

<style>

    .actions-container {
        display: flex;
    }

    .action-button {
        margin-left: auto;
    }

    .command {
        font-family: monospace;
        font-size: 0.8em;
        color: var(--text-muted);
    }

    .uuid-text {
        font-size: 0.8em;
        color: var(--text-muted);
        background-color: var(--background-secondary-alt);
    }

</style>
