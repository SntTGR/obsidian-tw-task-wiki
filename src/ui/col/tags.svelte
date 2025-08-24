<script lang="ts">
    import { createHash } from 'crypto';
    import { getGlobalContext } from "src/util";
	import type TWPlugin from "src/main";

    const plugin: TWPlugin = getGlobalContext();

    let disabled: boolean = false;
    
    export let tags: string;
    export let uuid: string;
    
    let tagsArr: string[]
    $: { tagsArr = tags ? tags.split(' ') : [] }

    function textToId6(text: string) {
        return createHash('sha1').update(text).digest().readUint8(0) % 6;
    }

    async function removeTag(tag: string) {
        disabled = true;
        await plugin.handler!.removeTag(uuid, tag).catch((err) => {
            disabled = false;
            plugin.logger!.debug_log(`Error removing tag ${tag} from task ${uuid}`, err);
        });
        disabled = false;
    }

</script>

<div class="center-td">
    {#if tagsArr.length !== 0} 
        <div class="pill-container">
            {#each tagsArr as tag}
                <div class="pill-class {`accent-${textToId6(tag)+1}`} no-cell-click">
                    <button 
                        class="delete-button" 
                        on:click={() => { removeTag(tag); }}
                        aria-label={`Remove ${tag}`}
                    >
                        ×
                    </button>
                    {tag}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .pill-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
    }

    .accent-1 { color: var(--color-red); background-color: rgba(var(--color-red-rgb), 0.1); }
    .accent-2 { color: var(--color-orange); background-color: rgba(var(--color-orange-rgb), 0.1); }
    .accent-3 { color: var(--color-yellow); background-color: rgba(var(--color-yellow-rgb), 0.1); }
    .accent-4 { color: var(--color-green); background-color: rgba(var(--color-green-rgb), 0.1); }
    .accent-5 { color: var(--color-cyan); background-color: rgba(var(--color-cyan-rgb), 0.1); }
    .accent-6 { color: var(--color-blue); background-color: rgba(var(--color-blue-rgb), 0.1); }

    .pill-class {
        display: inline-flex;  /* Changed to inline-flex to align items */
        align-items: center;
        padding: 0.25em 0.25em;
        margin: 0.1em;
        border-radius: var(--pill-radius);
        font-weight: var(--pill-weight);
        font-size: var(--metadata-input-font-size);
        justify-content: center;
    }

    .delete-button {
        background: none;
        border: none;
        padding: 0 0.1em;
        cursor: pointer;
        font-size: 1.2em;
        line-height: 0.85;
        opacity: 0.7;
        color: inherit;

        display: flex;      /* Added flex display */
        align-items: center; /* Center content vertically */
        height: 100%;       /* Make button take full height */

        border: 0;
        box-shadow: none;
        height: auto;
    }

    .delete-button:hover {
        opacity: 1;
    }

    .center-td {
        text-align: center;    
    }
</style>