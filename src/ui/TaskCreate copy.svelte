<script lang="ts">
	import { Notice } from 'obsidian';
    import type TWPlugin from 'src/main';

	export let plugin: TWPlugin;
    export let close: () => void;

    let input: string;
    let state: 'loading' | 'error' | 'ok' = 'ok';

    async function createTask(cmd: string) {
        state = 'loading';
        const result = await plugin.handler!.createTask(cmd);
        if (result.isErr()) {
            state = 'error';
            console.log(result.error);
            new Notice('Could not create task!', 5000);
        } else {
            state = 'ok';
        }
        close();
    }

</script>

<div>
    <label for="create-command">Create Task</label>
    <input id="create-command" type="text" bind:value={input} placeholder="My new task priority:L" />
    <button disabled={state === 'loading' || input === undefined} on:click={() => createTask(input)}>Create</button>
</div>

<style>
</style>
