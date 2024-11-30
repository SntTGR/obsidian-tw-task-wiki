<script lang="ts">
	import { Notice, getIcon } from 'obsidian';
    import type TWPlugin from 'src/main';
	import { TaskEvents } from 'src/task-handler';
	import { sanitize, shortUuid, type SuggestionPatterns } from 'src/util';
    import { onMount } from 'svelte';
	import SuggestionTextArea from './components/SuggestionTextArea.svelte';

	export let plugin: TWPlugin;
    export let task: { uuid: string, taskName?: string }
    export let titleElement: HTMLElement;
    export let inputValue: string | undefined;
    
    let state: 'loading' | 'error' | 'ok' = 'ok';

    let input: string;
    let displayedCommand: string = `task modify ${shortUuid(task.uuid)}`;
    let displayedCommandPending: boolean = false;

    let readyToModify: boolean;
    $: { readyToModify = state !== 'loading' && input !== undefined && input !== ''}
    
    function getSanitizedInput(): string {
        return `${sanitize(input || '')}`
    }

    function clearInput() {
        input = '';
    }

    async function modifyTask(cmd: string) {
        state = 'loading';
        (await plugin.handler!.modifyTask(task.uuid, cmd)).match(
            (_) => {
                state = 'ok';
                new Notice(`Task ${shortUuid(task.uuid)} modified.`);
                plugin.emitter!.emit(TaskEvents.REFRESH);
            },
            (err) => {
                state = 'error';
                new Notice(`Could not modify task ${shortUuid(task.uuid)}!: ${err}`, 5000);
            }
        );
        clearInput();
    }

    onMount(() => {
        titleElement.setText(`Modify task ${task.taskName || shortUuid(task.uuid)}`);
        input = inputValue || '';
    });

    async function copyToClipboard(c: string) {        
        await navigator.clipboard.writeText(c);
        new Notice('Copied to clipboard');
    }

    const patterns: SuggestionPatterns = [
        { pattern: '-', getList: async (_s : string) => [] }, // TODO:
        { pattern: '+', getList: plugin.handler!.getTagSuggestions },
        { pattern: 'project:', getList: plugin.handler!.getProjectSuggestions },
    ];

</script>

<div>

    <SuggestionTextArea

        bind:value={input}
        patterns={patterns}
        
        autofocus={true}
        placeholder="due:tomorrow"
    
        on:keyup={(e) => {
            if (e.key === 'Enter' && readyToModify && !e.shiftKey) {
                modifyTask(getSanitizedInput());
                e.preventDefault();
            }
        }}

        on:keydown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
        }}

        on:input={() => {
            if (!displayedCommandPending) {
                displayedCommandPending = true;
                requestAnimationFrame(() => {
                    displayedCommand = `task modify ${shortUuid(task.uuid)} ${getSanitizedInput()}`;
                    displayedCommandPending = false;
                });
            }
        }}
    
    />

    <p class="command" id="command-to-run">{ displayedCommand }</p>

    <div class="actions-container">
        <div style="display: flex;">
            <button class="action-button-error" disabled={state === 'loading'} on:click={() => {}}> {@html getIcon('trash')?.outerHTML} </button>
        </div>
        <div style="display: flex; margin-left: auto;">
            <button class="uuid-text action-button" on:click={() => copyToClipboard(task.uuid)}>{shortUuid(task.uuid)}<pre> </pre> {@html getIcon('copy')?.outerHTML} </button>
            <button class="action-button" disabled={!readyToModify} on:click={() => modifyTask(getSanitizedInput())}>Modify</button>
        </div>
    </div>
</div>

<style>

    .actions-container {
        display: flex;
    }

    .action-button {
        margin-left: 5px;
        margin-right: 5px;
    }

    .action-button-error {
        margin-left: 5px;
        margin-right: 5px;
        color: var(--text-error);
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
