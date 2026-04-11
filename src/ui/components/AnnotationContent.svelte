<script lang="ts">
    import LinkedText from './LinkedText.svelte';
    import { resolvePathToVaultFile, openVaultFile, getGlobalContext } from '../../util';

    export let content: string;
    export let onOpen: (() => void) | undefined = undefined;

    const toDisplay = (c: string) => c.replace(/\\n/g, '\n');

    $: displayContent = toDisplay(content);
    $: resolvedPath = resolvePathToVaultFile(content.trim());

    function triggerHoverPreview(event: MouseEvent, path: string) {
        if (!path.toLowerCase().endsWith('.md')) return;
        const plugin = getGlobalContext();
        plugin.app.workspace.trigger('hover-link', {
            event,
            source: 'tw-task-wiki',
            hoverParent: plugin,
            targetEl: event.currentTarget,
            linktext: path,
            sourcePath: '',
        });
    }

    function handleClick(e: MouseEvent, path: string) {
        e.stopPropagation();
        e.preventDefault();
        openVaultFile(path);
        onOpen?.();
    }
</script>

{#if resolvedPath}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <a
        class="vault-link"
        href={resolvedPath}
        on:click={(e) => { const p = resolvedPath; if (p) handleClick(e, p); }}
        on:mouseover={(e) => { const p = resolvedPath; if (p) triggerHoverPreview(e, p); }}
        on:focus={() => {}}
    >{displayContent}</a>
{:else}
    <LinkedText text={displayContent} />
{/if}

<style>
    .vault-link {
        cursor: pointer;
        text-decoration: none;
        color: var(--link-color, var(--text-accent));
    }

    .vault-link:hover {
        text-decoration: underline;
    }

    /* Obsidian's hover popover defaults to --layer-popover (30), which sits
       below --layer-modal (50). Raise it above the modal only while one of
       our modals is open, to avoid touching other plugins' popovers. */
    :global(body:has(.tw-task-wiki-modal) .popover.hover-popover) {
        z-index: var(--layer-menu);
    }
</style>
