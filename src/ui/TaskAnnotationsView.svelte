<script lang="ts">
    import type TWPlugin from 'src/main';
    import { TaskEvents } from 'src/task-handler';
    import { shortUuid } from 'src/util';
    import { onDestroy, onMount } from 'svelte';
    import TaskAnnotations, { type Annotation } from './components/TaskAnnotations.svelte';

    export let plugin: TWPlugin;
    export let taskUuid: string;
    export let titleElement: HTMLElement;

    let state: 'loading' | 'error' | 'ok' = 'loading';
    let annotations: Annotation[] = [];
    let hasLoaded = false;

    function formatEntry(entry: string): string {
        const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(entry);
        if (!m) return entry;
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    async function fetchDetails() {
        if (!hasLoaded) state = 'loading';
        const result = await plugin.handler!.getTaskAnnotations(taskUuid);
        if (result.isOk()) {
            annotations = result.value.map(a => ({ date: formatEntry(a.entry), content: a.description }));
            state = 'ok';
            hasLoaded = true;
        } else {
            state = 'error';
        }
    }

    onMount(() => {
        titleElement.setText(`Annotations for ${shortUuid(taskUuid)}`);
        fetchDetails();
        plugin.emitter!.on(TaskEvents.REFRESH, fetchDetails);
    });

    onDestroy(() => {
        plugin.emitter!.off(TaskEvents.REFRESH, fetchDetails);
    });
</script>

<div>
    {#if state === 'loading'}
        <p class="status">Fetching...</p>
    {:else if state === 'error'}
        <p class="status error">Could not fetch task details.</p>
    {:else}
        <TaskAnnotations {annotations} {taskUuid} />
    {/if}
</div>

<style>
    .status {
        color: var(--text-muted);
        font-size: 0.9em;
    }

    .error {
        color: var(--text-error);
    }
</style>
