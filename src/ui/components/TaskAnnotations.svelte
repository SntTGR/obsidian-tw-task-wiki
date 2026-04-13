<script lang="ts" context="module">
    export interface Annotation {
        date: string;
        content: string;
    }
</script>

<script lang="ts">
    import { Notice, getIcon } from 'obsidian';
    import AnnotationContent from './AnnotationContent.svelte';
    import { getGlobalContext } from '../../util';

    export let annotations: Annotation[];
    export let taskUuid: string;
    export let close: (() => void) | undefined = undefined;

    let newAnnotationText = '';
    let busy = false;
    let inputEl: HTMLTextAreaElement | undefined;

    async function autoResize() {
        if (!inputEl) return;
        inputEl.style.height = 'auto';
        inputEl.style.height = `${inputEl.scrollHeight + 5}px`;
    }

    $: if (inputEl && newAnnotationText !== undefined) autoResize();

    async function addAnnotation() {
        const text = newAnnotationText.trim();
        if (!text || busy) return;
        busy = true;
        const result = await getGlobalContext().handler!.annotateTask(taskUuid, text);
        busy = false;
        if (result.isErr()) {
            new Notice(`Could not add annotation: ${result.error}`, 5000);
            return;
        }
        newAnnotationText = '';
    }

    async function removeAnnotation(annotation: Annotation) {
        if (busy) return;
        busy = true;
        const result = await getGlobalContext().handler!.denotateTask(taskUuid, annotation.content);
        busy = false;
        if (result.isErr()) {
            new Notice(`Could not remove annotation: ${result.error}`, 5000);
        }
    }
</script>

<div class="annotations-container">
    <span class="annotations-header">Annotations</span>
    {#each annotations as annotation}
    <div class="annotation">
        <div class="annotation-row">
            <span class="annotation-date">{annotation.date}</span>
            <button class="annotation-delete-button" disabled={busy} title="Remove annotation" on:click={() => removeAnnotation(annotation)}>{@html getIcon('trash')?.outerHTML ?? '×'}</button>
        </div>
        <div class="annotation-content">
            <AnnotationContent content={annotation.content} taskUuid={taskUuid} onOpen={close} />
        </div>
    </div>
    {/each}
    <div class="annotation-add-row">
        <textarea
            class="annotation-add-input"
            placeholder="Add annotation... (Shift+Enter for newline)"
            rows="1"
            bind:this={inputEl}
            bind:value={newAnnotationText}
            disabled={busy}
            on:keydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addAnnotation(); } }}
        ></textarea>
        <button class="annotation-add-button" disabled={busy || !newAnnotationText.trim()} on:click={addAnnotation}>{@html getIcon('plus')?.outerHTML ?? '+'}</button>
    </div>
</div>

<style>
    .annotations-container {
        margin: 0.5em 0;
        display: flex;
        flex-direction: column;
        gap: 0.4em;
    }

    .annotations-header {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--text-muted);
    }

    .annotation {
        padding: 0.4em 0.6em;
        border-left: 2px solid var(--interactive-accent);
        background-color: var(--background-secondary);
        border-radius: 2px;
    }

    .annotation-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.4em;
    }

    .annotation-date {
        font-size: 0.75em;
        color: var(--text-muted);
        font-family: monospace;
    }

    .annotation-delete-button {
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--text-muted);
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: none;
    }

    .annotation-delete-button:hover:not(:disabled) {
        color: var(--text-error);
    }

    .annotation-delete-button:disabled {
        opacity: 0.5;
    }

    .annotation-add-row {
        display: flex;
        align-items: center;
        gap: 0.4em;
        margin-top: 0.2em;
    }

    .annotation-add-input {
        flex: 1;
        font-size: 0.85em;
        padding: 0.25em 0.5em;
        font-family: inherit;
        resize: vertical;
        min-height: 1.8em;
    }

    .annotation-add-button {
        flex: 0 0 auto;
        cursor: pointer;
        padding: 0.25em 0.5em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .annotation-add-button:disabled {
        opacity: 0.5;
    }

    .annotation-content {
        margin-top: 0.2em;
        font-size: 0.9em;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
        user-select: text;
        -webkit-user-select: text;
    }

</style>
