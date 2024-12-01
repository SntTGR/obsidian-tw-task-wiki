<script lang="ts">
    import { createHash } from 'crypto';
	import type TWPlugin from 'src/main';
	import { getGlobalContext, matchProjectRegex } from 'src/util';

    export let project: string;
    
    const plugin: TWPlugin = getGlobalContext();
    
    const uri: string | undefined = project ? matchProjectRegex(project) : undefined;
    
    function textToId6(text: string) {
        return createHash('sha1').update(text).digest().readUint8(0) % 6;
    }

    // TODO: Split project name into . and color differently
</script>

<div class="center-td">
    {#if project}
        <div class="pill-class {`accent-${textToId6(project)+1}`}">
            {#if uri}
                <a class="no-cell-click" href={uri}>{project}</a>
            {:else}
                {project}
            {/if}
        </div>
    {/if}
</div>

<style>

    .accent-1 { color: var(--accent-1); }
    .accent-2 { color: var(--accent-2); }
    .accent-3 { color: var(--accent-3); }
    .accent-4 { color: var(--accent-4); }
    .accent-5 { color: var(--accent-5); }
    .accent-6 { color: var(--accent-6); }

    .pill-class a {
        color: inherit;
        text-decoration: none;
    }
    .pill-class a:hover {
        text-decoration: underline;
    }

    .pill-class {
        display: inline-block;
        padding: 0.25em 0.25em;
        margin: 0.1em;
        
        font-size: var(--metadata-input-font-size);

        justify-content: left;
    }

    .center-td {
		text-align: left;    
	}

</style>