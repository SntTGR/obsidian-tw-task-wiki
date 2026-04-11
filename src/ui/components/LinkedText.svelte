<script lang="ts">
    export let text: string;

    interface TextSegment {
        type: 'text' | 'link';
        value: string;
    }

    const URL_REGEX = /https?:\/\/[^\s<>)"'\]]+/g;

    export function parseLinkedText(input: string): TextSegment[] {
        const segments: TextSegment[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        URL_REGEX.lastIndex = 0;
        while ((match = URL_REGEX.exec(input)) !== null) {
            if (match.index > lastIndex) {
                segments.push({ type: 'text', value: input.slice(lastIndex, match.index) });
            }
            segments.push({ type: 'link', value: match[0] });
            lastIndex = URL_REGEX.lastIndex;
        }

        if (lastIndex < input.length) {
            segments.push({ type: 'text', value: input.slice(lastIndex) });
        }

        return segments;
    }

    $: segments = parseLinkedText(text);

</script>
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
{#each segments as segment}
    {#if segment.type === 'link'}
        <a
            class="linked-text-link"
            href={segment.value}
            on:click|stopPropagation|preventDefault={() => window.open(segment.value)}
        >{segment.value}</a>
    {:else}
        <span class="linked-text-plain">{segment.value}</span>
    {/if}
{/each}

<style>
    .linked-text-link {
        cursor: pointer;
        text-decoration: none;
        color: var(--link-color, var(--text-accent));
    }

    .linked-text-link:hover {
        text-decoration: underline;
    }
</style>
