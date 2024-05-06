<script lang="ts">
	import { createEventDispatcher } from "svelte";
    import { createHash } from 'crypto';

    let disabled: boolean = false;
    export let tags: string;
    
    let tagsArr: string[]
    $: { tagsArr = tags ? tags.split(' ') : [] }
	const dispatch = createEventDispatcher();

    function textToId6(text: string) {
        return createHash('sha1').update(text).digest().readUint8(0) % 6;
    }

    // TODO: editable tags

</script>

<td class="center-td">
    {#if tagsArr.length !== 0} 
        <div class="pill-container">
            {#each tagsArr as tag}
                <div class="pill-class {`accent-${textToId6(tag)+1}`}">{tag}</div>
            {/each}
        </div>
    {/if}
</td>



<style>

    .pill-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
    }

    .accent-1 { color: var(--accent-1); background-color: rgba(var(--accent-1-rgb), 0.1); }
    .accent-2 { color: var(--accent-2); background-color: rgba(var(--accent-2-rgb), 0.1); }
    .accent-3 { color: var(--accent-3); background-color: rgba(var(--accent-3-rgb), 0.1); }
    .accent-4 { color: var(--accent-4); background-color: rgba(var(--accent-4-rgb), 0.1); }
    .accent-5 { color: var(--accent-5); background-color: rgba(var(--accent-5-rgb), 0.1); }
    .accent-6 { color: var(--accent-6); background-color: rgba(var(--accent-6-rgb), 0.1); }

    .pill-class {
        display: inline-block;
        padding: 0.25em 0.25em;
        margin: 0.1em;
        
        border-radius: var(--pill-radius);
        font-weight: var(--pill-weight);
        font-size: var(--metadata-input-font-size);

        justify-content: center;
    }

    .center-td {
		text-align: center;    
	}

</style>