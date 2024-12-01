<script lang="ts">
	import { Notice, getIcon } from 'obsidian';
    import type TWPlugin from 'src/main';
	import { TaskEvents } from 'src/task-handler';
	import { sanitize, shortUuid, type SuggestionPatterns } from 'src/util';
    import { onDestroy, onMount } from 'svelte';
	import SuggestionTextArea from './components/SuggestionTextArea.svelte';

    export let close: () => void;
	export let plugin: TWPlugin;
    export let task: { uuid: string, taskName?: string }
    export let titleElement: HTMLElement;
    export let inputValue: string | undefined;
    
    let state: 'loading' | 'error' | 'ok' = 'ok';

    let input: string;
    let displayedCommand: string = `task modify ${shortUuid(task.uuid)}`;
    let displayedCommandPending: boolean = false;

    let details: string | undefined = undefined;
    let detailElement: HTMLParagraphElement;

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
            },
            (err) => {
                state = 'error';
                new Notice(`Could not modify task ${shortUuid(task.uuid)}!: ${err}`, 5000);
            }
        );
        clearInput();
    }

    function calculateDetailCharacterWidth() {
        const container = detailElement;
        const measureChar = document.createElement('span');
        measureChar.style.fontFamily = 'monospace';
        measureChar.style.fontSize = '1em';
        measureChar.style.visibility = 'hidden';
        measureChar.textContent = 'X';

        container.appendChild(measureChar);
        const charWidth = measureChar.getBoundingClientRect().width;
        const containerWidth = container.getBoundingClientRect().width;
        container.removeChild(measureChar);

        return Math.floor(containerWidth / charWidth);
    }

    async function fetchDetails() {
        const result = await plugin.handler!.getTaskDetails(task.uuid, calculateDetailCharacterWidth())
        if (result.isOk()) {
            details = result.value;
        }        
    }

    onMount(() => {
        titleElement.setText(`Modify task ${task.taskName || shortUuid(task.uuid)}`);
        input = inputValue || '';
        displayedCommand = `task modify ${shortUuid(task.uuid)} ${getSanitizedInput()}`;
        fetchDetails();
        plugin.emitter!.on(TaskEvents.REFRESH, fetchDetails);
    });

    onDestroy(() => {
        plugin.emitter!.off(TaskEvents.REFRESH, fetchDetails);
    });

    async function copyToClipboard(c: string) {        
        await navigator.clipboard.writeText(c);
        new Notice('Copied to clipboard');
    }

    async function deleteTask() {
        const result = await plugin.handler?.deleteTask(task.uuid);
        if (result?.isOk) close();
    }

    const patterns: SuggestionPatterns = [
        { pattern: '-',         getList: async (_s : string) => plugin.handler!.getTaskTagsSuggestions(task.uuid) }, // TODO:
        { pattern: '+',         getList: async (_s: string) => plugin.handler!.getTagSuggestions() },
        { pattern: 'project:',  getList: async (_s:string) => plugin.handler!.getProjectSuggestions() },
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

    <div>
        <p bind:this={detailElement} class="details">{details ? details : 'Fetching...'}</p>
    </div>

    <div class="actions-container">
        <div style="display: flex;">
            <button class="action-button-error" disabled={state === 'loading'} on:click={deleteTask}> {@html getIcon('trash')?.outerHTML} </button>
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

    .details {
        font-family: monospace;
        font-size: 1em;
        line-height: 0.9;
        width: 100%;
        color: var(--text-muted);
        text-wrap: nowrap;
        overflow: hidden;
        user-select: text;
        -webkit-user-select: text;
        white-space: pre;
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
