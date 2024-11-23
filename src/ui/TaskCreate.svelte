<script lang="ts">
	import { Notice, getIcon } from 'obsidian';
    import { onMount } from 'svelte';
    import type TWPlugin from 'src/main';
	import { TaskEvents } from 'src/task-handler';
	import { sanitize } from 'src/util';
    import { createHash } from 'crypto';

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

    let inputElement: HTMLTextAreaElement;
    let inputAdjustmentPending: boolean = false;

    let suggestions: string[] = [];
    let suggestionBox: HTMLDivElement;
    let suggestionBoxAdjustmentPending: boolean = false;
    let selectedIndex: number = -1;
    let suggestionEscaped: boolean = false;

    const limitString = (string: string | undefined) => string?.length! > 30 ? string!.substring(0, 30) + '...' : string;
    
    function textToId6(text: string) {
        return createHash('sha1').update(text).digest().readUint8(0) % 6;
    }

    function getSanitizedInput(disableTemplate?: boolean): string {
        return `${sanitize(input || '')}${template && !disableTemplate ? ' ' + sanitize(template) : ''}`
    }
    
    function levenshtein(a: string, b: string): number {
        const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

        for (let i = 0; i <= a.length; i++) {
            matrix[i][0] = i;
        }
        for (let j = 0; j <= b.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                if (a[i - 1] === b[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j - 1] + 1
                    );
                }
            }
        }

        return matrix[a.length][b.length];
    }

    function getSuggestions(incoming: string, all: string[]): string[] {
        return all.map(tag => ({ tag, distance: levenshtein(tag, incoming) }))
            .sort((a, b) => a.distance - b.distance)
            .map(({ tag }) => tag)
            .slice(0, 10);
    }

    function applySuggestions() {
        if (selectedIndex !== -1 && suggestions.length > 0) {
            const cursor = inputElement.selectionStart;
            let start = cursor;
            let end = cursor;

            while (start > 0 && input[start - 1] !== ' ' && input[start - 1] !== '\n') {
                start--;
            }

            while (end < input.length && input[end] !== ' ' && input[end] !== '\n') {
                end++;
            }

            const word = input.substring(start, cursor);

            let endPos = end;
            if (word.startsWith('+')) {
                input = input.substring(0, start) + '+' + suggestions[selectedIndex] + input.substring(end);
                endPos = start + suggestions[selectedIndex].length + 1;
            } else if (word.startsWith('project:')) {
                input = input.substring(0, start) + 'project:' + suggestions[selectedIndex] + input.substring(end);
                endPos = start + suggestions[selectedIndex].length + 8;
            }
            
            inputElement.value = input;
            inputElement.selectionStart = endPos;
            inputElement.selectionEnd = endPos;
            inputElement.focus();

            selectedIndex = -1;
            suggestionEscaped = true;
        }
    }

    let cachedTags: string[] | undefined = [];
    let cachedTagsTime: number = 0;
    
    async function getTagSuggestions(incoming: string) {        
        if (cachedTags === undefined || Date.now() - cachedTagsTime > 1000 * 60) {
            const res = await plugin.handler!.getTags();
            cachedTagsTime = Date.now();
            if (res.isErr()) {
                new Notice(`Error getting tags: ${res.error}`);
                return;
            }
            cachedTags = res.value;
        }

        suggestions = getSuggestions(incoming, cachedTags);
        recalculateSuggestionBox();
    }

    let cachedProjects: string[] | undefined = [];
    let cachedProjectsTime: number = 0;

    async function getProjectSuggestions(incoming: string) {
        if (cachedProjects === undefined || Date.now() - cachedProjectsTime > 1000 * 60) {
            const res = await plugin.handler!.getProjects();
            cachedProjectsTime = Date.now();
            if (res.isErr()) {
                new Notice(`Error getting projects: ${res.error}`);
                return;
            }
            cachedProjects = res.value;
        }
        
        const res = await plugin.handler!.getProjects();
        if (res.isErr()) {
            new Notice(`Error getting projects: ${res.error}`);
            return;
        }
        
        suggestions = getSuggestions(incoming, res.value);
        recalculateSuggestionBox();
    }
    
    async function createTask(cmd: string) {
        state = 'loading';

        await plugin.handler!.createTask(cmd).match(
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

    function recalculateSuggestionBox(node?: HTMLDivElement) {
        if (suggestions.length === 0) return;
        let targetNode = node ?? suggestionBox;
        if (!targetNode) return;
        
        // Position below cursor
        const cursor = inputElement.selectionStart;
        const textBeforeCursor = inputElement.value.substring(0, cursor);
        const textAfterCursor = inputElement.value.substring(cursor);

        // mirrored div
        const mirror = document.createElement('div');
        // copy style from input
        const style = getComputedStyle(inputElement);
        for (let i = 0; i < style.length; i++) {
            // @ts-ignore
            mirror.style[style[i]] = style[style[i]];
        }

        const pre = document.createTextNode(textBeforeCursor);
        const post = document.createTextNode(textAfterCursor);
        const caretEl = document.createElement('span');
        caretEl.innerHTML = '&nbsp;';

        mirror.innerHTML = '';
        mirror.append(pre, caretEl, post);

        document.body.append(mirror);

        const rect = caretEl.getBoundingClientRect();
        const rect2 = mirror.getBoundingClientRect();
        const inputElementRect = inputElement.getBoundingClientRect();

        document.body.removeChild(mirror);

        // Add one more line height to the top
        const textInputLineHeight = inputElement.clientHeight;

        targetNode.style.top = `${inputElementRect.y + rect.y - rect2.y + textInputLineHeight}px`;
        targetNode.style.left = `${inputElementRect.x + rect.x - rect2.x}px`;

        suggestionBoxAdjustmentPending = false;
    }

</script>

<div role="textbox">    
    
    <textarea bind:this={inputElement} class="command-input" use:autoFocus tabindex="0" id="create-command" 
        on:keyup={(e) => {
            // if modifier key ctrl is not pressed also
            if (e.key === 'Enter' && readyToCreate && e.shiftKey === false) {
                if (selectedIndex !== -1 && suggestions.length > 0 && !suggestionEscaped) {
                    applySuggestions();
                } else if (lastCreatedUuid !== undefined && e.ctrlKey === true) {
                    modifyTask(getSanitizedInput(true));
                    clearInput();
                } else {
                    createTask(getSanitizedInput());
                    clearInput();
                }
            }
        }}

        on:keydown={(e) => {
            if (e.key === 'ArrowDown') {
                if (suggestions.length > 0 && selectedIndex === -1) {
                    selectedIndex = 0;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                } else if (selectedIndex < suggestions.length - 1 && !suggestionEscaped) {
                    selectedIndex++;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                }
            } else if (e.key === 'ArrowUp') {
                if (selectedIndex > 0 && !suggestionEscaped) {
                    selectedIndex--;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                }
            }
            if (e.key === 'Escape') {
                if (suggestions.length > 0) {
                    suggestionEscaped = true;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                } 
            }

            if (e.key === 'Enter' && e.shiftKey !== true) {
                e.preventDefault();
                e.stopImmediatePropagation();
                e.stopPropagation();
            }

            recalculateSuggestionBox();
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

            // Handle suggestion tag input
            const currentCursor = inputElement.selectionStart;
            let cursor = currentCursor;
            const currentChar = input[currentCursor - 1];
            
            while (cursor > 0 && input[cursor - 1] !== ' ' && input[cursor - 1] !== '\n') {
                cursor--;
            }
            
            const currentWord = input.substring(cursor, currentCursor);
            
            if (currentWord.startsWith('+')) {
                getTagSuggestions(currentWord.substring(1));
            } else if (currentWord.startsWith('project:')) {
                getProjectSuggestions(currentWord.substring(8));
            } else {
                suggestions = [];
            }

            // If new word is started, reset suggestion index and escape flag
            if (currentCursor > 0 && (currentChar === ' ' || currentChar === '\n')) {
                selectedIndex = -1;
                suggestionEscaped = false;
            }

            
            if (!suggestionBoxAdjustmentPending && suggestions.length > 0 && !suggestionEscaped) {
                suggestionBoxAdjustmentPending = true;
                requestAnimationFrame(() => recalculateSuggestionBox());                
            }

        }}
    />

    {#if suggestions.length > 0 && !suggestionEscaped}    
        <div class="suggestions-container" bind:this={suggestionBox} use:recalculateSuggestionBox>
        {#each suggestions as suggestion, i}
            <span class="suggestion {`accent-${textToId6(suggestion)+1}`}" class:selected={i === selectedIndex}> {suggestion} </span>
        {/each}
        </div>
    {/if}

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

    .suggestions-container {
        position: fixed; /* Change to fixed to position relative to the viewport */
        width: 200px;
        overflow-y: auto;
        background: var(--background-secondary-alt);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        z-index: 9999; /* Increase z-index to ensure it appears above the modal */
    }
  
    .suggestion {
        display: block;
        width: 100%;
        font-size: 0.8em;
        padding: 0px;
        padding-left: 10px;
        border: none;
        background: none;
        text-align: left;
        cursor: pointer;
    }
    
    .accent-1 { color: var(--accent-1); background-color: rgba(var(--accent-1-rgb), 0.01); }
    .accent-2 { color: var(--accent-2); background-color: rgba(var(--accent-2-rgb), 0.01); }
    .accent-3 { color: var(--accent-3); background-color: rgba(var(--accent-3-rgb), 0.01); }
    .accent-4 { color: var(--accent-4); background-color: rgba(var(--accent-4-rgb), 0.01); }
    .accent-5 { color: var(--accent-5); background-color: rgba(var(--accent-5-rgb), 0.01); }
    .accent-6 { color: var(--accent-6); background-color: rgba(var(--accent-6-rgb), 0.01); }

    .suggestion:hover {
        background-color: var(--background-primary);
        color: var(--text-accent);
    }
    
    .suggestion.selected {
        background-color: var(--background-primary);
        color: var(--text-accent);
    }

</style>
