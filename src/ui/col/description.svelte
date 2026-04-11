<script lang="ts">
    import LinkedText from '../components/LinkedText.svelte';
    import AnnotationContent from '../components/AnnotationContent.svelte';
    import { UpdateTaskModal, TaskAnnotationsListModal } from '../../modals';
    import { getDescriptionFormat, parseDescriptionData } from '../utils/description-parser';

    export let data: string;
    export let columnType: string;
    export let taskUuid: string;

    $: format = getDescriptionFormat(columnType);
    $: parsed = parseDescriptionData(data, format);

    function openModify() {
        if (parsed.truncated) {
            new UpdateTaskModal({ uuid: taskUuid }).open();
        } else {
            new UpdateTaskModal({ uuid: taskUuid }, { value: parsed.description }).open();
        }
    }

    function openAnnotationsList(e: MouseEvent) {
        e.stopPropagation();
        new TaskAnnotationsListModal(taskUuid).open();
    }
</script>

<div class="description-container no-cell-click">
    <div class="description-row">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="description-text" on:click={openModify}>
            <LinkedText text={parsed.description}/>
        </div>
        {#if parsed.count !== null && parsed.count > 0}
            <button class="annotation-count-button" on:click={openAnnotationsList} title="Show annotations">[{parsed.count}]</button>
        {/if}
    </div>
    {#if parsed.annotations.length > 0}
        <div class="inline-annotations">
            {#each parsed.annotations as annotation}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div on:click={openAnnotationsList} class="inline-annotation">
                    {#if annotation.date}<span class="inline-annotation-date">{annotation.date}</span>{/if}
                    <span class="inline-annotation-content"><AnnotationContent content={annotation.content}/></span>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .description-container {
        display: flex;
        flex-direction: column;
        gap: 0.2em;
    }

    .description-row {
        display: flex;
        align-items: flex-start;
        gap: 0.5em;
    }

    .description-text {
        flex: 1;
        cursor: pointer;
        min-width: 0;
    }

    .annotation-count-button {
        flex: 0 0 auto;
        cursor: pointer;
        font-size: 0.8em;
        padding: 0 0.4em;
        background-color: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 3px;
        color: var(--text-muted);
    }

    .annotation-count-button:hover {
        background-color: var(--background-modifier-hover);
    }

    .inline-annotations {
        display: flex;
        flex-direction: column;
        gap: 0.2em;
        padding-left: 0.6em;
        border-left: 2px solid var(--interactive-accent);
        margin-top: 0.2em;
    }

    .inline-annotation {
        font-size: 0.85em;
    }

    .inline-annotation-date {
        font-size: 0.9em;
        color: var(--text-muted);
        font-family: monospace;
        margin-right: 0.4em;
    }

    .inline-annotation-content {
        white-space: pre-wrap;
    }
</style>
