<script lang="ts">
	import type { ColorHSL } from "src/util";
    import { memoizedHexToHSL, threeColorHslLerp } from "src/util";
	import { onMount } from "svelte";
    
    export let urgency: string;
    
    let aColorHSL : ColorHSL = memoizedHexToHSL(document.body.getCssPropertyValue('--color-red'));
    let bColorHSL : ColorHSL = memoizedHexToHSL(document.body.getCssPropertyValue('--color-yellow'));
    let cColorHSL : ColorHSL = memoizedHexToHSL(document.body.getCssPropertyValue('--color-green'))

    let urgencyValue: number;
    $: { urgencyValue = (parseFloat(urgency) + 5.0) / 20.0; }
    let urgencyColor : ColorHSL;
    $: { urgencyColor = threeColorHslLerp(cColorHSL, bColorHSL, aColorHSL, urgencyValue) }

    onMount(() => {
        urgencyValue = parseFloat(urgency) / 10.0;
        urgencyColor = threeColorHslLerp(cColorHSL, bColorHSL, aColorHSL, urgencyValue)
    });

    function colorHSLToString(color: ColorHSL, alpha: number = 1.0) {
        return `hsla(${color[0]}, ${color[1]}%, ${color[2]}%, ${alpha})`;
    }
    
    
</script>

<div class="center-td">
    <div class="pill-container">
        <div style="color:{colorHSLToString(urgencyColor)}; background-color:{colorHSLToString(urgencyColor, 0.1)}" class="pill-class">{urgency}</div>
    </div>
</div>

<style>

    .pill-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
    }

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