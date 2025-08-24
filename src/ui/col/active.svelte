<script lang="ts">
    import type TWPlugin from "src/main";
	import { getGlobalContext } from "src/util";
	import type { Task } from "src/task-handler";

    const plugin: TWPlugin = getGlobalContext();

    export let uuid: Task['uuid'];
    export let taskActive : boolean;
    export let disabled : true | undefined = undefined;
    
	function isChecked(e: Event): boolean { return (e.target as any).checked }

    async function changeActiveStatus(newStatus: boolean) {
        disabled = true;
        const result = await (newStatus ? plugin.handler!.stopTask(uuid) : plugin.handler!.startTask(uuid));
        disabled = undefined;
    }
</script>

<div class="center-div"><input disabled={disabled} class="small-checkbox no-cell-click" type="checkbox" checked={taskActive} on:change={e => isChecked(e) ? changeActiveStatus(false) : changeActiveStatus(true)}/></div>

<style>

    .small-checkbox {
		margin: 0;
	}

    .center-div {
		text-align: center;		
	}

</style>