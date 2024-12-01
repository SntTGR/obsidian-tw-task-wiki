<script lang="ts">
	import { Notice, getIcon } from 'obsidian';
    import { onMount } from 'svelte';
    import type TWPlugin from 'src/main';
	import { TaskEvents } from 'src/task-handler';
	import { limitString, sanitize, shortUuid, type SuggestionPatterns } from 'src/util';
    import SuggestionTextArea from 'src/ui/components/SuggestionTextArea.svelte';

	export let plugin: TWPlugin;
    export let titleElement: HTMLElement;
    export let template: string | undefined;
    export let close: () => void;

    let state: 'loading' | 'error' | 'ok' = 'ok';
    
    let input: string;

    let displayedCommand: string = 'task add';
    let displayedCommandPending: boolean = false;

    let lastCreatedUuid: string | undefined = undefined;
    let createdUuids: Array<{ uuid: string, description?: string }> = [];
    
    let readyToCreate: boolean = false;
    $: { readyToCreate = state !== 'loading' && input !== undefined && input !== '' }
    function getSanitizedInput(disableTemplate?: boolean): string {
        return `${sanitize(input || '')}${template && !disableTemplate ? ' ' + sanitize(template) : ''}`
    }
    
    function clearInput() {
        input = '';
    }
    
    async function createTask(cmd: string) {
        state = 'loading';

        await plugin.handler!.createTask(cmd).match(
            (v) => {
                new Notice(`Task ${shortUuid(v)} created.`);
                lastCreatedUuid = v;
                createdUuids.push({ uuid: v, description: cmd });
            },
            (err) => {
                new Notice(`Error creating task: ${err}`);
                state = 'error';
            }
        );
        state = 'ok';
    }

    async function modifyTask(cmd: string) {
        state = 'loading';

        if (!lastCreatedUuid) {
            new Notice('No UUID created yet.');
            state = 'error';
            return;
        }
    
        (await plugin.handler!.modifyTask(lastCreatedUuid, cmd)).match(
            (_) => {
                new Notice(`Task ${shortUuid(lastCreatedUuid!)} modified.`);
                createdUuids[createdUuids.findIndex((e) => e.uuid === lastCreatedUuid)]['description'] = cmd;
            },
            (err) => {
                new Notice(`Error modifying task: ${err}`);
                state = 'error';
            }
        );
        state = 'ok';
    }

    async function deleteTask(uuid: string) {
        state = 'loading';
        (await plugin.handler!.deleteTask(uuid)).match(
            (_) => {
                new Notice(`Task ${shortUuid(uuid)} deleted.`);
                createdUuids = createdUuids.filter((e) => e.uuid !== uuid);
                if (lastCreatedUuid === uuid) lastCreatedUuid = undefined;
            },
            (err) => {
                new Notice(`Error deleting task: ${err}`);
                state = 'error';
            }
        );
        state = 'ok';
    }

    async function selectTask(uuid: string) {
        lastCreatedUuid = uuid;
    }

    onMount(() => {
        titleElement.setText('Create New Tasks');
        input = '';
        displayedCommand = `task add ${getSanitizedInput()}`;
    });

    function closeModal() {
        close();
    }

    async function copyToClipboard(c: string) {        
        await navigator.clipboard.writeText(c);
        new Notice('Copied to clipboard');
    }

    function handleKeyUp(e: any) {
        const te = e as KeyboardEvent
        if (te.key === "Enter" && readyToCreate && te.shiftKey === false) {
            if (lastCreatedUuid !== undefined && te.ctrlKey === true) {
                modifyTask(getSanitizedInput(true));
                e.preventDefault();
                e.stopPropagation();
                clearInput();
            } else {
                createTask(getSanitizedInput());
                e.preventDefault();
                e.stopPropagation();
                clearInput();
            }
        }
    }

    function handleKeyDown(e: any) {
        const te = e as KeyboardEvent
        if (te.key === "Enter" && te.shiftKey === false) e.preventDefault();
    }

    const patterns: SuggestionPatterns = [
        { pattern: '+', getList: async (_s: string) => plugin.handler!.getTagSuggestions() },
        { pattern: 'project:', getList: async (_s:string) => plugin.handler!.getProjectSuggestions() },
    ]

</script>

<div role="textbox">    
    
    <SuggestionTextArea 
        bind:value={input} 
        patterns={patterns}
        
        autofocus={true}
        placeholder="My new task priority:L"

        on:keyup={handleKeyUp}
        on:keydown={handleKeyDown}

        on:input={() => {
            if (!displayedCommandPending) {
				displayedCommandPending = true;
				requestAnimationFrame(() => {
					displayedCommand = `task add ${getSanitizedInput()}`;
					displayedCommandPending = false;
				});
			}
        }}
    />

    <p class="command" id="command-to-run">{ displayedCommand }</p>

    <div style="width:100%; margin-bottom:15px">
        {#each createdUuids as { uuid, description }, i}
            <div style="display: flex; margin-top: 5px; margin-bottom: 5px">
                <button class="uuid-text" class:task-selected={uuid === lastCreatedUuid} on:click={() => {selectTask(uuid)}}> {@html getIcon(uuid === lastCreatedUuid ? 'square-mouse-pointer': 'square-dashed-mouse-pointer')?.outerHTML} <pre> </pre> { limitString(description ?? '') } </button>
                <button class="uuid-text push-right" on:click={() => {copyToClipboard(uuid)}}> {shortUuid(uuid)} <pre> </pre> {@html getIcon('copy')?.outerHTML} </button>
                <button class="delete-button" on:click={() => deleteTask(uuid)}>{@html getIcon('trash')?.outerHTML}</button>
            </div>
        {/each}
    </div>
    

    <div class="actions-container">
        <div style="display: flex; margin-left: auto;">
            <button class="action-button" disabled={!readyToCreate || !lastCreatedUuid} on:click={() => {modifyTask(getSanitizedInput(false)); clearInput();}}>Modify</button>
            <button class="action-button" disabled={!readyToCreate} on:click={() => {createTask(getSanitizedInput()); clearInput();}}>Create</button>
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

    .delete-button {
        margin-left: 5px;
        margin-right: 5px;
        color: var(--text-error);
    }

    .command {
        font-family: monospace;
        font-size: 0.8em;
        color: var(--text-muted);
        word-break: break-all;
        white-space: normal;
    }

    .uuid-text {
        font-size: 0.8em;
        color: var(--text-muted);
        background-color: var(--background-secondary-alt);
    }

    .task-selected {
        color: var(--text-accent);
    }

    .push-right {
        margin-left: auto;
    }

</style>
