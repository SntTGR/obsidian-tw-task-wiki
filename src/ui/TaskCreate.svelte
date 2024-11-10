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
    let sanitizedInput: string;

    let displayedCommand: string = 'task add';
    let displayedCommandPending: boolean = false;

    let lastCreatedUuid: string | undefined = undefined;
    let createdUuids: Array<{ uuid: string, description?: string }> = [];
    
    let readyToCreate: boolean = false;
    $: { readyToCreate = state !== 'loading' && input !== undefined && input !== '' }

    let inputElement: HTMLTextAreaElement;
    let inputAdjustmentPending: boolean = false;

    const limitString = (string: string | undefined) => string?.length! > 30 ? string!.substring(0, 30) + '...' : string;
    
    function getSanitizedInput(disableTemplate?: boolean): string {
        return `${sanitize(input || '')}${template && !disableTemplate ? ' ' + sanitize(template) : ''}`
    }

    async function createTask(cmd: string) {
        state = 'loading';

        await plugin.handler!.createTask(sanitizedInput).match(
            (v) => {
                new Notice(`Task ${v.split('-', 1)[0]} created.`);
                lastCreatedUuid = v;
                createdUuids.push({ uuid: v, description: cmd });
                plugin.emitter!.emit(TaskEvents.REFRESH);
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
                new Notice(`Task ${lastCreatedUuid!.split('-', 1)[0]} modified.`);
                createdUuids[createdUuids.findIndex((e) => e.uuid === lastCreatedUuid)]['description'] = cmd;
                plugin.emitter!.emit(TaskEvents.REFRESH);
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
                new Notice(`Task ${uuid.split('-', 1)[0]} deleted.`);
                createdUuids = createdUuids.filter((e) => e.uuid !== uuid);
                if (lastCreatedUuid === uuid) lastCreatedUuid = undefined;
                plugin.emitter!.emit(TaskEvents.REFRESH);
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
    });

    function autoFocus(node: HTMLElement) {
        node.focus();
    }

    function closeModal() {
        close();
    }

    function adjustInputHeight() {
        inputElement.style.height = '1.5em';
        inputElement.style.height = (inputElement.scrollHeight) + 'px';
        inputAdjustmentPending = false;
    }
    
    function clearInput() {
        inputElement.value = '';
    }

    async function copyToClipboard(c: string) {        
        await navigator.clipboard.writeText(c);
        new Notice('Copied to clipboard');
    }

</script>

<div role="textbox">    
    
    <textarea bind:this={inputElement} class="command-input" use:autoFocus tabindex="0" id="create-command" 
        on:keyup={(e) => {
            // if modifier key ctrl is not pressed also
            if (e.key === 'Enter' && readyToCreate && e.shiftKey === false) {
                if (lastCreatedUuid !== undefined && e.ctrlKey === true) {
                    modifyTask(getSanitizedInput(true));
                    clearInput();
                } else {
                    createTask(getSanitizedInput());
                    clearInput();
                }
            }
        }}
        bind:value={input} placeholder="My new task priority:L"
        on:input={() => {
            if (!inputAdjustmentPending) {
                inputAdjustmentPending = true;
                requestAnimationFrame(adjustInputHeight);
            }
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
                <button class="uuid-text" class:task-selected={uuid === lastCreatedUuid} on:click={() => {selectTask(uuid)}}> {@html getIcon(uuid === lastCreatedUuid ? 'square-mouse-pointer': 'square-dashed-mouse-pointer')?.outerHTML} <pre> </pre> { limitString(description) } </button>
                <button class="uuid-text push-right" on:click={() => {copyToClipboard(uuid)}}> {uuid.split('-', 1)[0]} <pre> </pre> {@html getIcon('copy')?.outerHTML} </button>
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

    .command-input {
        width: 100%;
        height: 1.9em;
        resize: none;
        overflow-y: hidden;
        box-sizing: border-box;
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
