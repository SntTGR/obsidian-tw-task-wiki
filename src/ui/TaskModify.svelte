<script lang="ts">
	import { Notice } from 'obsidian';
    import type TWPlugin from 'src/main';

	export let plugin: TWPlugin;
    export let task: { uuid: string, taskName?: string }
    export let close: () => void;

    let input: string;
    let state: 'loading' | 'error' | 'ok' = 'ok';

    async function modifyTask(cmd: string) {
        state = 'loading';
        const result = await plugin.handler!.modifyTask(task.uuid, cmd);
        if (result.isErr()) {
            state = 'error';
            console.log(result.error);
            new Notice(`Could not modify task ${task.uuid}!`, 5000);
        } else {
            state = 'ok';
        }
        close();
    }

</script>

<div>
    <label for="modify-command">Modify task { task.taskName ? task.taskName : task.uuid }</label>
    <input id="modify-command" type="text" bind:value={input} placeholder="{ task.taskName ? task.taskName : 'My Task' } due:tomorrow" />
    <button disabled={state === 'loading' || input === undefined} on:click={() => modifyTask(input)}>Modify</button>
</div>

<style>
</style>
