<script lang="ts">
	import { Notice, getIcon } from 'obsidian';
    import { onMount } from 'svelte';
    import type TWPlugin from 'src/main';
	import { TaskEvents } from 'src/task-handler';
	import { sanitize } from 'src/util';

	export let plugin: TWPlugin;
    export let titleElement: HTMLElement;
    export let template: string | undefined;
    export let close: () => void;

    let state: 'loading' | 'error' | 'ok' = 'ok';
    
    let input: string;
    let command: string;
    $: { command = `task add ${trueInput}`; }
    let trueInput: string;
    $: { trueInput = `${sanitize(input || '')}${template ? ' ' + sanitize(template) : ''}`}

    let createdUuid: string | undefined = undefined;
    
    let readyToCreate: boolean = false;
    $: { readyToCreate = state !== 'loading' && input !== undefined && input !== '' }

    async function createTask(cmd: string) {
        state = 'loading';
        await plugin.handler!.createTask(cmd).match(
            (v) => {
                new Notice(`Task ${v} created.`);
                createdUuid = v;
                plugin.emitter!.emit(TaskEvents.REFRESH);
            },
            (err) => {
                new Notice(`Error creating task: ${err}`);
                state = 'error';
            }
        );
    }

    onMount(() => {
        titleElement.setText('Create New Task');
    });

    function autoFocus(node: HTMLElement) {
        console.log('trying to focus', node);
        node.focus();
    }

    function closeModal() {
        close();
    }

    async function copyToClipboard(c: string) {        
        await navigator.clipboard.writeText(c);
        new Notice('Copied to clipboard');
    }

</script>

<div role="textbox">
    <label for="create-command">Name and modifiers</label>
    <input use:autoFocus tabindex="0" id="create-command" on:keyup={(e) => e.key === 'Enter' && readyToCreate && createTask(trueInput)} type="text" bind:value={input} placeholder="My new task priority:L" />
    <p class="command" id="command-to-run">{command}</p>

    <!-- Hidden if no UUID created -->
    <div class="actions-container">
        <button class="uuid-text" class:hidden={!createdUuid} on:click={() => copyToClipboard(createdUuid || '')}> UUID: {createdUuid} <pre> </pre> {@html getIcon('copy')?.outerHTML} </button>
        <button class="action-button" disabled={!readyToCreate} on:click={() => createTask(trueInput)}>Create</button>
    </div>

</div>

<style>

    .hidden {
        display: none;
    }

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
